# Production Full-Stack AWS & Kubernetes Architecture

This document describes the design, data-flow, resiliency, and monitoring architecture implemented in this project.

---

## 🏛️ 1. High-Level Architecture Diagram

```
[ End User / Browser ]
          │
          │ HTTPS (TLS 1.3)
          ▼
    [ Route 53 ] (DNS Latency-based Routing)
          │
    ┌─────┴───────────────────────────────────────────────────────┐
    │                                                             │
    ▼                                                             ▼
[ AWS CloudFront + WAF ]                                    [ AWS WAF ]
  (Static Asset CDN)                                              │
    │                                                             ▼
    ▼                                                 [ Application Load Balancer ]
[ Amazon S3 Bucket ]                                       (ALB in Public Subnets)
  (React TypeScript SPA Build)                                    │
                                                                  ▼
                                                      [ Amazon EKS Cluster ]
                                                        (Private Subnets)
                                                                  │
                                            ┌─────────────────────┴─────────────────────┐
                                            │                                           │
                                            ▼                                           ▼
                                    [ Node.js BFF Pod 1 ]                       [ Node.js BFF Pod 2 ]
                                    (Express + TypeScript)                      (Express + TypeScript)
                                            │                                           │
                                            └─────────────────────┬─────────────────────┘
                                                                  │
                                    ┌─────────────────────────────┼─────────────────────────────┐
                                    │                             │                             │
                                    ▼                             ▼                             ▼
                            [ AWS RDS Proxy ]              [ Amazon SQS ]              [ ElastiCache Redis ]
                                    │                             │                        (Session / Cache)
                                    ▼                             ▼
                        [ Amazon RDS PostgreSQL ]       [ AWS Lambda Workers ]
                           (Multi-AZ Cluster)             (processOrder / SES)
```

---

## 🔒 2. Network Topology & VPC Segmentation

To follow AWS Security Best Practices (Well-Architected Framework):

1. **Public Subnets (`10.0.1.0/24`, `10.0.2.0/24` across 2 AZs):**
   - Application Load Balancers (ALB)
   - NAT Gateways (provides outbound internet for private subnets)
   - Bastion Hosts (if SSH jump boxes are needed; preferably AWS Systems Manager Session Manager)
2. **Private Application Subnets (`10.0.10.0/24`, `10.0.20.0/24`):**
   - EKS Worker Node Groups (EC2 instances managed by Karpenter)
   - AWS Lambda functions running in VPC mode
   - EKS Pod IPs allocated via AWS VPC CNI
3. **Private Isolated Database Subnets (`10.0.100.0/24`, `10.0.200.0/24`):**
   - Amazon RDS PostgreSQL (Primary + Standby Multi-AZ)
   - Amazon RDS Proxy endpoints
   - Amazon ElastiCache (Redis)
   - *Zero internet access:* No routing to Internet Gateway or NAT Gateway. Ingress strictly limited to application subnet security groups.

---

## 🔄 3. Step-by-Step Request Lifecycle

1. **Frontend Boot:**
   - User visits `https://app.example.com`.
   - CloudFront serves index.html and minified JS bundles directly from edge caches.
   - React app initializes, checks `localStorage` for JWT, mounts views.
2. **Data Query via BFF:**
   - React components make an API call to `/api/orders` via Axios.
   - Ingress controller passes request to Node.js BFF Pod on Port 4000.
   - BFF middleware validates authorization token, applies rate limits, logs trace ID.
   - BFF retrieves cached data from Redis; on cache miss, executes parameterized SQL via RDS Proxy.
3. **Asynchronous Order Processing via Lambda:**
   - When an order is placed (`POST /api/orders`), the BFF writes an initial record (`status = PENDING`) and puts an event into **Amazon SQS (`OrderQueue`)**.
   - SQS triggers **Lambda (`processOrder`)** in micro-batches (up to 10 messages).
   - Lambda processes order, calls RDS Proxy to mark order `PROCESSING`, and emits notification event via SNS $\rightarrow$ SES.
   - Result: BFF returns immediately (`HTTP 201`) with low latency; heavy processing never blocks UI or backend pods.

---

## 📊 4. Monitoring & Observability Stack

| Pillar | AWS Tool | Implementation |
|---|---|---|
| **Metrics** | **CloudWatch & Container Insights** | Ingests pod CPU/memory, node utilization, network IO, RDS IOPS, Lambda durations. |
| **Logs** | **CloudWatch Logs Insights** | Fluent Bit DaemonSet ships container logs in JSON format with structured contextual tags (`userId`, `traceId`, `orderId`). |
| **Traces** | **AWS X-Ray** | Distributed tracing across ALB $\rightarrow$ Node.js BFF $\rightarrow$ RDS Proxy $\rightarrow$ SQS $\rightarrow$ Lambda. |
| **Alerts** | **CloudWatch Alarms + SNS** | Notifies team on Slack / PagerDuty when 5XX error rate > 1% or p95 latency exceeds 1.5s for 2 evaluation periods. |

---

## 💰 5. Cost Optimization Strategies

1. **Spot Instances with Karpenter:** Run stateless Node.js BFF pods on EC2 Spot Instances (saving up to 80-90% compute cost) backed by multi-AZ On-Demand fallbacks.
2. **AWS Graviton (arm64):** Build container images for `linux/arm64` architecture, leveraging Graviton3 EC2 nodes and Graviton Lambda functions for 20% cost reduction and higher energy efficiency.
3. **S3 Static Hosting + CloudFront:** Eliminates the need to run EC2/container instances just to serve HTML/CSS/JS frontend files.
4. **RDS Proxy Connection Multiplexing:** Enables smaller database instance types by preventing memory ballooning from excessive connection counts.

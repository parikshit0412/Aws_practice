# Full Stack Developer Interview Preparation (AWS, EKS, Node.js, React, RDS, Lambda)

> **Role Focus:** Full Stack Developer (React TypeScript, Node.js BFF, AWS Ecosystem, EKS / Kubernetes)  
> **Key Themes:** Architecture trade-offs, Production resilience, Cost efficiency, Observability, Real-world troubleshooting.

---

## 📌 Section 1: End-to-End Architecture & BFF Pattern

### Q1: What is the BFF (Backend for Frontend) pattern and why use it over a generic API Gateway?
**Answer:**
A **BFF (Backend for Frontend)** is a dedicated backend service designed specifically to cater to the needs of a single frontend interface (e.g., React SPA, Mobile app).
- **Core benefits:**
  1. **Data aggregation & shaping:** Instead of the React client making 5 separate REST calls to different internal microservices, it makes 1 call to the BFF. The BFF fetches downstream data concurrently, aggregates it, strips unused fields, and delivers a minimal, UI-ready payload.
  2. **Security & Credential Masking:** Sensitive tokens, AWS Secrets, internal service URLs, and database connection strings stay securely behind the BFF in private VPC subnets. The client only sees HTTP-only cookies or short-lived JWTs.
  3. **Protocol Translation:** BFF can speak gRPC/Kafka internally while serving REST/GraphQL/SSE to the browser.
  4. **Frontend Ownership:** Frontend engineers can rapidly iterate on API contracts without demanding breaking changes to core enterprise microservices.

### Q2: How does a request travel from a React user's browser all the way to PostgreSQL in AWS?
**Answer:**
1. **User Action:** User clicks "Place Order" in React (Vite SPA hosted in S3 + CloudFront).
2. **DNS & Edge:** Route 53 resolves domain `api.example.com` $\rightarrow$ AWS WAF inspects request (SQLi, rate-limiting) $\rightarrow$ CloudFront or directly to **AWS Application Load Balancer (ALB)**.
3. **Ingress & EKS:** ALB routes to the AWS Target Group containing the private IP addresses of the **Node.js BFF Pods** managed by the **AWS Load Balancer Controller** in EKS.
4. **Node.js BFF Processing:**
   - Validates JWT payload & authorization header.
   - Parses input via **Zod schema validation**.
   - Opens transaction or executes query through **AWS RDS Proxy** via connection pool (`pg`).
5. **Database Execution:** RDS Proxy checks its warm connection pool, routes to the **Amazon RDS PostgreSQL Multi-AZ** primary instance in a private data subnet.
6. **Async Offload:** If order processing requires heavy inventory locks or payment processing, BFF writes a record with status `PENDING` to RDS and publishes the order event to **Amazon SQS**.
7. **Serverless Execution:** **AWS Lambda** polls SQS via event source mapping, executes order settlement asynchronously, and notifies the client via WebSockets/SSE.

---

## 📌 Section 2: AWS RDS (PostgreSQL) Deep-Dive

### Q3: Why is AWS RDS Proxy mandatory when connecting Lambda functions (or high-concurrency Node.js pods) to RDS PostgreSQL?
**Answer:**
PostgreSQL uses a **process-per-connection** model. Each connection allocates 5–10MB of RAM on the database server.
- **The Problem:** When serverless Lambda functions scale rapidly (e.g., 500 concurrent invocations), each Lambda container tries to open its own DB connection. 500 connections can overwhelm Postgres, exhausting `max_connections`, causing CPU spikes, connection rejection (`Too many connections`), and complete DB outages.
- **The Solution (RDS Proxy):**
  1. **Connection Pooling & Multiplexing:** RDS Proxy maintains a small pool of persistent connections to Postgres and shares them across thousands of ephemeral client connections.
  2. **Fast Multi-AZ Failover:** When an RDS failover occurs, RDS Proxy reduces failover time by up to **66%** because applications keep their socket connection to the Proxy while the Proxy reconnects to the new primary.
  3. **IAM Authentication:** Centralizes credential management using AWS Secrets Manager and IAM roles instead of hardcoding passwords in application code.

### Q4: Explain the difference between Multi-AZ and Read Replicas in AWS RDS.
| Feature | RDS Multi-AZ | RDS Read Replicas |
|---|---|---|
| **Primary Purpose** | **High Availability & Disaster Recovery** | **Read Performance & Scalability** |
| **Replication Type** | **Synchronous** (zero data loss) | **Asynchronous** (slight replication lag possible) |
| **Active/Active?** | No. Standby instance cannot serve traffic. | Yes. Read replicas can serve `SELECT` queries. |
| **Failover** | Automatic DNS failover (~60-120s, <30s with RDS Proxy). | Manual or orchestrated promotion to standalone DB. |
| **Multi-Region?** | Same region (different Availability Zones). | Can span multiple AWS regions (Cross-Region). |

---

## 📌 Section 3: Containers — ECS vs EKS

### Q5: When would you choose Amazon EKS over Amazon ECS?
**Answer:**
- **Choose ECS when:**
  - The team wants simplicity and low operational overhead.
  - The stack is 100% on AWS with no requirement for multi-cloud or on-premises portability.
  - Using AWS Fargate for simple microservices without needing custom operators, CRDs, or complex service meshes.
  - Free control plane ($0 cluster management fee).
- **Choose EKS when:**
  - Multi-cloud or hybrid-cloud portability (e.g., Google GKE, Azure AKS, on-prem OpenShift).
  - Advanced Kubernetes ecosystem is required: **ArgoCD (GitOps)**, **Helm**, **Prometheus/Grafana Operators**, **Cert-Manager**, **Istio/Linkerd (Service Mesh)**.
  - Granular pod auto-scaling and node scheduling using modern tools like **Karpenter** for fast, cost-efficient EC2 bin-packing.

### Q6: What are Kubernetes Probes (Liveness, Readiness, Startup)? Why are they crucial in Node.js?
**Answer:**
1. **Startup Probe:** Checks if the app has finished booting. Disables liveness and readiness checks until it passes. Crucial for slow-starting services.
2. **Readiness Probe (`/api/health`):** Checks if the pod is ready to accept user traffic. If it returns 5xx or fails, Kubernetes removes the pod from the Service/ALB endpoints without killing it.
   - *Example in Node.js:* Returns `503 Service Unavailable` if the PostgreSQL pool fails to connect or database migrations are still executing.
3. **Liveness Probe:** Checks if the process is alive. If this fails, Kubelet restarts the container.
   - *Warning:* Never include heavy database checks in a liveness probe! If your database is down, killing and restarting 20 Node.js pods will create a boot-storm and worsen database saturation. Use DB checks in **Readiness**, not Liveness.

### Q7: How does Horizontal Pod Autoscaler (HPA) coordinate with Karpenter / Cluster Autoscaler?
**Answer:**
- **Step 1 (Pod scaling):** HPA monitors metrics (e.g., Pod CPU > 70% or custom Prometheus RPS metric). When breached, HPA calculates desired replicas and instructs the Deployment to scale from 3 to 10 pods.
- **Step 2 (Scheduling pending pods):** If existing EC2 worker nodes lack sufficient CPU/Memory requests, new pods enter `Pending` state.
- **Step 3 (Node scaling via Karpenter):** Karpenter intercepts the `Pending` pods, evaluates their resource constraints, calculates the most cost-effective EC2 instance type (e.g., a mix of Graviton `c6g.large` and Spot instances), launches the instance in seconds via AWS fleet APIs, and binds the pods.

---

## 📌 Section 4: AWS Lambda & Cost Optimization

### Q8: "Lambda is cheap" — is this always true? When does Lambda become more expensive than EKS?
**Answer:**
- **Lambda is cost-efficient for:**
  - Spiky, intermittent, or event-driven traffic (e.g., S3 file uploads, webhook processing, nightly batch jobs).
  - Low-traffic services where traditional EC2/EKS would sit idle at 5% CPU utilization 24/7.
  - *Cost equation:* You pay $0 for idle capacity; billed strictly per millisecond of compute.
- **Lambda becomes more expensive than EKS/ECS when:**
  - Sustained, predictable, high-throughput traffic (e.g., 5,000+ constant requests per second 24/7).
  - Heavy memory requirements and long execution times (e.g., sustained 15-minute executions with 4GB RAM).
  - *Rule of thumb:* At steady-state 80%+ CPU utilization, reserved EC2 instances or EKS Spot instances deliver lower unit cost than Lambda invocations.

### Q9: How do you eliminate or mitigate Lambda cold starts in Node.js?
**Answer:**
1. **Architecture & Bundling:**
   - Use **AWS SDK v3** with specific sub-module imports (`@aws-sdk/client-s3` instead of the monolithic `aws-sdk`).
   - Bundle using **esbuild** / webpack to create a single minified `.js` file, eliminating thousands of `node_modules` file reads during container init.
2. **Runtime & Architecture:**
   - Use **Node.js on AWS Graviton (arm64)**: Up to 20% cheaper and lower execution latencies.
3. **Execution Context Reuse:**
   - Declare DB clients, Redis connections, and heavy objects outside the `exports.handler`. Reused during warm invocations.
4. **Provisioned Concurrency:**
   - For mission-critical customer-facing endpoints, allocate Provisioned Concurrency to keep a pool of microVMs pre-warmed and ready to respond in single-digit milliseconds.

---

## 📌 Section 5: Observability & Monitoring in AWS

### Q10: What are the Three Pillars of Observability and how do you implement them in this stack?
**Answer:**
1. **Metrics (Numerical Telemetry):**
   - **Infrastructure:** AWS CloudWatch Container Insights (Pod CPU, Memory, Disk, Network) and RDS metrics (DatabaseConnections, CPUUtilization, ReadIOPS).
   - **Application:** Prometheus scraping `/metrics` endpoints in Node.js via `prom-client` $\rightarrow$ visualized in Grafana.
2. **Logs (Event Records):**
   - Fluent Bit or AWS Distro for OpenTelemetry running as a K8s DaemonSet collects container logs (`stdout`/`stderr`), strips ANSI codes, structures JSON, and pushes to **CloudWatch Logs** log groups (`/aws/containerinsights/production/application`).
   - CloudWatch Log Insights used for ad-hoc querying:
     ```sql
     fields @timestamp, @message
     | filter status >= 500
     | stats count(*) by bin(5m)
     ```
3. **Traces (Request Journey):**
   - **AWS X-Ray** / OpenTelemetry SDK wraps incoming HTTP requests in Express, injecting the `X-Amzn-Trace-Id`.
   - Propagates trace context across services: React $\rightarrow$ ALB $\rightarrow$ Node BFF $\rightarrow$ RDS / SQS $\rightarrow$ Lambda.
   - Produces a Service Map showing latency bottlenecks and fault locations.

### Q11: How do you design an alert strategy that prevents alert fatigue?
**Answer:**
- Rely on **Symptom-based (SLO/SLI) alerts** over cause-based alerts:
  - *Bad Alert:* "Pod CPU is 85%" (often harmless if HPA is handling it).
  - *Good Alert:* "p95 API Latency > 1200ms for 5 consecutive minutes" or "5XX HTTP Error Rate > 1% over 3 minutes".
- Integrate alerts via **Amazon CloudWatch Alarms $\rightarrow$ Amazon SNS $\rightarrow$ PagerDuty / Slack**:
  - **P1/Critical (PagerDuty call):** Customer-impacting SLA breach (e.g., checkout endpoint 500 errors).
  - **P2/Warning (Slack channel):** Approaching threshold (e.g., RDS disk storage < 20%, error budget burn rate elevated).

---

## 📌 Section 6: React & Node.js Core Coding Questions

### Q12: How do you prevent unnecessary re-renders in large React applications?
**Answer:**
1. **Component Splitting:** Isolate dynamic local state into separate leaf components so parent trees don't re-render.
2. **Memoization:**
   - `React.memo`: Wraps child component to skip rendering if props are referentially identical.
   - `useCallback`: Preserves callback function references passed to memoized children.
   - `useMemo`: Caches expensive computation results between renders.
3. **State Colocation & Server State Separation:**
   - Do not push server response data into global Redux store unnecessarily. Use **TanStack Query (React Query)** or SWR. They manage caching, deduplication, and stale-while-revalidate out-of-the-box.
4. **Windowing / Virtualization:**
   - Use `react-window` or `@tanstack/react-virtual` to render only the visible rows (e.g., 20 out of 10,000 orders).

### Q13: Node.js is single-threaded. What happens if a CPU-intensive task runs in an Express route? How do you fix it?
**Answer:**
- Because the event loop runs on a single thread, a synchronous CPU-heavy task (e.g., password hashing with heavy bcrypt cycles, large image transformation, or massive JSON parsing) blocks the Event Loop Call Stack.
- **The consequence:** Node.js cannot process any incoming network I/O, timers, or promises. All other user requests hang until the synchronous task completes.
- **Solutions:**
  1. **Worker Threads:** Offload task to Node.js `worker_threads` module, executing on a separate OS thread pool without blocking the main event loop.
  2. **Delegate to AWS Lambda / SQS:** Instead of executing in the BFF, push the payload to an SQS queue. A dedicated Lambda function or background worker handles the computation.
  3. **Cluster Module / Horizontal Pods:** Deploy multiple pods across CPU cores with EKS or use `pm2`/cluster module.

---

## 📌 Section 7: Security Best Practices

### Q14: How do you secure Pods in EKS when communicating with AWS services like S3 or RDS?
**Answer:**
- **Anti-pattern:** Storing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Kubernetes Secrets or environment variables.
- **Best Practice — IAM Roles for Service Accounts (IRSA):**
  1. An OIDC identity provider is configured for the EKS cluster.
  2. Create an AWS IAM role with scoped permissions (e.g., S3 read on specific bucket).
  3. Define a trust relationship in IAM matching the K8s Service Account and namespace.
  4. Annotate the Kubernetes `ServiceAccount`:
     ```yaml
     apiVersion: v1
     kind: ServiceAccount
     metadata:
       name: node-bff-sa
       annotations:
         eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/NodeBFFRole
     ```
  5. The AWS SDK in Node.js automatically uses AWS STS Web Identity tokens injected into the pod to assume the role.

### Q15: Why should Amazon RDS NEVER be publicly accessible? How do you secure it inside a VPC?
**Answer:**
- **The Security Risk:** Exposing a database with `Publicly Accessible: Yes` gives it a public IP, making it vulnerable to DDoS attacks, automated port scanners, and brute-force password cracking.
- **Production Best Practice:**
  1. Keep `Publicly Accessible: No`. Deploy RDS across private database subnets without an Internet Gateway route.
  2. Deploy application servers (EC2 or EKS) in the **same VPC** and region.
  3. Use **Security Group Referencing**: The RDS Security Group allows Port 5432 inbound **only** from the specific Security Group ID of the application (`sg-web-server`), not an open IP range.
  4. Database traffic travels purely over AWS's internal private fiber network with sub-millisecond latency and zero internet traversal.

### Q16: A developer says: "I cannot connect to RDS from my laptop; it says 'timeout expired'." How do you troubleshoot this?
**Answer:**
1. **Network Path Check:** Is the database configured with `Publicly Accessible: No`? If so, the timeout is intentional—it cannot be reached from outside the AWS VPC.
2. **Security Group Inbound Rules:** Check if the RDS Security Group allows inbound TCP traffic on Port 5432 from the client's current public IP address.
3. **Subnet Route Table:** Verify whether the RDS subnet has a route to an Internet Gateway (`0.0.0.0/0 -> igw-xxx`). If it points to a NAT Gateway or has no route, it is a private subnet.
4. **Resolution in Production:** Instead of opening the DB to the internet, use an **AWS Systems Manager (SSM) Session Manager port-forwarding tunnel** or a secure Bastion Host with SSH tunneling.

### Q17: What are the Four Golden Signals of monitoring and how does CloudWatch track them?
**Answer:**
1. **Latency:** Monitored via ALB `TargetResponseTime` (tracking **p95** and **p99** percentiles) and Lambda `Duration`.
2. **Traffic:** Monitored via ALB `RequestCount` and Lambda `Invocations`.
3. **Errors:** Monitored via ALB `HTTPCode_Target_5XX_Count` and Lambda `Errors`.
4. **Saturation:** Monitored via EKS Container Insights `pod_cpu_utilization` / `pod_memory_utilization` and RDS `DatabaseConnections` / `CPUUtilization`.

---

## 📌 Section 8: Rapid-Fire One-Liner Cheatsheet

| Question | Rapid-Fire Answer |
|---|---|
| **What is Karpenter?** | High-performance open-source node autoscaler built by AWS that provisions rightsized EC2 instances in seconds directly from pending pods. |
| **Why use Graviton (ARM)?** | AWS Graviton processors offer up to 40% better price-performance over comparable x86 EC2/Lambda instances. |
| **How does CloudWatch Logs Insights help debug?** | Enables SQL-like querying on millions of log events to aggregate status codes, exceptions, and latency percentiles. |
| **What is Pod Anti-Affinity?** | A Kubernetes rule instructing the scheduler to place replica pods across different physical worker nodes or Availability Zones for high availability. |
| **What is a Dead Letter Queue (DLQ)?** | An SQS queue where messages that fail processing after max retry count are isolated for inspection without halting the queue. |
| **Why use multi-stage Docker builds?** | Separates build dependencies (TypeScript compiler, devDependencies) from runtime image, shrinking image size and eliminating vulnerabilities. |
| **What is S3 + CloudFront hosting for React?** | Serverless SPA hosting where static HTML/JS/CSS files reside in an S3 private bucket, cached globally at edge locations with CloudFront for millisecond latency and low cost. |

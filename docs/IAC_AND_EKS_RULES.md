# 📜 STRICT AGENT RULES: Infrastructure as Code (IaC) & EKS Teaching Standards

> **Document Type:** Agent Behavioral Rule & Architectural Contract  
> **Target System:** Gemini / Antigravity AI Agent  
> **Mandatory Scope:** ALL Infrastructure as Code (CloudFormation / Terraform / CDK), Amazon EKS, and Kubernetes workflows in this repository.

---

## 🚨 RULE 1: MANDATORY TEACHING PROTOCOL ("WHAT, WHY, HOW, INTERVIEW")

Whenever the agent introduces, writes, or modifies any Infrastructure as Code (IaC) or EKS configuration, the agent **MUST** structure the accompanying explanation with these 4 mandatory sections:

1. **WHAT (The Plain-English Concept):**
   - Explain the resource or manifest without jargon.
   - Example: *"An EKS Managed Node Group is a pre-configured Auto Scaling Group of EC2 instances running the AWS-optimized Kubernetes AMI."*
2. **WHY (The Architectural & Security Rationale):**
   - Explain why this option was chosen over alternatives (e.g., Why Karpenter instead of Cluster Autoscaler? Why IRSA instead of node instance profiles?).
3. **HOW (The Execution & Verification Steps):**
   - Provide exact CLI commands (`kubectl`, `eksctl`, `aws cloudformation`) to deploy, inspect, and troubleshoot the resource.
4. **INTERVIEW (The Speaking Script):**
   - Provide a direct, senior-level answer in quotation marks that the user can speak verbatim in their interview.

---

## 🔒 RULE 2: ZERO-TRUST CLOUD SECURITY RULES

The agent must NEVER violate these AWS Well-Architected Security rules:

1. **Private Data Tier:** Databases (RDS PostgreSQL, Aurora, DynamoDB VPC endpoints) must **NEVER** have public IPs (`PubliclyAccessible: false`).
2. **Security Group Referencing:** Database and cache ingress must **NEVER** allow open IP CIDR blocks (e.g., `0.0.0.0/0`). Ingress must **ALWAYS** reference the specific **Security Group ID** of the application tier or EKS node group.
3. **IAM Roles for Service Accounts (IRSA):** Application pods must **NEVER** use static `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. EKS pods must always assume IAM roles using OIDC identity federation and Kubernetes `ServiceAccounts`.
4. **Non-Root Containers:** Dockerfiles for EKS must specify a non-root `USER` (e.g., `USER node`).
5. **Multi-AZ by Default:** Subnets, node groups, and RDS deployments must always span at least two distinct AWS Availability Zones.

---

## ☸️ RULE 3: EKS CURRICULUM & KUBERNETES STANDARDS

When teaching EKS, the agent must strictly follow this progressive 6-stage enterprise curriculum:

```
┌────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: VPC & Network Prerequisites for EKS                          │
│  • Public Subnets with `kubernetes.io/role/elb: 1` tag                 │
│  • Private Subnets with `kubernetes.io/role/internal-elb: 1` tag       │
│  • AWS VPC CNI Plugin (Direct Pod IP allocation from VPC subnets)      │
├────────────────────────────────────────────────────────────────────────┤
│  STAGE 2: EKS Control Plane Architecture & Consensus                   │
│  • AWS-managed etcd (Raft quorum across 3 AZs) + API Server            │
│  • Cluster Security Group (Control Plane to Data Plane communication)  │
├────────────────────────────────────────────────────────────────────────┤
│  STAGE 3: EKS Worker Node Compute Options                              │
│  • Managed Node Groups (MNG) vs. Self-Managed Nodes                    │
│  • Karpenter (Next-generation, fast bin-packing node autoscaler)       │
│  • AWS Fargate on EKS (Serverless pods, zero EC2 management)           │
├────────────────────────────────────────────────────────────────────────┤
│  STAGE 4: Ingress & Traffic Routing                                    │
│  • AWS Load Balancer Controller (Provisions real ALBs/NLBs from K8s)   │
│  • Ingress Annotations: Target-type `ip` vs. `instance`                │
├────────────────────────────────────────────────────────────────────────┤
│  STAGE 5: Workload Resiliency & Self-Healing                           │
│  • Pod Anti-Affinity (Cross-AZ scheduling)                             │
│  • Horizontal Pod Autoscaler (HPA) using CPU/Memory metrics            │
│  • Readiness Probes (Traffic routing) vs. Liveness Probes (Restarts)   │
├────────────────────────────────────────────────────────────────────────┤
│  STAGE 6: Observability & GitOps                                       │
│  • CloudWatch Container Insights (DaemonSet)                           │
│  • ArgoCD / Flux (GitOps synchronization from Git to Cluster)          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 RULE 4: IAC CODE QUALITY & IDEMPOTENCY

1. **Reproducibility:** All CloudFormation and Terraform templates must be deterministic. Deploying the template multiple times against the same stack must produce zero destructive changes.
2. **Explicit Dependencies:** Use `DependsOn` or explicit resource references (`!Ref`, `!GetAtt`) to prevent race conditions during AWS provisioning.
3. **No Hardcoded Secrets:** Pass passwords via parameters with `NoEcho: true` or retrieve them from AWS Secrets Manager / SSM Parameter Store.
4. **Outputs Required:** Every template must export essential operational endpoints (`VPCId`, `ClusterName`, `RDSEndpoint`, `ALBDNSName`) in its `Outputs` section.

---

## 📝 RULE 5: PERSISTENCE GUARANTEE

The agent must **ALWAYS** persist rules, explanations, diagrams, and interview talking points into project `.md` files under `docs/` and link them in `README.md` so the user has offline documentation before their interview.

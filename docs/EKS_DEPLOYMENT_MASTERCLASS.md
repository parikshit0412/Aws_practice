# 🚀 Enterprise EKS Deployment Masterclass: Stage-by-Stage

> **Teaching Standard:** Adheres strictly to [`docs/IAC_AND_EKS_RULES.md`](./IAC_AND_EKS_RULES.md).  
> **Structure per Stage:** **WHAT** $\rightarrow$ **WHY** $\rightarrow$ **HOW** $\rightarrow$ **INTERVIEW SCRIPT**.

---

## 🗺️ The Complete 6-Stage Deployment Roadmap

```
[ Stage 1: VPC & EKS Subnet Tagging ]
                 │
                 ▼
[ Stage 2: Provision EKS Cluster & IAM OIDC ]
                 │
                 ▼
[ Stage 3: Managed Worker Nodes & Karpenter ]
                 │
                 ▼
[ Stage 4: Deploy AWS Load Balancer Controller ]
                 │
                 ▼
[ Stage 5: Deploy Node.js BFF (Config, Secrets, Deployment, Ingress) ]
                 │
                 ▼
[ Stage 6: Deploy React SPA (S3 + CloudFront Edge CDN) ]
```

---

## 🔵 STAGE 1: VPC & EKS Subnet Tagging

### 1. WHAT (The Plain-English Concept)
Before an EKS cluster can exist, it needs a Virtual Private Cloud (VPC) with at least **2 public subnets** and **2 private subnets** spanning across 2 different Availability Zones (e.g., `ap-south-1a` and `ap-south-1b`).
- **Public Subnets:** Will host the external **AWS Application Load Balancer (ALB)**.
- **Private Subnets:** Will host the **EKS Worker Nodes (EC2 instances)** and **RDS PostgreSQL**.

### 2. WHY (The Architectural & Security Rationale)
- **Why do subnets require specific tags?**
  When you create an Ingress in Kubernetes (`kind: Ingress`), the **AWS Load Balancer Controller** reads the AWS API to figure out where to provision the ALB. It does this by searching for these two required tags:
  - `kubernetes.io/role/elb: 1` $\rightarrow$ Attached to **Public Subnets** (tells AWS: *"Deploy internet-facing ALBs here"*).
  - `kubernetes.io/role/internal-elb: 1` $\rightarrow$ Attached to **Private Subnets** (tells AWS: *"Deploy internal microservice load balancers here"*).
- **Security:** Placing EKS worker nodes in private subnets ensures they have **zero public IP addresses**, preventing direct internet attacks. Outbound internet access (to download Docker images from ECR or npm packages) flows through an **AWS NAT Gateway**.

### 3. HOW (The Manifest & CLI Execution)
We declare this in CloudFormation or deploy using `eksctl`:

```yaml
# eks-cluster-config.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: fullstack-eks-cluster
  region: ap-south-1
  version: "1.29"

vpc:
  cidr: 10.0.0.0/16
  subnets:
    public:
      ap-south-1a:
        id: subnet-public-1
      ap-south-1b:
        id: subnet-public-2
    private:
      ap-south-1a:
        id: subnet-private-1
      ap-south-1b:
        id: subnet-private-2
```

Command to inspect subnet tags:
```bash
aws ec2 describe-subnets \
  --filters "Name=tag:kubernetes.io/role/elb,Values=1" \
  --query "Subnets[*].[SubnetId,CidrBlock,AvailabilityZone]" \
  --region ap-south-1
```

### 4. 🎙️ INTERVIEW SCRIPT
> *"When designing the network foundation for Amazon EKS, we configure a custom VPC spanning a minimum of two Availability Zones for high availability. We separate our compute tier into private subnets, routed through NAT Gateways for secure egress.*
> 
> *To enable automatic load balancer provisioning, we tag our public subnets with `kubernetes.io/role/elb = 1`. This allows the AWS Load Balancer Controller to dynamically discover public subnets and bind external ALBs directly to our Kubernetes ingress rules without manual network configuration."*

---

## 🟢 STAGE 2: Provision EKS Cluster & IAM OIDC Provider

### 1. WHAT (The Plain-English Concept)
- **The EKS Control Plane:** Consists of the Kubernetes API Server, Controller Manager, Scheduler, and `etcd`. In AWS EKS, AWS fully manages this in their own VPC.
- **IAM OIDC Provider:** Creates a cryptographic bridge between Kubernetes identities (`ServiceAccount`) and AWS IAM roles.

### 2. WHY (The Architectural & Security Rationale)
- **Why OIDC / IRSA (IAM Roles for Service Accounts)?**
  - *The Old / Insecure Way:* Giving the EC2 worker node an IAM role with S3, SQS, and RDS permissions. This meant **ANY pod** running on that EC2 instance could access everything (violates least privilege).
  - *The Modern EKS Way (IRSA):* We associate an IAM role directly with a single Kubernetes `ServiceAccount`. Only the `node-bff` pod gets permissions to talk to SQS or RDS; all other pods on the same node get zero access.

### 3. HOW (The CLI Execution)
Create the cluster using `eksctl` (or CloudFormation):

```bash
# 1. Create EKS Cluster
eksctl create cluster \
  --name fullstack-eks-cluster \
  --region ap-south-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 6 \
  --managed

# 2. Associate IAM OIDC Identity Provider (Enables IRSA)
eksctl utils associate-iam-oidc-provider \
  --cluster fullstack-eks-cluster \
  --approve \
  --region ap-south-1

# 3. Verify kubectl connection to the EKS cluster
kubectl get nodes
```

### 4. 🎙️ INTERVIEW SCRIPT
> *"In Amazon EKS, the control plane is fully managed by AWS across three Availability Zones with automated etcd quorum maintenance and patching.*
> 
> *For workload security, our immediate post-provisioning step is enabling an IAM OIDC Identity Provider. This unlocks **IAM Roles for Service Accounts (IRSA)**. Instead of assigning broad IAM permissions to the underlying EC2 nodes, we bind least-privilege IAM roles directly to individual Kubernetes ServiceAccounts, ensuring strict credential isolation at the pod level."*

---

## 🟡 STAGE 3: Managed Worker Nodes & Karpenter Auto-Scaling

### 1. WHAT (The Plain-English Concept)
- **Managed Node Group (MNG):** AWS automates provisioning, rolling updates, and draining of EC2 worker instances.
- **Karpenter:** An open-source, high-performance Kubernetes node autoscaler designed by AWS.

### 2. WHY (The Architectural & Security Rationale)
- **Why Karpenter instead of Cluster Autoscaler?**
  - *Cluster Autoscaler:* Slower. Requires pre-defining static EC2 Auto Scaling Groups for each instance type (e.g., ASG for `t3.medium`, ASG for `m5.large`). Takes 3–5 minutes to add a node.
  - *Karpenter:* Bypasses Auto Scaling Groups entirely. It inspects pending pods, evaluates their exact CPU/memory requests, calculates the most cost-effective EC2 instance (including **Spot instances** saving up to 90%), launches the instance in **under 45 seconds**, and packs pods efficiently (bin-packing).

### 3. HOW (The Manifest & CLI Execution)

Inspect running worker nodes in EKS:
```bash
kubectl get nodes -o wide -L topology.kubernetes.io/zone,node.kubernetes.io/instance-type
```

A Karpenter NodePool definition:
```yaml
# karpenter-nodepool.yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"] # Spot instances first for 80% cost savings
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64", "arm64"]   # Support cheap AWS Graviton instances
      nodeClassRef:
        name: default
```

### 4. 🎙️ INTERVIEW SCRIPT
> *"For the data plane, we deploy EKS Managed Node Groups with Karpenter for intelligent, fast horizontal compute scaling.*
> 
> *Unlike the traditional Kubernetes Cluster Autoscaler which relies on static Auto Scaling Groups, Karpenter provisions rightsized EC2 instances directly via AWS fleet APIs in seconds. It prioritizes Spot instances and Graviton ARM architectures for non-critical workloads, cutting our compute infrastructure costs by up to 70% while bin-packing pods with minimal CPU waste."*

---

## 🟠 STAGE 4: Deploy the AWS Load Balancer Controller

### 1. WHAT (The Plain-English Concept)
The **AWS Load Balancer Controller** is a Kubernetes operator (a controller running inside your cluster) that watches for Kubernetes `Ingress` resources and automatically creates, configures, and deletes real **AWS Application Load Balancers (ALBs)** in your AWS account.

### 2. WHY (The Architectural & Security Rationale)
- **Target-Type: IP (The Cloud-Native Way):**
  - *Old Way (`target-type: instance`):* ALB sends traffic to EC2 worker nodes on a `NodePort`, which then hops through `kube-proxy` (IPVS/iptables) to reach the pod. This adds an extra network hop and causes latency.
  - *Modern EKS Way (`target-type: ip`):* Through the **AWS VPC CNI**, every pod gets its own private IP directly from the VPC subnet. The ALB routes traffic **directly to the pod IP**, bypassing NodePort entirely!

### 3. HOW (The Helm Execution)

```bash
# 1. Download IAM policy for the Controller
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

# 2. Create IAM Role with IRSA for the controller
eksctl create iamserviceaccount \
  --cluster=fullstack-eks-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::123456789012:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# 3. Install controller via Helm
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=fullstack-eks-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 4. 🎙️ INTERVIEW SCRIPT
> *"We manage ingress traffic using the **AWS Load Balancer Controller**. When an Ingress manifest is applied, the controller provisions an AWS Application Load Balancer.*
> 
> *Crucially, we configure `alb.ingress.kubernetes.io/target-type: ip`. Because the AWS VPC CNI assigns native VPC IP addresses directly to each pod, the ALB routes traffic straight to the pod containers. This eliminates the double-hop latency and bandwidth overhead of traditional NodePort routing."*

---

## 🟣 STAGE 5: Deploy the Node.js BFF Application Tier

### 1. WHAT (The Plain-English Concept)
This stage deploys our backend code onto the EKS cluster:
1. `ConfigMap` $\rightarrow$ General environment settings.
2. `Secret` $\rightarrow$ Database credentials and JWT secrets.
3. `Deployment` $\rightarrow$ 3 replica pods with health probes and resource limits.
4. `Service` $\rightarrow$ Internal ClusterIP routing.
5. `Ingress` $\rightarrow$ Public HTTPS routing rules mapped to the ALB.

### 2. WHY (The Architectural & Security Rationale)
- **Pod Anti-Affinity:** Prevents Kubernetes from putting all 3 pods onto the same node or in the same Availability Zone.
- **Readiness vs. Liveness Probes:**
  - `readinessProbe` checks `/api/health`. If the database drops, Kubernetes immediately stops sending traffic to this pod without crashing it.
  - `livenessProbe` detects process deadlocks and restarts the container.

### 3. HOW (Applying the Existing Project Manifests)

Run these commands using the files we created:

```bash
# 1. Apply Deployment (includes ConfigMap, Secret, Pod Anti-Affinity)
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# 2. Apply Service, ALB Ingress, and HPA
kubectl apply -f infrastructure/kubernetes/service-ingress-hpa.yaml

# 3. Verify Rollout Status
kubectl rollout status deployment/node-bff-deployment -n production

# 4. Get the Live Public Load Balancer URL:
kubectl get ingress node-bff-ingress -n production -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 4. 🎙️ INTERVIEW SCRIPT
> *"Our Node.js BFF backend is deployed as a Kubernetes Deployment running across three replicas with `PodAntiAffinity` rules to guarantee physical distribution across AWS Availability Zones.*
> 
> *We configure rolling update strategies with `maxSurge: 1` and `maxUnavailable: 0` to achieve zero-downtime releases.*
> 
> *Each pod is constrained with CPU and memory requests and limits to prevent noisy-neighbor memory saturation, and integrated with `/api/health` readiness probes so pods only receive production traffic when database pools are fully initialized."*

---

## 🟤 STAGE 6: Deploy React SPA (S3 + CloudFront Edge CDN)

### 1. WHAT (The Plain-English Concept)
Instead of serving static HTML/JS/CSS files from expensive Node.js servers or EC2 instances, we build the React Vite app into static files and upload them to an **Amazon S3 private bucket**, fronted by **AWS CloudFront (CDN)**.

### 2. WHY (The Architectural & Security Rationale)
- **Cost:** S3 static hosting costs pennies (~$0.50/month), whereas running EC2/containers 24/7 to serve HTML costs $20–$50/month.
- **Speed (Latency):** CloudFront caches your React JavaScript bundles in **400+ Edge Locations** worldwide. A user in London downloads assets in 15ms from a local cache rather than waiting for traffic to travel to Mumbai (`ap-south-1`).
- **Security:** S3 is 100% private using **CloudFront Origin Access Control (OAC)**. Users cannot access S3 directly; all traffic is forced through CloudFront WAF.

### 3. HOW (The Build & Deployment Commands)

```bash
# 1. Build the production React application
cd client
npm run build # Generates the dist/ folder

# 2. Sync to private S3 bucket
aws s3 sync dist/ s3://my-production-react-spa-bucket --delete --region ap-south-1

# 3. Invalidate CloudFront cache so users immediately get the new version
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### 4. 🎙️ INTERVIEW SCRIPT
> *"For our frontend, we decouple static asset delivery from backend compute. We build our React TypeScript SPA and host the static assets in an Amazon S3 bucket protected with Origin Access Control (OAC).*
> 
> *We front S3 with **Amazon CloudFront CDN** and AWS WAF at the edge. This guarantees sub-50ms Time-to-First-Byte (TTFB) globally, offloads static asset traffic completely from our backend pods, and delivers high availability at near-zero hosting cost."*

---

## 🏁 Summary Table: What to Review Before the Interview

| Stage | Tech Component | Core Keyword to Mention in Interview |
|---|---|---|
| **Stage 1** | VPC & Subnets | Subnet tags `kubernetes.io/role/elb: 1`, Multi-AZ, NAT Gateways |
| **Stage 2** | EKS Control Plane | AWS-managed etcd consensus, IAM OIDC Provider, **IRSA** |
| **Stage 3** | Data Plane Compute | **Karpenter** for fast bin-packing, Spot instance cost optimization |
| **Stage 4** | Ingress Routing | AWS Load Balancer Controller, direct pod routing via `target-type: ip` |
| **Stage 5** | Node BFF Tier | Pod Anti-Affinity, zero-downtime rolling update, Readiness Probes |
| **Stage 6** | React Frontend | S3 static hosting + **CloudFront CDN** + Origin Access Control (OAC) |

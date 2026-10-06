# 🏗️ AWS IaC (Infrastructure as Code) Complete Guide & Interview Preparation

> **Template File:** `infrastructure/cloudformation/secure-vpc-architecture.yaml`  
> **Key Objective:** Understand **WHAT** this IaC does, **WHY** it is designed this way, **HOW** to execute it, and **WHAT TO SAY** in your interview.

---

## 🧭 1. WHAT is AWS CloudFormation IaC?

Instead of logging into the AWS Console and clicking 50 buttons to manually create VPCs, subnets, databases, and EC2 instances:
- **Infrastructure as Code (IaC)** allows you to declare all AWS infrastructure in a single YAML or JSON file.
- When submitted to AWS, AWS automatically provisions all resources in the correct dependency order (e.g., creates VPC $\rightarrow$ creates Subnets $\rightarrow$ creates RDS $\rightarrow$ launches EC2).
- **If anything fails**, AWS performs an automatic **Rollback**, deleting partially created resources so you are never left with orphaned, billing infrastructure.

---

## 🎯 2. WHAT Does Our CloudFormation Template Create?

Our template (`secure-vpc-architecture.yaml`) provisions the complete production stack:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Virtual Private Cloud (VPC): 10.0.0.0/16                                               │
│                                                                                        │
│  ┌────────────────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Public Subnet (10.0.1.0/24)            │  │ Private Subnets (10.0.10.0 & 20.0)   │  │
│  │                                        │  │                                      │  │
│  │  [ Node.js BFF EC2 Instance ]          │  │  [ Amazon RDS PostgreSQL ]          │  │
│  │  • Has Public IP                       │  │  • Allocated 20 GB gp3               │  │
│  │  • Runs Node.js 20 + PM2               │  │  • PubliclyAccessible: false (100%)  │  │
│  │  • Security Group: WebServerSG         │  │  • Security Group: DatabaseSG        │  │
│  └───────────────────┬────────────────────┘  └──────────────────▲───────────────────┘  │
│                      │                                          │                      │
│                      └───────────── Private VPC Routing ────────┘                      │
│                                (Inbound Port 5432 ONLY from                            │
│                                 WebServerSecurityGroup ID)                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **VPC Network:** A dedicated VPC (`10.0.0.0/16`) with DNS support enabled.
2. **Internet Gateway & Route Tables:** Attached to the public subnet so users can access your Node.js API.
3. **Public Subnet:** Where your Node.js BFF server resides.
4. **Two Private Subnets (in 2 AZs):** AWS RDS requires at least 2 Availability Zones for its `DBSubnetGroup` to support automated backups and failover.
5. **Zero-Trust Security Groups:**
   - `WebServerSecurityGroup`: Allows inbound HTTP (80) and Node API (4000).
   - `DatabaseSecurityGroup`: Allows inbound PostgreSQL (5432) **strictly from `WebServerSecurityGroup`**.
6. **Amazon RDS PostgreSQL Instance:** `PubliclyAccessible: false`. 0% chance of brute-force attacks from the internet.
7. **Automated UserData Script on EC2:**
   - Boots Amazon Linux.
   - Automatically installs **Node.js 20, Git, and PM2**.
   - Dynamically writes `.env` with the newly created private `RDS_HOST` endpoint address!

---

## 💡 3. WHY Did We Design It This Way? (The Architectural "Why")

### Reason 1: Defense-in-Depth (Well-Architected Security Pillar)
- **Problem:** If a database has a public IP address, any script kiddie or bot on the internet can attempt password cracking or trigger DDoS attacks.
- **Solution:** Setting `PubliclyAccessible: false` and putting RDS in a subnet without an Internet Gateway makes it mathematically impossible to reach from outside AWS.

### Reason 2: Security Group Referencing (Instead of IP Whitelisting)
- **Problem:** IP addresses change. If you scale EC2 instances or replace a damaged server, its IP changes, breaking database firewall rules.
- **Solution:** In our template, line 144 specifies:
  ```yaml
  SourceSecurityGroupId: !Ref WebServerSecurityGroup
  ```
  Any server that AWS launches wearing the `WebServerSecurityGroup` can connect to PostgreSQL immediately.

### Reason 3: Dynamic Wiring via IaC Outputs
- Because CloudFormation knows the database endpoint, it passes `!GetAtt RDSInstance.Endpoint.Address` straight into the EC2 instance's `.env` configuration file automatically!

---

## 💻 4. HOW to Run this CloudFormation Template

You can run this template in **one of two ways**:

### Option A: Via AWS Console (Visual & Beginner-Friendly)
1. Open the [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation/home?region=ap-south-1).
2. Click **Create stack** $\rightarrow$ **With new resources (standard)**.
3. Under **Specify template**:
   - Choose **Upload a template file**.
   - Click **Choose file** $\rightarrow$ Select `d:\ReactPlayProjects\congnizent_interview\AwS_practice\infrastructure\cloudformation\secure-vpc-architecture.yaml`.
4. Click **Next**:
   - Stack name: `fullstack-production-stack`
   - Master Password: Enter your password (e.g., `MySecurePass2026!`).
5. Click **Next** $\rightarrow$ Click **Submit**.
6. Watch CloudFormation create all resources in ~8 minutes!
7. Check the **Outputs** tab: AWS will display your live **`RDSEndpoint`** and **`EC2PublicIP`**.

---

### Option B: Via AWS CLI (One Single Command)
Open PowerShell or your terminal and run:

```bash
aws cloudformation create-stack \
  --stack-name fullstack-production-stack \
  --template-body file://infrastructure/cloudformation/secure-vpc-architecture.yaml \
  --parameters ParameterKey=DBPassword,ParameterValue="MySecurePass2026!" \
  --region ap-south-1
```

To see the outputs once created:
```bash
aws cloudformation describe-stacks \
  --stack-name fullstack-production-stack \
  --query "Stacks[0].Outputs" \
  --region ap-south-1
```

---

## 🎙️ 5. What to Say in the Interview Tomorrow

When the interviewer asks:
> *"How do you manage and provision cloud infrastructure for your applications?"*

**Answer:**

> *"We treat our infrastructure as code (IaC) using AWS CloudFormation and Terraform.*
> 
> *Our template provisions an isolated VPC with a strict public-private tier separation:*
> 1. *Our Node.js BFF runs in a public subnet, protected by a Web Server Security Group that allows inbound HTTP traffic on port 4000.*
> 2. *Our Amazon RDS PostgreSQL instance is deployed into private data subnets across two Availability Zones with `PubliclyAccessible: false`.*
> 3. *For network authorization, we use **Security Group Referencing**: the database firewall only permits ingress on port 5432 from the specific Security Group ID of our application tier.*
> 4. *The EC2 instance is bootstrapped via CloudFormation `UserData` to automatically install Node.js and dynamically inject the private RDS endpoint address.*
> 
> *This ensures that every environment—development, staging, or production—can be spun up deterministically with zero manual configuration drift and zero public internet exposure to our database."*

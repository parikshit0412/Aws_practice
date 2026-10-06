# 🔒 Secure Production AWS VPC Architecture: EC2/EKS to Private RDS

> **Interview Essential:** This is the **#1 industry-standard security pattern** recommended by the AWS Well-Architected Framework.  
> **Rule:** The database must **NEVER** have a public IP or be exposed to the public internet (`Publicly Accessible: No`).

---

## 🏛️ The Target Architecture: Same Region, Same VPC

```
AWS REGION: ap-south-1 (Mumbai)
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Virtual Private Cloud (VPC): vpc-07155e324bb183592                                               │
│                                                                                                  │
│  ┌────────────────────────────────────────┐  ┌────────────────────────────────────────────────┐  │
│  │ Public Subnet (subnet-02082761197bd6)  │  │ Private Database Subnet                        │  │
│  │                                        │  │                                                │  │
│  │  [ Node.js BFF Server / EKS Pods ]     │  │  [ Amazon RDS PostgreSQL ]                     │  │
│  │  Security Group: sg-web-server         │  │  Security Group: sg-rds-db                     │  │
│  │  • Receives User Requests              │  │  • Inbound: Port 5432 ONLY from sg-web-server  │  │
│  │  • Writes initial PENDING order        │  │  • Zero Public Internet Access                 │  │
│  └───────────────────┬────────────────────┘  └───────────────────▲────────────────────────────┘  │
│                      │                                           │                               │
│                      │ 1. Synchronous Transaction                │ 3. Updates Status to          │
│                      │    via Private Subnet Route               │    PROCESSING in Transaction  │
│                      │                                           │                               │
│                      │ 2. Asynchronous Event Offload             │                               │
│                      ▼                                           │                               │
│             ┌─────────────────┐                                  │                               │
│             │   Amazon SQS    │                                  │                               │
│             │  (Order Queue)  │                                  │                               │
│             └────────┬────────┘                                  │                               │
│                      │ Event Trigger                             │                               │
│                      ▼                                           │                               │
│             ┌─────────────────┐                                  │                               │
│             │   AWS Lambda    │──────────────────────────────────┘                               │
│             │  (processOrder) │ (Serverless Distributed Worker)                                  │
│             └────────┬────────┘                                                                  │
│                      │ 4. Publishes Notification Event                                           │
│                      ▼                                                                           │
│             ┌─────────────────┐       ┌─────────────────┐                                        │
│             │   Amazon SNS    │──────▶│   AWS Lambda    │──▶ Amazon SES                          │
│             │ (Notifications) │       │ (sendEmail)     │    (Customer Inbox)                    │
│             └─────────────────┘       └─────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Step-by-Step Guide: How to Host & Connect Securely

---

### Step 1: Create Two Security Groups in the Same VPC

Go to **AWS Console** $\rightarrow$ **VPC** $\rightarrow$ **Security Groups**. Ensure your region is **ap-south-1 (Mumbai)** and select your database VPC: **`vpc-07155e324bb183592`**.

#### 1. Create `sg-web-server` (For your EC2 Node.js BFF)
- **Name:** `sg-web-server`
- **VPC:** `vpc-07155e324bb183592`
- **Inbound Rules:**
  - **SSH (Port 22):** Source: `My IP`
  - **Custom TCP (Port 4000):** Source: `0.0.0.0/0` (Node.js API)
  - **HTTP (Port 80):** Source: `0.0.0.0/0`
- Click **Create security group** and copy its ID (e.g., `sg-0abc...`).

#### 2. Configure `sg-rds-db` (Your existing RDS Security Group: `sg-0fde2f917ce353fb9`)
- Open security group: **`sg-0fde2f917ce353fb9`**.
- Click **Edit inbound rules** $\rightarrow$ **Add rule**:
  - **Type:** `PostgreSQL`
  - **Port:** `5432`
  - **Source:** Select **`sg-web-server`** (the Security Group ID you just created!).
- Click **Save rules**.
  *(👉 THIS IS THE MAGIC: Only instances wearing the `sg-web-server` badge can talk to PostgreSQL. Zero public internet exposure!)*

---

### Step 2: Launch a Free-Tier EC2 Instance in the Same VPC

1. Go to [EC2 Console (ap-south-1)](https://console.aws.amazon.com/ec2/home?region=ap-south-1).
2. Click **Launch Instance**:
   - **Name:** `node-bff-server`
   - **OS:** **Amazon Linux 2023** (Free Tier eligible)
   - **Instance type:** `t3.micro` or `t2.micro`
   - **Key pair:** Proceed without a key pair (or select an existing key if you prefer SSH). You can use **EC2 Instance Connect** in the browser with 1 click!
3. **Network Settings (Click Edit):**
   - **VPC:** Select **`vpc-07155e324bb183592`** (Your exact database VPC!)
   - **Subnet:** Select **`subnet-02082761197bd6ed5`** (Public Subnet in `ap-south-1a`)
   - **Auto-assign public IP:** `Enable`
   - **Select existing security group:** Choose **`sg-web-server`**
4. Click **Launch instance**.

---

### Step 3: Connect to EC2 & Set Up Node.js

Once your EC2 instance says **Running**, connect via SSH or **EC2 Instance Connect** (right in the browser with 1 click!).

Run these commands inside your EC2 terminal:

```bash
# 1. Update packages
sudo apt update -y || sudo dnf update -y

# 2. Install Node.js 20 & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git || sudo dnf install -y nodejs git

# Verify
node -v # v20.x
npm -v
```

---

### Step 4: Clone / Copy the Project & Run the Migration Inside the VPC

Inside your EC2 server:

```bash
# 1. Clone your project (or scp the folder)
git clone <your-repo-url> app
cd app/server

# 2. Install dependencies
npm install

# 3. Configure the .env file with your RDS credentials
cat << 'EOF' > .env
PORT=4000
NODE_ENV=production
RDS_HOST=aws-fullstack-db.c368ayysy4vj.ap-south-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DB=aws_fullstack_db
RDS_USER=postgres
RDS_PASS=MySecurePass2026!
JWT_SECRET=production-secret-key-123456789
EOF

# 4. RUN THE MIGRATION SCRIPT INSIDE THE VPC!
npx tsx src/scripts/migrateAndSeed.ts
```

Because EC2 and RDS live inside the **same private VPC network**:
- **0 network latency** (under 1 millisecond).
- **Zero public internet exposure.**
- The migration script connects instantly, creates the tables (`users`, `orders`, `audit_logs`), and seeds the data!

---

### Step 5: Start the BFF Server with PM2 (Production Process Manager)

```bash
# Install PM2 for auto-restart on crashes
sudo npm install -g pm2

# Build TypeScript to JavaScript
npm run build

# Start server as a background daemon
pm2 start dist/server.js --name "node-bff"

# Ensure PM2 restarts on server reboot
pm2 startup
pm2 save
```

Your API is now live at: `http://<YOUR-EC2-PUBLIC-IP>:4000/api/health` and `http://<YOUR-EC2-PUBLIC-IP>:4000/api/orders`.

---

## 🎙️ Exact Interview Speaking Script for Tomorrow

When the interviewer asks:
> *"How do you securely connect application containers/instances to Amazon RDS without exposing the database to the internet?"*

**Memorize and say this:**

> *"We strictly adhere to the AWS Well-Architected Security Pillar by never exposing RDS to the public internet.*
> 
> 1. **VPC Segmentation:** *We place Amazon RDS PostgreSQL in private isolated data subnets across multiple Availability Zones with `Publicly Accessible: No`.*
> 2. **Security Group Referencing (Zero-Trust Network):** *Rather than allowing IP ranges (CIDR blocks), the RDS Security Group only permits inbound traffic on Port 5432 from the specific **Security Group ID** of our application servers (`sg-web-server` or our EKS Node Security Group).*
> 3. **Internal Routing:** *Our Node.js BFF runs within the same VPC in ap-south-1. Traffic travels over AWS's private high-speed backbone without leaving the VPC or traversing the public internet.*
> 4. **No Inbound Internet:** *The database has no public IP, no route to the Internet Gateway, and cannot be reached externally—preventing brute-force attacks and port scanning entirely."*

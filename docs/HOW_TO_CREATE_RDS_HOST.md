# 🗄️ How to Create and Get your RDS_HOST in AWS

> **Topic:** Provisioning Amazon RDS PostgreSQL & RDS Proxy  
> **Key Objective:** Know how to create the database in AWS Console or via AWS CLI, and know exactly what to say in your interview.

---

## 📌 What is `RDS_HOST`?

`RDS_HOST` is simply the **DNS endpoint URL** that AWS assigns to your database instance or RDS Proxy. It looks like:
- Direct RDS Database:  
  `mydb-instance.c1234567890.us-east-1.rds.amazonaws.com`
- Recommended with RDS Proxy:  
  `mydb-proxy.proxy-c1234567890.us-east-1.rds.amazonaws.com`

---

## 🛠️ Step-by-Step: How to Create It in AWS Console (Free Tier Eligible)

### Step 1: Open Amazon RDS Console
1. Log in to [AWS Management Console](https://console.aws.amazon.com/rds).
2. Ensure you are in your desired region (e.g., **us-east-1 (N. Virginia)**).
3. Click the orange button: **"Create database"**.

---

### Step 2: Choose Engine & Templates
1. **Database creation method:** Choose **Standard create**.
2. **Engine options:** Choose **PostgreSQL**.
3. **Engine Version:** Select **PostgreSQL 15.x** or **16.x**.
4. **Templates:**
   - For practice/free tier: Choose **Free tier**.
   - For production interview answers: Always say **Production** (enables Multi-AZ).

---

### Step 3: Set Instance Settings & Credentials
1. **DB instance identifier:** `aws-fullstack-db` (the friendly name for your DB).
2. **Master username:** `postgres` (or `app_user`).
3. **Master password:** Choose a strong password (e.g. `MySecurePass2026!`).

---

### Step 4: Configure Instance Size & Storage
1. **DB instance class:**
   - Free tier / Dev: `db.t3.micro` or `db.t4g.micro` (AWS Graviton - cheaper!).
   - Production: `db.r6g.large` (Memory optimized).
2. **Storage:**
   - Type: `General Purpose SSD (gp3)`.
   - Allocated storage: `20 GiB` (Free tier limit).

---

### Step 5: Network & VPC Security (Crucial for Interviews!)
1. **Virtual Private Cloud (VPC):** Select your app VPC (e.g., `prod-vpc`).
2. **DB Subnet group:** Choose your private data subnet group.
3. **Public access:**
   - Choose **No** (best security practice — accessible only from within the VPC via EKS/EC2/Lambda).
   - *Note:* If you want to connect from your local laptop pgAdmin/DBeaver without a VPN or bastion host, select **Yes** (and restrict security group to your personal IP).
4. **VPC security group:** Choose or create a new Security Group:
   - Name: `rds-postgres-sg`
   - Inbound Rule: **Type: PostgreSQL**, **Port: 5432**, **Source:** Security Group of your Node.js EKS pods or your IP.

---

### Step 6: Additional Database Configuration
1. Expand **Additional configuration**.
2. **Initial database name:** `aws_fullstack_db` (this creates the actual SQL database inside the server).
3. **Backup:** Leave **Enable automated backups** checked (7–35 days retention).
4. Click **Create database** at the bottom.
5. Wait 5–10 minutes for the status to change from `Creating` to `Available`.

---

### Step 7: How to Copy your `RDS_HOST`
1. In the RDS Console, click on your new database: `aws-fullstack-db`.
2. Look at the tab **"Connectivity & security"**.
3. Under **Endpoint & port**, you will see:
   - **Endpoint:** `aws-fullstack-db.c123456789.us-east-1.rds.amazonaws.com`  👈 **THIS IS YOUR RDS_HOST!**
   - **Port:** `5432`

Paste this endpoint into your `.env`:
```env
RDS_HOST=aws-fullstack-db.c123456789.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DB=aws_fullstack_db
RDS_USER=postgres
RDS_PASS=MySecurePass2026!
```

---

## ⚡ Step 8 (Advanced Production Step): Creating the AWS RDS Proxy

In your interview, explain that you fronted RDS with an **RDS Proxy** for connection pooling:

1. In the left RDS menu, click **Proxies** $\rightarrow$ Click **Create proxy**.
2. **Proxy identifier:** `aws-fullstack-proxy`.
3. **Target group configuration:** Select your database `aws-fullstack-db`.
4. **Authentication:** Select the AWS Secrets Manager secret holding your DB password.
5. **IAM role:** Select an IAM role granting RDS Proxy permission to read the secret.
6. Click **Create proxy**.
7. Once created, copy the **Proxy Endpoint**:
   - `aws-fullstack-proxy.proxy-c123456789.us-east-1.rds.amazonaws.com`

---

## 💻 Alternative: Create it in 1 Command via AWS CLI

If you have the AWS CLI configured:

```bash
# 1. Create a DB subnet group (if not existing)
aws rds create-db-subnet-group \
  --db-subnet-group-name "my-db-subnet-group" \
  --db-subnet-group-description "Private data subnets" \
  --subnet-ids "subnet-01234567" "subnet-89abcdef"

# 2. Launch the PostgreSQL RDS instance
aws rds create-db-instance \
  --db-instance-identifier "aws-fullstack-db" \
  --db-instance-class "db.t3.micro" \
  --engine "postgres" \
  --engine-version "15.4" \
  --master-username "postgres" \
  --master-user-password "MySecurePass2026!" \
  --allocated-storage 20 \
  --db-name "aws_fullstack_db" \
  --db-subnet-group-name "my-db-subnet-group" \
  --backup-retention-period 7 \
  --no-publicly-accessible

# 3. Retrieve the RDS_HOST endpoint once available:
aws rds describe-db-instances \
  --db-instance-identifier "aws-fullstack-db" \
  --query "DBInstances[0].Endpoint.Address" \
  --output text
```

---

## 🎙️ What to Say in the Interview Tomorrow

When the interviewer asks:
> *"How do you provision and connect your backend to AWS RDS PostgreSQL?"*

**Answer:**
> *"We provision Amazon RDS PostgreSQL in private subnets across multiple Availability Zones with automated 7-day backups and encryption at rest using AWS KMS.*
> 
> *Once RDS is provisioned, AWS assigns a DNS **Endpoint address** (e.g., `mydb.cxxxx.us-east-1.rds.amazonaws.com`). For production and serverless Lambda traffic, we attach an **AWS RDS Proxy** to manage connection pooling and prevent `max_connections` exhaustion.*
> 
> *The RDS Proxy endpoint is stored in **AWS Secrets Manager** and injected into our EKS pods via Kubernetes Secrets. The Node.js BFF connects to this endpoint on port 5432 using a connection pool configured with SSL enabled."*

# AWS Full Stack Interview Project

> **React + Node.js BFF + AWS RDS (PostgreSQL) + EKS + Lambda + Monitoring**

A production-ready full-stack application architecture demonstrating all key AWS services for a Full Stack Developer interview.

---

## 📁 Project Structure

```
aws-fullstack-interview-project/
│
├── client/                    # React Frontend (Vite)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page-level components
│   │   ├── services/          # API service layer
│   │   ├── hooks/             # Custom React hooks
│   │   ├── context/           # React Context providers
│   │   └── App.jsx            # Root component
│   └── package.json
│
├── server/                    # Node.js BFF (Express)
│   ├── src/
│   │   ├── routes/            # API route handlers
│   │   ├── middleware/        # Auth, error handling, logging
│   │   ├── config/            # Database & AWS config
│   │   ├── models/            # Database models
│   │   └── server.js          # Entry point
│   └── package.json
│
├── lambda/                    # AWS Lambda Functions
│   ├── processOrder/          # Order processing function
│   ├── sendNotification/      # Email/SMS notification
│   └── package.json
│
├── infrastructure/            # AWS Infrastructure (IaC)
│   ├── kubernetes/            # EKS deployment manifests
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   └── hpa.yaml
│   ├── ecs/                   # ECS task definitions
│   ├── docker/                # Dockerfiles
│   └── cloudformation/        # CloudFormation templates
│
├── monitoring/                # Monitoring & Observability
│   ├── cloudwatch/            # CloudWatch dashboards & alarms
│   └── prometheus/            # Prometheus + Grafana configs
│
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # System architecture deep dive
│   ├── INTERVIEW_QUESTIONS.md # Interview Q&A (SEPARATE FILE)
│   └── AWS_SERVICES.md        # AWS services reference
│
└── README.md                  # This file
```

---

## 🏗️ Architecture

```
                         ┌─────────────┐
                         │  Route 53   │
                         └──────┬──────┘
                                │
                         ┌──────▼──────┐
                         │ CloudFront  │
                         │   + WAF     │
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
             ┌──────▼──────┐        ┌──────▼──────┐
             │   S3 Bucket │        │     ALB     │
             │  React SPA  │        └──────┬──────┘
             └─────────────┘               │
                                    ┌──────▼──────┐
                                    │    EKS      │
                                    │  Node BFF   │
                                    └──────┬──────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                   ┌──────▼──────┐  ┌──────▼──────┐ ┌──────▼──────┐
                   │  RDS Proxy  │  │   Lambda    │ │ ElastiCache │
                   │     ↓       │  │  Functions  │ │   (Redis)   │
                   │    RDS      │  └─────────────┘ └─────────────┘
                   │ PostgreSQL  │
                   └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop
- AWS CLI configured
- kubectl installed

### Run Locally

```bash
# Install all dependencies
npm run install:all

# Start both client and server
npm run dev

# Client: http://localhost:5173
# Server: http://localhost:4000
```

### Environment Variables

Create `.env` files in both `client/` and `server/` directories (see `.env.example` files).

---

## 📚 Interview Preparation

- **[EKS_DEPLOYMENT_MASTERCLASS.md](./docs/EKS_DEPLOYMENT_MASTERCLASS.md)** — Step-by-step EKS deployment guide (WHAT, WHY, HOW, INTERVIEW)
- **[IAC_AND_EKS_RULES.md](./docs/IAC_AND_EKS_RULES.md)** — Strict agent rules & enterprise EKS teaching curriculum
- **[AWS_IAC_GUIDE.md](./docs/AWS_IAC_GUIDE.md)** — CloudFormation IaC: What, Why, How & interview speaking script
- **[SECURE_VPC_HOSTING_GUIDE.md](./docs/SECURE_VPC_HOSTING_GUIDE.md)** — Production VPC security: hosting EC2/EKS in same VPC as Private RDS
- **[HOW_TO_CREATE_RDS_HOST.md](./docs/HOW_TO_CREATE_RDS_HOST.md)** — Step-by-step guide to provisioning Amazon RDS & copying RDS_HOST
- **[CLOUDWATCH_EXPLAINED.md](./docs/CLOUDWATCH_EXPLAINED.md)** — Line-by-line breakdown of CloudWatch Dashboard JSON & Golden Signals
- **[DISTRIBUTED_SYSTEMS.md](./docs/DISTRIBUTED_SYSTEMS.md)** — Distributed systems deep dive, patterns & interview speaking scripts
- **[INTERVIEW_QUESTIONS.md](./docs/INTERVIEW_QUESTIONS.md)** — 50+ questions with detailed answers
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — Full system architecture documentation
- **[AWS_SERVICES.md](./docs/AWS_SERVICES.md)** — AWS services reference guide

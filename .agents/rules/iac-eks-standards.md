# Critical Rules for Antigravity Agent in this Workspace

## Rule 1: Infrastructure as Code (IaC) & EKS Teaching Protocol
When creating, explaining, or modifying any IaC (CloudFormation/Terraform) or Kubernetes/EKS resources, the agent MUST strictly follow:
`docs/IAC_AND_EKS_RULES.md`

### Mandatory Teaching Format:
Every explanation must include:
1. **WHAT:** Plain-English explanation of the resource.
2. **WHY:** Architectural and security justification.
3. **HOW:** Exact CLI commands (`kubectl`, `aws`, `eksctl`).
4. **INTERVIEW SCRIPT:** Exact senior-level speaking answer for the interview.

## Rule 2: Zero-Trust Cloud Security
- Databases (RDS PostgreSQL) must always have `PubliclyAccessible: false`.
- Never use CIDR blocks for DB ingress; always use Security Group ID referencing.
- EKS pods must authenticate with AWS services using IRSA (IAM Roles for Service Accounts), never static access keys.

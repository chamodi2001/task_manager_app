# task_manager_app — Architecture, Deployment & AWS Guide

> Full-stack CRUD application · Django REST Framework · React · PostgreSQL · Docker · AWS EC2 + S3

---

## Table of Contents

1. [Architecture Design](#1-architecture-design)
2. [Deployment Steps](#2-deployment-steps)
3. [IAM Configuration](#3-iam-configuration)
4. [Security Group Rules](#4-security-group-rules)
5. [AWS Free Tier Setup](#5-aws-free-tier-setup)

---

## 1. Architecture Design

### Overview

task_manager_app is a containerised full-stack application deployed on a single AWS EC2 instance. All services run as Docker containers orchestrated by Docker Compose. Nginx acts as the single public entry point, terminating SSL and routing traffic internally to either the React frontend or the Django API.

```
Internet
   │
   ▼
[EC2 Instance — Public IP]
   │
   ├── Port 80  (HTTP)  ──► Nginx ──► 301 redirect to HTTPS
   │
   └── Port 443 (HTTPS) ──► Nginx
                               ├── /api/*  ──► Django (port 8000)
                               ├── /admin/ ──► Django (port 8000)
                               └── /*      ──► React  (port 80, internal)
                                                │
                                         Django ──► PostgreSQL (port 5432, internal only)
                                         Django ──► AWS S3 (file uploads, over HTTPS)
```

### Component Breakdown

**Nginx (Reverse Proxy + SSL Termination)**
Nginx is the only container that exposes public ports (80 and 443). It handles the HTTP→HTTPS redirect, serves Let's Encrypt ACME challenge responses for certificate issuance, and proxies all inbound requests to the correct internal service. It also sets security headers including HSTS.

**Django REST Framework (Backend)**
Runs under Gunicorn with 3 worker processes on port 8000, accessible only on the internal Docker network. Handles all API logic, database access, and S3 file upload orchestration. Django reads all secrets (DB credentials, secret key, AWS keys) from environment variables — nothing is hardcoded.

**React (Frontend)**
Built as a static production bundle during the Docker image build step. The static files are served by a lightweight Nginx instance inside the frontend container on the internal network, not exposed to the outside.

**PostgreSQL (Database)**
Runs as a Docker container on the internal network only. Data is persisted in a named Docker volume (`postgres_data`) so it survives container restarts. The backend connects using environment-variable credentials.

**AWS S3 (File Storage)**
Task attachments are uploaded directly from the Django backend to S3 using `boto3`. When `USE_S3=True`, Django also uses S3 for serving media files. The bucket is private; object access is governed by IAM.

**Certbot (SSL Auto-Renewal)**
Runs as a sidecar container that attempts `certbot renew` every 12 hours. Certificates are stored in the `certbot_conf` Docker volume and mounted read-only into the Nginx container.

### Internal Docker Networks

| Network    | Purpose                                                         |
|------------|-----------------------------------------------------------------|
| `internal` | Backend ↔ DB ↔ Frontend ↔ Nginx — no public access             |
| `external` | Nginx only — has public port bindings (80, 443)                 |

Only the Nginx container belongs to both networks, keeping all other services completely isolated from the internet.

### Data Flow — Creating a Task with Attachment

```
Browser
  │  POST /api/tasks/  (multipart form)
  ▼
Nginx (443) ──► Django (8000)
                  │
                  ├── Validates form data
                  ├── INSERT INTO tasks_task (PostgreSQL)
                  └── boto3.upload_fileobj ──► S3 bucket
                  │
                  └── Returns JSON {id, title, attachment_url, ...}
  ▼
React updates local state — no page reload needed
```

---

## 2. Deployment Steps

### Prerequisites

- A registered domain name with DNS managed (e.g. Route 53, Cloudflare)
- An AWS account (Free Tier is sufficient — see Section 5)
- A GitHub repository with the project code

### Step 1 — Launch EC2 Instance

1. Go to **EC2 → Launch Instance** in the AWS Console.
2. Choose **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type** — the Free Tier eligible AMI.
3. Select **t2.micro** (Free Tier — 1 vCPU, 1 GB RAM).
4. Under **Key pair**, create a new key pair (RSA, .pem format). Download and save it — you'll need it for SSH and for the GitHub Actions secret.
5. Under **Network settings**, select or create a security group — see Section 4 for exact rules.
6. Under **Configure storage**, set 20 GiB gp2 (the Free Tier allows up to 30 GiB).
7. Click **Launch Instance**.
8. Once running, note the **Public IPv4 address**.

### Step 2 — Point Your Domain to EC2

In your DNS provider, create two A records:

| Record | Value              |
|--------|--------------------|
| `@`    | `<EC2 Public IP>`  |
| `www`  | `<EC2 Public IP>`  |

Wait for DNS to propagate (usually 5–15 minutes; confirm with `dig yourdomain.com`).

### Step 3 — Configure the EC2 Server

SSH into your instance:

```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Install Docker and Docker Compose:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git curl
sudo usermod -aG docker ubuntu
newgrp docker   # apply group change without logout
```

Clone the repository:

```bash
sudo git clone https://github.com/YOUR_USERNAME/task_manager_app.git /opt/task_manager_app
sudo chown -R ubuntu:ubuntu /opt/task_manager_app
cd /opt/task_manager_app
```

### Step 4 — Configure Environment Variables on EC2

```bash
cp .env.example .env
nano .env
```

Fill in every value. Minimum required fields for first boot:

```env
DOMAIN=yourdomain.com
CERTBOT_EMAIL=you@example.com
DJANGO_SECRET_KEY=<generate with: python3 -c "import secrets; print(secrets.token_urlsafe(60))">
POSTGRES_DB=task_manager_app
POSTGRES_USER=task_manager_app_user
POSTGRES_PASSWORD=<strong-password>
AWS_ACCESS_KEY_ID=<from IAM — see Section 3>
AWS_SECRET_ACCESS_KEY=<from IAM — see Section 3>
AWS_STORAGE_BUCKET_NAME=<your-bucket-name>
AWS_S3_REGION_NAME=us-east-1
USE_S3=True
GHCR_USER=<your-github-username>
GHCR_TOKEN=<GitHub PAT with read:packages scope>
```

### Step 5 — Issue the First SSL Certificate

This only needs to be done once. The auto-renewal cron handles all subsequent renewals.

```bash
cd /opt/task_manager_app
bash init-ssl.sh
```

This script:
1. Starts Nginx in HTTP-only mode so the ACME challenge endpoint is reachable
2. Runs Certbot via the `certbot` container to obtain certificates from Let's Encrypt
3. Restarts Nginx with the full HTTPS configuration

### Step 6 — First Deploy (Manual)

```bash
cd /opt/task_manager_app
docker compose up -d --build
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py collectstatic --noinput
docker compose ps   # all services should show "running"
```

Visit `https://yourdomain.com` — the task_manager_app UI should load over HTTPS.

### Step 7 — Configure GitHub Actions for Automated Deployments

Add the following secrets to your GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret Name               | Where to get it                                                  |
|---------------------------|------------------------------------------------------------------|
| `EC2_HOST`                | The EC2 Public IPv4 address                                      |
| `EC2_USER`                | `ubuntu`                                                         |
| `EC2_SSH_KEY`             | Full contents of the `.pem` file (including header/footer lines) |
| `DOMAIN`                  | e.g. `task_manager_app.example.com`                                      |
| `CERTBOT_EMAIL`           | Your email for Let's Encrypt alerts                              |
| `DJANGO_SECRET_KEY`       | Same value as in your `.env`                                     |
| `POSTGRES_DB`             | e.g. `task_manager_app`                                                  |
| `POSTGRES_USER`           | e.g. `task_manager_app_user`                                             |
| `POSTGRES_PASSWORD`       | Your DB password                                                 |
| `AWS_ACCESS_KEY_ID`       | IAM user key (see Section 3)                                     |
| `AWS_SECRET_ACCESS_KEY`   | IAM user secret (see Section 3)                                  |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name                                                   |
| `AWS_S3_REGION_NAME`      | e.g. `us-east-1`                                                 |
| `USE_S3`                  | `True`                                                           |
| `GHCR_USER`               | Your GitHub username                                             |
| `GHCR_TOKEN`              | GitHub PAT with `read:packages` scope                            |

### Step 8 — Trigger a Deployment

Push any commit to the `main` branch:

```bash
git add .
git commit -m "chore: trigger first CI/CD deploy"
git push origin main
```

The GitHub Actions pipeline will:
1. Run backend tests against a temporary Postgres container
2. Build and verify the React frontend
3. Build all three Docker images (backend, frontend, nginx) and push them to GHCR
4. SSH into EC2, write the `.env` from secrets, pull the new images, run `docker compose up -d`, and execute migrations

### Verifying the Deployment

```bash
# On EC2 — check all containers are healthy
docker compose ps

# Check backend logs
docker compose logs backend --tail=50

# Check nginx logs
docker compose logs nginx --tail=50

# Test the API directly
curl https://yourdomain.com/api/tasks/
```

---

## 3. IAM Configuration

### Principle of Least Privilege

task_manager_app uses a dedicated IAM user with only the permissions required to operate the S3 bucket. No administrator access, no cross-account permissions, no wildcard service access.

### Step 1 — Create a Dedicated IAM User

1. Go to **IAM → Users → Create user**
2. Name: `task_manager_app-app` (or similar)
3. Select **"Provide user access to the AWS Management Console"** — **No** (this is a programmatic-only user)
4. Click **Next**, skip permissions for now, and create the user

### Step 2 — Create the IAM Policy

Go to **IAM → Policies → Create policy**, choose JSON, and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "task_manager_appS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

Name the policy `task_manager_appS3Policy` and save it.

**Why these permissions and not others:**

| Permission          | Required for                                          |
|---------------------|-------------------------------------------------------|
| `s3:PutObject`      | Uploading task attachment files                       |
| `s3:GetObject`      | Serving/retrieving uploaded files                     |
| `s3:DeleteObject`   | Removing attachments when a task is deleted           |
| `s3:ListBucket`     | Required by django-storages for internal checks       |
| `s3:GetBucketLocation` | Required by boto3 to determine the correct endpoint |

### Step 3 — Attach Policy to User

1. Go to **IAM → Users → task_manager_app-app → Add permissions**
2. Choose **Attach policies directly**
3. Search for `task_manager_appS3Policy` and attach it

### Step 4 — Generate Access Keys

1. Go to **IAM → Users → task_manager_app-app → Security credentials**
2. Under **Access keys**, click **Create access key**
3. Select **"Application running outside AWS"** as the use case
4. Copy both the **Access key ID** and **Secret access key** — the secret is only shown once
5. Store them in your `.env` file and GitHub secrets

### Step 5 — S3 Bucket Configuration

1. Go to **S3 → Create bucket**
2. Choose your region (match `AWS_S3_REGION_NAME`)
3. Keep **Block all public access: ON** — files are served via Django, not direct S3 URLs
4. Enable **Versioning** (optional but recommended — helps recover accidentally deleted files)
5. Enable **Server-side encryption** (SSE-S3, the default free option)

**CORS Configuration** (required so the browser can access file URLs served via Django):

Go to your bucket → **Permissions → CORS** and paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## 4. Security Group Rules

The EC2 instance should have a security group with the following rules. Create it in **EC2 → Security Groups → Create security group**.

### Inbound Rules

| Type        | Protocol | Port | Source             | Purpose                                    |
|-------------|----------|------|--------------------|--------------------------------------------|
| SSH         | TCP      | 22   | Your IP only `/32` | Admin access — **never use 0.0.0.0/0**    |
| HTTP        | TCP      | 80   | 0.0.0.0/0, ::/0   | Let's Encrypt ACME challenge + redirects   |
| HTTPS       | TCP      | 443  | 0.0.0.0/0, ::/0   | All public traffic                         |

> **Important:** Restrict SSH (port 22) to your own IP address only. Using `0.0.0.0/0` for SSH exposes your server to brute-force attacks. If your IP changes, update the rule from the AWS Console.

### Outbound Rules

| Type        | Protocol | Port | Destination  | Purpose                                             |
|-------------|----------|------|--------------|-----------------------------------------------------|
| All traffic | All      | All  | 0.0.0.0/0   | Allows Docker to pull images, boto3 to reach S3, certbot to reach Let's Encrypt, apt updates |

The default outbound rule (allow all) is appropriate here because all sensitive inbound access is already restricted.

### What is NOT exposed

The following ports are intentionally not opened in the security group, because Docker Compose handles internal routing:

| Port | Service       | Why it stays internal                           |
|------|---------------|-------------------------------------------------|
| 8000 | Django        | Only Nginx needs to reach it, via Docker network|
| 5432 | PostgreSQL    | Database must never be publicly accessible      |
| 3000 | React dev     | Production build is served via Nginx            |

### GitHub Actions IP Range (Optional)

If you ever want to restrict SSH access to GitHub Actions runners only (instead of your personal IP), you can use GitHub's published IP ranges. However, because these ranges change, the recommended approach for CI/CD SSH access is to use a dedicated deploy key and keep port 22 open only to your personal IP — the GitHub Actions runner connects using the SSH key you store in secrets, which is sufficient protection.

---

## 5. AWS Free Tier Setup

The Free Tier provides 12 months of specific resource allowances from the date you create your AWS account. task_manager_app is designed to operate entirely within these limits.

### Free Tier Resources Used

| Service     | Free Tier Allowance                          | task_manager_app Usage                             |
|-------------|----------------------------------------------|--------------------------------------------|
| EC2         | 750 hrs/month of t2.micro (Linux)            | 1 × t2.micro = 744 hrs/month ✅            |
| EBS Storage | 30 GB of gp2 SSD storage                     | 20 GB root volume ✅                       |
| S3 Storage  | 5 GB standard storage                        | Task attachments (small files) ✅          |
| S3 Requests | 20,000 GET + 2,000 PUT requests/month        | Low volume for a validation app ✅         |
| S3 Transfer | 100 GB data transfer out/month               | Minimal for a CRUD app ✅                  |
| Data Transfer Out | 1 GB/month from EC2 to internet        | Low for a validation/demo app ✅           |

### Staying Within Free Tier — Important Notes

**EC2:** You get 750 hours per month. One t2.micro running continuously uses 744 hours — exactly within budget. If you launch a second t2.micro for any reason (testing, etc.), you'll be billed for the combined hours. Monitor this under **Billing → Free Tier**.

**S3:** The 5 GB storage limit is generous for task attachments in a validation app. If users upload large files regularly, consider adding a file size limit in Django (e.g. 5 MB per file) to stay safe.

**Elastic IP:** If you associate an Elastic IP with your instance, it is free only while the instance is running. If you stop the instance and the Elastic IP remains allocated but unassociated, you'll be charged ~$0.005/hour. Either release the EIP when stopping, or just use the EC2's standard public IP (note: standard public IPs change on stop/start).

**Data Transfer:** 1 GB free outbound data from EC2 per month. A CRUD demo app will stay well within this. Transfers between EC2 and S3 in the same region are free.

### Setting Up a Billing Alert

Highly recommended to catch unexpected charges before they grow:

1. Go to **Billing → Budgets → Create budget**
2. Choose **"Use a template → Zero spend budget"**
3. Enter your email address
4. AWS will email you the moment any charge is detected

### Free Tier Checklist Before Launch

- [ ] Region is consistent across EC2, S3, and IAM (reduces cross-region data transfer costs)
- [ ] Instance type is **t2.micro** (not t3.micro, which is not Free Tier in all regions)
- [ ] EBS volume is **20 GiB gp2** (within the 30 GiB Free Tier limit)
- [ ] S3 bucket has versioning disabled or lifecycle rules set (versioned files count toward storage)
- [ ] Billing alert is configured
- [ ] No NAT Gateway or Load Balancer is created (both cost money immediately, even on Free Tier)
- [ ] Elastic IP is either not used, or released when the instance is stopped

### After the 12-Month Free Tier Expires

Once the 12-month period ends, the t2.micro rate is approximately $0.0116/hour (~$8.50/month). S3 costs are typically under $0.50/month for a small application. The full monthly cost for this architecture is roughly $9–12/month after Free Tier.

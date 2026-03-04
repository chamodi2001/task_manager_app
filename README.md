# Task Manager App

A full-stack CRUD application built to validate deployment and infrastructure configuration on AWS. Features a warm cream and orange-brown themed UI, complete containerisation with Docker, automated SSL, and a GitHub Actions CI/CD pipeline.

**Stack:** Django REST Framework · React · PostgreSQL · Docker · Nginx · Let's Encrypt · GitHub Actions · AWS EC2 · AWS S3

---

## Table of Contents

1. [Architecture Design](#1-architecture-design)
2. [Project Structure](#2-project-structure)
3. [Local Development](#3-local-development)
4. [AWS Free Tier Setup](#4-aws-free-tier-setup)
5. [IAM Configuration](#5-iam-configuration)
6. [Security Group Rules](#6-security-group-rules)
7. [Deployment Steps](#7-deployment-steps)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [SSL Configuration](#9-ssl-configuration)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [GitHub Secrets Reference](#11-github-secrets-reference)

---

## 1. Architecture Design

### High-Level Overview

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  AWS EC2 (t2.micro)          Security Group          │
│  Ports 80 + 443 only ──────────────────────────────  │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Docker Network (internal bridge)           │    │
│  │                                             │    │
│  │  ┌──────────┐    ┌──────────┐               │    │
│  │  │  nginx   │───▶│ frontend │               │    │
│  │  │ :80/:443 │    │  :80     │               │    │
│  │  │          │    └──────────┘               │    │
│  │  │          │    ┌──────────┐  ┌──────────┐ │    │
│  │  │          │───▶│ backend  │─▶│ postgres │ │    │
│  │  │          │    │  :8000   │  │  :5432   │ │    │
│  │  └──────────┘    └──────────┘  └──────────┘ │    │
│  │       │                                     │    │
│  │  ┌────▼─────┐                               │    │
│  │  │ certbot  │  (SSL cert issuance + renewal) │    │
│  │  └──────────┘                               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                              │
                              │ (file uploads)
                              ▼
                    ┌──────────────────┐
                    │   AWS S3 Bucket  │
                    │  (private, IAM   │
                    │  Role auth only) │
                    └──────────────────┘
```

### Request Flow

| Request | Path |
|---|---|
| `https://yourdomain.com/` | Internet → EC2:443 → nginx → frontend:80 → React app |
| `https://yourdomain.com/api/` | Internet → EC2:443 → nginx → backend:8000 → Django API |
| `https://yourdomain.com/admin/` | Internet → EC2:443 → nginx → backend:8000 → Django Admin |
| File upload | Django backend → boto3 → AWS S3 (via IAM Role, no keys) |
| DB queries | Django backend → PostgreSQL (internal Docker network, never exposed) |

### Key Design Decisions

**Nginx as the sole entry point** — only nginx binds to the host on ports 80 and 443. The backend and frontend containers are on an internal Docker network and are never directly reachable from the internet.

**IAM Role instead of IAM User keys** — the EC2 instance has an IAM Role attached with minimal S3 permissions. boto3 picks up temporary credentials automatically from the instance metadata service. No long-lived access keys are generated, stored, or rotated.

**SSL bootstrap handled inside Docker** — nginx starts in HTTP-only mode on first boot, certbot issues the certificate via the ACME webroot challenge, then nginx reloads into full HTTPS mode. On every subsequent boot, the certificate already exists in a Docker volume so nginx starts with HTTPS immediately.

**Development vs production separation** — a `docker-compose.override.yml` (gitignored) is used locally to disable nginx and certbot, and expose services directly on localhost ports. Production uses the base `docker-compose.yml` only.

---

## 2. Project Structure

```
task_manager_app/
├── backend/                        # Django REST Framework
│   ├── config/
│   │   ├── settings.py             # All config via environment variables
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── tasks/
│   │   ├── models.py               # Task model
│   │   ├── serializers.py
│   │   ├── views.py                # CRUD + S3 upload endpoint
│   │   └── urls.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── App.js                  # Main app, filtering, search
│   │   ├── api/tasks.js            # Axios API layer
│   │   ├── components/
│   │   │   ├── TaskCard.js
│   │   │   └── TaskModal.js        # Create / edit form with file upload
│   │   └── hooks/useTasks.js       # CRUD state management
│   ├── public/index.html
│   └── Dockerfile                  # Multi-stage: Node build → nginx serve
│
├── nginx/                          # Reverse proxy + SSL
│   ├── Dockerfile
│   ├── entrypoint.sh               # Smart startup: HTTP-only → wait for cert → HTTPS
│   ├── nginx.http.conf             # Used on first boot (no cert yet)
│   └── nginx.https.conf            # Used once cert exists
│
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD: build on runner → SSH → deploy on EC2
│
├── docker-compose.yml              # Production: all 5 services
├── docker-compose.override.yml     # Local only (gitignored): no nginx/certbot
├── .env.example                    # Variable reference — no real secrets
└── .gitignore
```


---

## 3. Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Git

No Python, Node, or PostgreSQL installation needed — Docker handles everything.

### Step 1 — Clone

```bash
git clone https://github.com/YOUR_USERNAME/task_manager_app.git
cd task_manager_app
```

### Step 2 — Create local environment file

```bash
cp .env.example .env
```

Edit `.env` with these minimum values:

```dotenv
DJANGO_SECRET_KEY=any-local-random-string-minimum-50-chars-1234567890
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000

POSTGRES_DB=task_manager_app
POSTGRES_USER=taskmanager_user
POSTGRES_PASSWORD=localpassword123

AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=us-east-1
USE_S3=False

DOMAIN=localhost
CERTBOT_EMAIL=
```

### Step 3 — Create the override file

Create `docker-compose.override.yml` in the project root:

```yaml
version: "3.9"

services:
  backend:
    ports:
      - "8000:8000"
    environment:
      DEBUG: "True"
      ALLOWED_HOSTS: "localhost,127.0.0.1"
      CORS_ALLOWED_ORIGINS: "http://localhost:3000"
      USE_S3: "False"

  frontend:
    ports:
      - "3000:80"

  nginx:
    deploy:
      replicas: 0

  certbot:
    deploy:
      replicas: 0
```

> This file is gitignored and disables nginx + certbot locally. EC2 never sees it.

### Step 4 — Start

```bash
docker-compose up --build
```

First run takes 3-5 minutes. When ready:

| Service | URL |
|---|---|
| React UI | http://localhost:3000 |
| Django API | http://localhost:8000/api/tasks/ |
| Django Admin | http://localhost:8000/admin/ |

### Step 5 — Verify everything works

```bash
# Test API
curl http://localhost:8000/api/tasks/

# Create a task
curl -X POST http://localhost:8000/api/tasks/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task", "description": "Local test", "status": "todo"}'

# Confirm DB is working
docker-compose exec db psql -U taskmanager_user -d task_manager_app -c "\dt"
```

### Useful local commands

```bash
docker-compose logs -f backend        # Live backend logs
docker-compose logs -f frontend       # Live frontend logs
docker-compose down                   # Stop (keeps data)
docker-compose down -v                # Stop and wipe database
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py migrate

# If build fails with snapshot/cache errors:
docker builder prune -af
docker-compose up --build
```

---

## 4. AWS Free Tier Setup

All services used fall within the AWS Free Tier (12 months from account creation).

### EC2 Instance

| Setting | Value | Free Tier |
|---|---|---|
| AMI | Amazon Linux 2023 | ✅ |
| Instance type | t2.micro | ✅ 750 hrs/month |
| Storage | 20 GB gp2 | ✅ up to 30 GB |
| Key pair | Create new `.pem` | — |

**Steps:**
1. Go to **EC2 → Launch instance**
2. Name: `task-manager-app`
3. AMI: **Amazon Linux 2023**
4. Instance type: **t2.micro**
5. Key pair: Create new → download `.pem` → store it safely
6. Configure Security Group (see Section 6)
7. Storage: 20 GB
8. Launch

> After launch, note the **Public IPv4 address** or assign an Elastic IP for a stable address.

### S3 Bucket

| Setting | Value | Free Tier |
|---|---|---|
| Storage | Up to 5 GB | ✅ |
| Requests | 20,000 GET / 2,000 PUT per month | ✅ |

**Steps:**
1. Go to **S3 → Create bucket**
2. Name: `task-manager-app-uploads` (must be globally unique)
3. Region: same as your EC2 (e.g. `us-east-1`)
4. **Block all public access: ON** — files are accessed via the application, not directly
5. Create bucket
6. Add CORS under **Permissions → CORS**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "ExposeHeaders": []
  }
]
```

### Domain (optional but needed for SSL)

A domain is required for Let's Encrypt SSL. Point your domain's DNS A records to the EC2 public IP:

```
A     yourdomain.com        →  YOUR_EC2_PUBLIC_IP
A     www.yourdomain.com    →  YOUR_EC2_PUBLIC_IP
```

Wait for DNS propagation (5-30 minutes) before the first deploy.

---

## 5. IAM Configuration

### Why IAM Role instead of IAM User keys

An IAM Role attached directly to the EC2 instance is more secure than an IAM User with access keys because:

- **No long-lived credentials** — AWS issues temporary tokens automatically, rotated every few hours
- **Nothing to leak** — no `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in `.env`, GitHub secrets, or code
- **Scoped to the instance** — credentials only work from the attached EC2 instance, not from anywhere on the internet

boto3 (the AWS SDK used by Django) automatically detects and uses role credentials via the EC2 instance metadata service. Zero configuration required in the application.

### Step 1 — Create the IAM Policy

1. Go to **IAM → Policies → Create policy**
2. Select **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TaskManagerS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::task-manager-app-uploads",
        "arn:aws:s3:::task-manager-app-uploads/*"
      ]
    }
  ]
}
```

3. Name it `TaskManagerS3Policy`
4. Create policy

**Why these 4 actions and nothing else:**

| Permission | Why needed |
|---|---|
| `s3:PutObject` | Upload task attachments |
| `s3:GetObject` | Retrieve / serve uploaded files |
| `s3:DeleteObject` | Delete files when tasks are deleted |
| `s3:ListBucket` | django-storages checks file existence before upload |

The role cannot create or delete buckets, access any other bucket, or interact with any other AWS service (EC2, RDS, IAM, etc.).

### Step 2 — Create the IAM Role

1. Go to **IAM → Roles → Create role**
2. Trusted entity: **AWS service**
3. Use case: **EC2**
4. Attach the `TaskManagerS3Policy` created above
5. Name: `task-manager-app-ec2-role`
6. Create role

### Step 3 — Attach the Role to EC2

1. Go to **EC2 → Instances → select your instance**
2. **Actions → Security → Modify IAM role**
3. Select `task-manager-app-ec2-role`
4. Save

From this point, the application on EC2 can access S3 automatically. No keys needed anywhere.

---

## 6. Security Group Rules

The security group acts as the firewall for your EC2 instance. The configuration below ensures only necessary traffic is allowed.

### Inbound Rules

| Type | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| SSH | TCP | 22 | **Your IP only** | Admin SSH access |
| HTTP | TCP | 80 | 0.0.0.0/0, ::/0 | Let's Encrypt challenge + redirect to HTTPS |
| HTTPS | TCP | 443 | 0.0.0.0/0, ::/0 | Application traffic |

> **Important:** For port 22, select **My IP** from the dropdown — never use `0.0.0.0/0` for SSH. This prevents brute-force attacks.

### Outbound Rules

Leave as default — all traffic allowed outbound. This is required for:
- `apt` / `yum` package installs
- Docker image pulls
- Let's Encrypt certificate requests
- S3 uploads from the application

### What is NOT exposed (and why)

| Port | Service | How it's protected |
|---|---|---|
| 5432 | PostgreSQL | No inbound rule. DB container is on internal Docker bridge network only |
| 8000 | Django backend | No inbound rule. nginx proxies to it internally |
| 3000 | React frontend | No inbound rule. nginx proxies to it internally |

In `docker-compose.yml`, backend and frontend have no `ports:` mapping to the host — they are only reachable from within the Docker internal network by nginx.

---

## 7. Deployment Steps

### Prerequisites

Before the first deploy:
1. EC2 instance is running (Section 4)
2. Security Group is configured (Section 6)
3. IAM Role is attached to the EC2 instance (Section 5)
4. S3 bucket is created with CORS (Section 4)
5. Domain DNS A records point to EC2 IP and have propagated
6. All GitHub secrets are set (Section 11)

### First Deploy

Push to the `main` branch:

```bash
git add .
git commit -m "Initial deploy"
git push origin main
```

GitHub Actions will:
1. SSH into the EC2 instance
2. Install Docker and Docker Compose if not present
3. Clone the repository
4. Write the `.env` file from GitHub secrets
5. Run `docker-compose up -d --build`
6. nginx starts in HTTP-only mode (no cert yet)
7. certbot issues the SSL certificate
8. nginx reloads to HTTPS mode automatically
9. Django runs migrations and collectstatic

The first deploy takes approximately 8-12 minutes. After that, your app is live at `https://yourdomain.com`.

### Subsequent Deploys

Every push to `main` triggers the same workflow. On subsequent deploys:
- The SSL certificate already exists in the Docker volume
- nginx starts directly in HTTPS mode
- Deploys take approximately 3-5 minutes

### Manual Deploy (if needed)

SSH into the instance and run:

```bash
ssh -i task-manager-key.pem ec2-user@YOUR_EC2_IP

cd /home/ec2-user/task_manager_app
git pull origin main
docker-compose down
docker-compose up -d --build
docker-compose exec backend python manage.py migrate --noinput
```

### Checking the deployment

```bash
# View running containers
docker-compose ps

# View live logs
docker-compose logs -f

# Check nginx is serving correctly
curl -I https://yourdomain.com

# Check Django API is reachable
curl https://yourdomain.com/api/tasks/
```

---

## 8. CI/CD Pipeline

### Pipeline Flow

```
Push to main branch
        │
        ▼
GitHub Actions Runner (ubuntu-latest)
        │
        └──► SSH into EC2 (appleboy/ssh-action)
                    │
                    ├── Install Docker / Docker Compose (if missing)
                    ├── git pull latest code
                    ├── Write .env from GitHub secrets
                    ├── docker-compose down
                    ├── docker image prune -af
                    ├── docker-compose up -d --build
                    ├── python manage.py migrate
                    └── python manage.py collectstatic
```

Images are built directly on the EC2 instance — no Docker registry is involved. The GitHub Actions runner only handles the SSH connection.

### Rollback

To roll back to a previous version, SSH into EC2 and check out the previous commit:

```bash
cd /home/ec2-user/task_manager_app
git log --oneline -5                     # find the commit to roll back to
git checkout <previous-commit-hash>
docker-compose down
docker-compose up -d --build
docker-compose exec backend python manage.py migrate --noinput
```

---

## 9. SSL Configuration

SSL is handled entirely within Docker using two containers working together.

### How it works

**nginx container** (`nginx/entrypoint.sh`) checks on startup:
- If `/etc/letsencrypt/live/DOMAIN/fullchain.pem` **does not exist** → loads `nginx.http.conf` (HTTP only), starts nginx, then polls every 5 seconds waiting for the certificate to appear, then reloads to `nginx.https.conf`
- If the certificate **already exists** → loads `nginx.https.conf` directly (HTTPS from the start)

**certbot container** checks on startup:
- If the certificate **does not exist** → issues it using the webroot challenge via `/var/www/certbot` (shared volume with nginx)
- Then enters a loop renewing every 12 hours

Both volumes (`certbot_conf` and `certbot_www`) persist across container restarts so the certificate survives deploys.




---

## 10. Environment Variables Reference

The `.env.example` file documents all required variables. The actual `.env` file is gitignored and never committed.

| Variable | Required | Description |
|---|---|---|
| `DOMAIN` | Production | Your domain, e.g. `yourdomain.com` |
| `CERTBOT_EMAIL` | Production | Email for SSL expiry alerts |
| `DJANGO_SECRET_KEY` | Always | Random 50+ char string |
| `DEBUG` | Always | `True` locally, `False` in production |
| `ALLOWED_HOSTS` | Always | Comma-separated allowed hosts |
| `CORS_ALLOWED_ORIGINS` | Always | Comma-separated allowed origins |
| `POSTGRES_DB` | Always | Database name |
| `POSTGRES_USER` | Always | Database user |
| `POSTGRES_PASSWORD` | Always | Database password |
| `AWS_STORAGE_BUCKET_NAME` | Production | S3 bucket name |
| `AWS_S3_REGION_NAME` | Production | AWS region, e.g. `us-east-1` |
| `USE_S3` | Always | `True` in production, `False` locally |

> No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` — the IAM Role provides credentials automatically in production.

### Generating a secure Django secret key

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## 11. GitHub Secrets Reference

Go to **Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public IP address |
| `EC2_USER` | `ec2-user` (Amazon Linux default) |
| `EC2_SSH_KEY` | Full contents of your `.pem` file |
| `HUB_TOKEN` | GitHub PAT with `repo` scope (for git clone on EC2) |
| `DOMAIN` | `yourdomain.com` |
| `CERTBOT_EMAIL` | Your email address |
| `DJANGO_SECRET_KEY` | 50+ char random string |
| `POSTGRES_DB` | `task_manager_app` |
| `POSTGRES_USER` | `taskmanager_user` |
| `POSTGRES_PASSWORD` | Strong password (avoid `$` and `!`) |
| `AWS_STORAGE_BUCKET_NAME` | `task-manager-app-uploads` |
| `AWS_S3_REGION_NAME` | `us-east-1` |
| `USE_S3` | `True` |

> `GITHUB_TOKEN` is provided automatically by GitHub Actions — do not create it manually.

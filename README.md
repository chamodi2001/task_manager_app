# task_manager_app 🌿

A warm-themed full-stack CRUD application built to validate deployment and infrastructure configuration on AWS.

**Stack:** Django REST Framework · React · PostgreSQL · Docker · Nginx + SSL · GitHub Actions CI/CD · AWS EC2 + S3

---

## Project Structure

```
taskflow/
├── backend/               # Django REST Framework
│   ├── config/            # Django project settings, urls, wsgi
│   ├── tasks/             # Tasks app (models, views, serializers, urls)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/              # React SPA
│   ├── src/
│   │   ├── App.js
│   │   ├── api/tasks.js
│   │   ├── components/    # TaskCard, TaskModal
│   │   └── hooks/useTasks.js
│   ├── public/index.html
│   └── Dockerfile
├── nginx/                 # Reverse proxy + SSL termination
│   ├── nginx.conf         # HTTP → HTTPS redirect, API + frontend proxy
│   └── Dockerfile
├── .github/workflows/
│   └── deploy.yml         # CI/CD: test → build → push → deploy
├── docker-compose.yml     # Full stack orchestration
├── init-ssl.sh            # One-time Let's Encrypt certificate issuance
└── .env.example           # All required environment variables
```

---

## API Endpoints

| Method | Path                  | Description              |
|--------|-----------------------|--------------------------|
| GET    | `/api/tasks/`         | List all tasks           |
| POST   | `/api/tasks/`         | Create a task            |
| GET    | `/api/tasks/{id}/`    | Get a single task        |
| PATCH  | `/api/tasks/{id}/`    | Update a task            |
| DELETE | `/api/tasks/{id}/`    | Delete a task            |
| POST   | `/api/tasks/upload/`  | Upload a file to S3      |

### Task Model

| Field         | Type      | Notes                          |
|---------------|-----------|--------------------------------|
| id            | integer   | Auto-generated PK              |
| title         | string    | Required, max 255 chars        |
| description   | text      | Optional                       |
| status        | string    | `todo` / `in_progress` / `done`|
| attachment    | file      | Optional, stored on S3         |
| created_at    | datetime  | Auto                           |
| updated_at    | datetime  | Auto                           |

---

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node 18+ (for frontend-only dev)
- Python 3.11+ (for backend-only dev)

### Quick Start with Docker

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/task_manager_app.git
cd taskflow

# 2. Set up environment
cp .env.example .env
# Edit .env — set DJANGO_SECRET_KEY, POSTGRES_PASSWORD at minimum
# Leave USE_S3=False for local dev

# 3. Start everything
docker compose up --build

# App: http://localhost (nginx)
# API: http://localhost/api/tasks/
# Django Admin: http://localhost/admin/
```

---

## AWS Deployment

### EC2 Setup (one-time)

```bash
# On a fresh Ubuntu 22.04 EC2 instance:
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu

# Clone the repo
sudo git clone https://github.com/YOUR_USERNAME/task_manager_app.git /opt/task_manager_app
sudo chown -R ubuntu:ubuntu /opt/taskflow

# Copy and fill in .env
cp /opt/taskflow/.env.example /opt/taskflow/.env
nano /opt/taskflow/.env
```

**EC2 Security Group** — open inbound:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)

### Issue SSL Certificate (one-time)

```bash
cd /opt/task_manager_app
# Make sure DOMAIN and CERTBOT_EMAIL are set in .env
bash init-ssl.sh
```

---

## GitHub Actions CI/CD

### How it works

```
Push to main
     │
     ├── test-backend   → runs Django check + migrate against test Postgres
     ├── test-frontend  → runs npm install + npm run build
     │
     └── (both pass) ──► build-and-push → builds & pushes 3 images to GHCR
                               │
                               └──► deploy → SSHs into EC2, writes .env,
                                            pulls images, docker compose up
```

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name               | Description                                        |
|---------------------------|----------------------------------------------------|
| `EC2_HOST`                | EC2 public IP or domain (e.g. `1.2.3.4`)          |
| `EC2_USER`                | SSH user (usually `ubuntu`)                        |
| `EC2_SSH_KEY`             | Private key contents (the full `.pem` file text)   |
| `DOMAIN`                  | Your domain, e.g. `taskflow.example.com`           |
| `CERTBOT_EMAIL`           | Email for Let's Encrypt expiry alerts              |
| `DJANGO_SECRET_KEY`       | Long random string (50+ chars)                     |
| `POSTGRES_DB`             | e.g. `taskflow`                                    |
| `POSTGRES_USER`           | e.g. `taskflow_user`                               |
| `POSTGRES_PASSWORD`       | Strong password                                    |
| `AWS_ACCESS_KEY_ID`       | IAM user access key                                |
| `AWS_SECRET_ACCESS_KEY`   | IAM user secret key                                |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name                                     |
| `AWS_S3_REGION_NAME`      | e.g. `us-east-1`                                   |
| `USE_S3`                  | `True` or `False`                                  |
| `GHCR_USER`               | Your GitHub username                               |
| `GHCR_TOKEN`              | GitHub PAT with `read:packages` scope              |

> **Note:** `GITHUB_TOKEN` is automatically provided by GitHub Actions and used to *push* images to GHCR. The `GHCR_TOKEN` secret is only used by EC2 to *pull* images.

---

## AWS S3 Bucket Setup

1. Create an S3 bucket in your chosen region
2. Create an IAM user with the policy below
3. Set `USE_S3=True` in your `.env` / GitHub secrets

**Minimum IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

---

## SSL Auto-Renewal

The `certbot` container runs continuously and attempts renewal every 12 hours. Certificates are stored in the `certbot_conf` Docker volume and mounted into the nginx container.

---

## Environment Variables Reference

See `.env.example` for all variables. No credentials are hardcoded — everything flows through environment variables at runtime.

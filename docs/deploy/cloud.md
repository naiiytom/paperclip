---
title: Cloud Deployment
summary: Deploy Paperclip on a VM or container runner
---

Deploy Paperclip to any cloud platform — AWS, GCP, Azure, DigitalOcean, Fly.io, Render, or a self-hosted Kubernetes cluster.

## Prerequisites

All cloud deployments need:

| Requirement | Notes |
|-------------|-------|
| **External PostgreSQL** | AWS RDS, Supabase, Neon, DigitalOcean Managed Postgres, etc. |
| **Public HTTPS URL** | The URL users will open in their browser |
| **Auth secret** | 32+ random bytes — `openssl rand -base64 32` |
| **Persistent volume** | At least 5 GB for agent workspaces, uploads, and secrets |

Set the deployment mode to `authenticated` + `public`:

```sh
PAPERCLIP_DEPLOYMENT_MODE=authenticated
PAPERCLIP_DEPLOYMENT_EXPOSURE=public
```

See [Deployment Modes](/deploy/deployment-modes) for a full explanation.

---

## Docker Compose on a VM

The fastest path to a cloud VM (Ubuntu 22.04 / 24.04).

### 1. Bootstrap the VM

SSH into your VM and run:

```sh
curl -fsSL https://raw.githubusercontent.com/paperclip-ai/paperclip/master/deploy/vm-setup.sh \
  | sudo bash
```

Or clone the repo and run locally:

```sh
sudo bash deploy/vm-setup.sh
```

The script installs Docker Engine, creates `/opt/paperclip`, and writes a `.env` stub.

### 2. Fill in the `.env` file

```sh
sudo nano /opt/paperclip/.env
```

```sh
DATABASE_URL=postgres://user:pass@your-db-host:5432/paperclip
PAPERCLIP_PUBLIC_URL=https://paperclip.example.com
BETTER_AUTH_SECRET=<openssl rand -base64 32>
ANTHROPIC_API_KEY=sk-ant-...   # optional
OPENAI_API_KEY=sk-...          # optional
```

### 3. Start

```sh
cd /opt/paperclip
docker compose -f docker-compose.cloud.yml --env-file .env up -d --build
```

### 4. Verify

```sh
curl http://localhost:3100/api/health
```

### Reverse Proxy (TLS)

Paperclip itself speaks plain HTTP on port 3100. Put **nginx** or **Caddy** in front to terminate TLS.

**Caddy** (`/etc/caddy/Caddyfile`):
```
paperclip.example.com {
    reverse_proxy localhost:3100
}
```

**nginx** snippet:
```nginx
server {
    listen 443 ssl;
    server_name paperclip.example.com;

    ssl_certificate     /etc/ssl/certs/paperclip.crt;
    ssl_certificate_key /etc/ssl/private/paperclip.key;

    location / {
        proxy_pass         http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 3600s;
    }
}
```

---

## Fly.io

Paperclip ships a ready-to-use `fly.toml`.

### 1. Create the app

```sh
fly launch --no-deploy
```

Fly will detect `fly.toml` — confirm the settings it proposes.

### 2. Create a persistent volume

```sh
fly volumes create paperclip_data --size 10 --region iad
```

### 3. Set secrets

```sh
fly secrets set \
  DATABASE_URL="postgres://user:pass@host:5432/db" \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  PAPERCLIP_PUBLIC_URL="https://<app-name>.fly.dev" \
  ANTHROPIC_API_KEY="sk-ant-..." \
  OPENAI_API_KEY="sk-..."
```

### 4. Deploy

```sh
fly deploy
```

Open `https://<app-name>.fly.dev`.

---

## Render

Paperclip ships a `render.yaml` Blueprint file that Render detects automatically.

### 1. Connect your repo

Go to **render.com → New → Blueprint** and connect your GitHub/GitLab repository.

### 2. Set secret environment variables

When prompted, fill in:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `PAPERCLIP_PUBLIC_URL` (your Render service URL, e.g. `https://paperclip.onrender.com`)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (optional)

### 3. Apply

Click **Apply** — Render builds and deploys the image, provisions the disk, and runs health checks.

---

## Kubernetes

Five manifest files are included under `deploy/kubernetes/`.

### Apply

```sh
# 1. Namespace + storage
kubectl apply -f deploy/kubernetes/namespace.yaml
kubectl apply -f deploy/kubernetes/pvc.yaml

# 2. Secrets (edit the file first, or use kubectl create secret)
kubectl create secret generic paperclip-secrets \
  --namespace paperclip \
  --from-literal=database-url='postgres://...' \
  --from-literal=better-auth-secret="$(openssl rand -base64 32)" \
  --from-literal=anthropic-api-key='sk-ant-...' \
  --from-literal=openai-api-key='sk-...'

# 3. Workload + networking
kubectl apply -f deploy/kubernetes/deployment.yaml
kubectl apply -f deploy/kubernetes/service.yaml
kubectl apply -f deploy/kubernetes/ingress.yaml
```

### Checklist before applying

- Update `PAPERCLIP_PUBLIC_URL` in `deployment.yaml` to your ingress hostname.
- Update the `host` in `ingress.yaml` to match.
- Set `storageClassName` in `pvc.yaml` to match your cluster (e.g. `gp3` on EKS, `standard-rwo` on GKE).
- Replace `image: paperclip:latest` with a pinned tag from your container registry.

### TLS with cert-manager

```sh
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Then uncomment the `cert-manager.io/cluster-issuer` annotation in `ingress.yaml` and the `tls` section.

---

## Environment Variable Checklist

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | External Postgres connection string |
| `PAPERCLIP_PUBLIC_URL` | Yes | Full HTTPS URL visible to users |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `PAPERCLIP_DEPLOYMENT_MODE` | Yes | `authenticated` |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | Yes | `public` |
| `ANTHROPIC_API_KEY` | No | Needed for Claude Local adapter |
| `OPENAI_API_KEY` | No | Needed for Codex Local adapter |

See [Environment Variables](/deploy/environment-variables) for the full reference.

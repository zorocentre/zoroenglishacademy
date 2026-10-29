# Zoro English Academy - Production Deployment Guide
**Target Environment**: Ubuntu Hostinger VPS (Ubuntu 22.04 / 24.04 LTS)  
**Main Domain**: `https://zoroenglish.com`  
**API Domain**: `https://api.zoroenglish.com`

---

## 1. Architecture Overview

```
                          Internet (HTTPS)
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        https://zoroenglish.com         https://api.zoroenglish.com
                 │                               │
                 ▼                               ▼
      ┌──────────────────────┐        ┌──────────────────────┐
      │  Hostinger VPS Nginx │        │  Hostinger VPS Nginx │
      │  Static Asset Server │        │  Reverse Proxy       │
      │  /var/www/.../dist   │        │  proxy_pass :8080    │
      └──────────────────────┘        └──────────┬───────────┘
                                                 │
                                                 │ 127.0.0.1:8080 (Loopback Only)
                                                 ▼
                                      ┌──────────────────────┐
                                      │   zoro_backend       │
                                      │   (Spring Boot 3.3.4 │
                                      │    Java 21 JRE)      │
                                      └──────────┬───────────┘
                                                 │ Internal Docker Network
                                                 │ (zoro_app_network)
                                                 ▼
                                      ┌──────────────────────┐
                                      │   zoro_postgres      │
                                      │   (PostgreSQL 16)    │
                                      │   Volume: pg_data    │
                                      │   Port 5432 Internal │
                                      └──────────────────────┘
```

- **Frontend**: Built into static production assets with Vite, served directly by the host's existing Nginx installation from `/var/www/zoroenglish.com/dist`.
- **Backend**: Containerized Spring Boot 3.3.4 running Java 21, publishing port 8080 strictly to the host's loopback interface (`127.0.0.1:8080`) so it cannot be reached from the public internet bypassing Nginx.
- **Database**: PostgreSQL 16 container connected via an internal Docker bridge network (`zoro_app_network`). Its port is **never** published to the host or internet. Data is persisted in a named volume (`zoro_postgres_data`).
- **Media & Documents**: Static files, audio, and images live in **Bunny Storage**; videos stream via **Bunny Stream**.
- **Database Migrations**: Flyway runs automatically on backend container startup, validating and applying migrations sequentially (`V1` to `V53`) without resetting data.
- **VPS Safety Rule**: Existing VPS Nginx configuration, SSL certificates, and any "Coming Soon" maintenance pages remain active and unchanged until the operator explicitly decides to switch over.

---

## 2. Server Prerequisites on Ubuntu VPS

Ensure the following tools are installed on your Ubuntu VPS:

```bash
# 1. Update package lists
sudo apt update && sudo apt upgrade -y

# 2. Install Docker and Docker Compose plugin (if not already installed)
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Enable and start Docker service
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 4. Install Node.js 20+ & npm for compiling frontend assets
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 5. Install LibreOffice Headless for PPT/PPTX auto-conversion to PDF (Section 9b)
sudo apt install -y libreoffice-core libreoffice-common libreoffice-writer libreoffice-impress
```

Verify installation:
```bash
docker --version
docker compose version
node -v
npm -v
soffice --version
```

---

## 3. Step-by-Step Deployment Procedure

### Step 3.1: Clone and Configure Production Secrets

1. Clone or pull the repository to your deployment directory on the VPS (e.g. `/opt/zoro-academy-app`):
   ```bash
   cd /opt
   git clone <REPO_URL> zoro-academy-app
   cd zoro-academy-app
   ```

2. Create `.env.production` from the documented template:
   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

3. Generate secure cryptographic secrets for the required variables:
   ```bash
   # Generate strong random PostgreSQL password:
   openssl rand -hex 24

   # Generate 256-bit Base64 JWT secret:
   openssl rand -base64 32

   # Generate 32-character AES student password encryption key:
   openssl rand -base64 32
   ```

4. Edit `.env.production` with your favorite text editor:
   ```bash
   nano .env.production
   ```
   Populate:
   - `DB_PASSWORD`: Password generated above.
   - `JWT_SECRET`: Base64 string generated above.
   - `ADMIN_PASSWORD_KEY`: Base64 string generated above.
   - `ADMIN_EMAIL`: `admin@zoroenglish.com`
   - `ADMIN_PASSWORD`: Strong initial administrator password.
   - `CORS_ORIGINS`: `https://zoroenglish.com,https://www.zoroenglish.com`
   - `BUNNY_*`: Credentials from Bunny.net dashboard for Storage and Stream.
   - `RAZORPAY_*`: Live API Key ID and Secret from Razorpay Dashboard.
   - `AWS_SES_*`: SMTP credentials from AWS SES console.

---

### Step 3.2: Build and Start Backend & PostgreSQL Containers

1. Build the production backend image:
   ```bash
   docker compose --env-file .env.production build
   ```
   *Note*: The multi-stage build downloads Maven dependencies, runs `mvn clean package -DskipTests`, and produces a hardened container running `eclipse-temurin:21-jre-jammy` with non-root user `appuser`.

2. Start the database and backend services in detached mode:
   ```bash
   docker compose --env-file .env.production up -d
   ```

3. Check container status:
   ```bash
   docker compose --env-file .env.production ps
   ```
   Both `zoro_postgres` and `zoro_backend` should report status `Up (healthy)`.

4. Verify Flyway schema migrations:
   ```bash
   docker compose --env-file .env.production logs backend | grep -i flyway
   ```
   You should see:
   ```text
   Successfully validated 53 migrations
   Current version of schema "public": 53
   Schema "public" is up to date. No migration necessary.
   ```

5. Test the internal backend health check:
   ```bash
   curl -i http://127.0.0.1:8080/api/time
   ```
   Expected response: HTTP 200 with server timestamp in Asia/Kolkata timezone:
   ```json
   {"success":true,"message":"Current server time","data":{"serverTime":"..."}}
   ```

---

### Step 3.3: Build Frontend Production Static Assets

> [!IMPORTANT]
> **Vite Build-time Configuration**:
> Vite compiles environment variables directly into static JavaScript chunks at build time.
> To ensure the client connects to `https://api.zoroenglish.com/api`, you **must** supply `VITE_API_BASE_URL` during the `npm run build` command.

1. Navigate to the frontend directory:
   ```bash
   cd /opt/zoro-academy-app/frontend
   ```

2. Install clean production dependencies:
   ```bash
   npm ci
   ```

3. Compile the production bundle targeting the API domain:
   ```bash
   VITE_API_BASE_URL="https://api.zoroenglish.com/api" npm run build
   ```

4. Verify the build output:
   ```bash
   ls -la dist/
   ```
   The `dist/` directory now contains `index.html`, `assets/*.js`, and `assets/*.css`.

5. Deploy static assets to the Nginx web root directory:
   ```bash
   sudo mkdir -p /var/www/zoroenglish.com/dist
   sudo rsync -av --delete dist/ /var/www/zoroenglish.com/dist/
   sudo chown -R www-data:www-data /var/www/zoroenglish.com/dist
   sudo chmod -R 755 /var/www/zoroenglish.com/dist
   ```

---

## 4. Nginx Configuration on Hostinger VPS

The production Nginx configuration file is maintained directly in the repository at [`deploy/nginx.conf`](./deploy/nginx.conf).

To deploy or update Nginx on Ubuntu VPS:
```bash
# 1. Copy configuration to sites-available
sudo cp /opt/zoro-academy-app/deploy/nginx.conf /etc/nginx/sites-available/zoroenglish.com

# 2. Enable virtual host symlink
sudo ln -sf /etc/nginx/sites-available/zoroenglish.com /etc/nginx/sites-enabled/

# 3. Test syntax
sudo nginx -t

# 4. Reload Nginx without downtime
sudo systemctl reload nginx
```

### 4.1. Configuration Breakdown & Key Features
- **SPA Fallback**: `location / { try_files $uri $uri/ /index.html; }` prevents 404 errors on browser page refresh across all client routes (`/admin`, `/student/courses`, `/competition/*`, `/trainer/*`).
- **Dedicated API Proxy**: `location /api/ { proxy_pass http://127.0.0.1:8080/api/; }` is positioned strictly **above** the fallback so backend endpoints and API 404/403 responses are never swallowed by `index.html`.
- **Large Upload Support**: `client_max_body_size 500M;` and `proxy_request_buffering off;` allow videos, high-resolution media prompts, and PDFs up to 500MB to stream directly to backend without buffering on VPS disk.
- **Static Asset Caching**: `location /assets/` sets 1-year immutable caching for Vite bundle chunks with content hashes and terminates with `try_files $uri =404;`.

### 4.2. Frontend Virtual Host: `zoroenglish.com`
Create `/etc/nginx/sites-available/zoroenglish.com`:

```nginx
server {
    listen 80;
    server_name zoroenglish.com www.zoroenglish.com;
    return 301 https://zoroenglish.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.zoroenglish.com;
    ssl_certificate /etc/letsencrypt/live/zoroenglish.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zoroenglish.com/privkey.pem;
    return 301 https://zoroenglish.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name zoroenglish.com;

    # SSL Certificates (Use your existing Certbot paths)
    ssl_certificate /etc/letsencrypt/live/zoroenglish.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zoroenglish.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/zoroenglish.com/dist;
    index index.html;

    # Gzip compression for static assets
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Cache static assets with content hashes
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # SPA routing fallback: send all non-file routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### 4.3. Test and Enable Virtual Hosts
```bash
# Enable virtual host configurations
sudo ln -sf /etc/nginx/sites-available/api.zoroenglish.com /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/zoroenglish.com /etc/nginx/sites-enabled/

# Test syntax without affecting active traffic
sudo nginx -t

# Reload Nginx only when verified
sudo systemctl reload nginx
```

---

## 5. PostgreSQL Database Backup & Restore Runbook

Because PostgreSQL's port is **not** exposed publicly, all administrative database tasks are executed safely through `docker compose exec`.

### 5.1. Create a Full Database Backup

Create a timestamped compressed backup file:
```bash
# Navigate to repository directory
cd /opt/zoro-academy-app

# Create backup directory
mkdir -p /opt/backups

# Dump database in custom compressed format (recommended):
docker compose --env-file .env.production exec -T postgres \
  pg_dump -U postgres -d zoro_academy -Fc > /opt/backups/zoro_backup_$(date +%Y%m%d_%H%M%S).dump

# Or plain SQL format:
docker compose --env-file .env.production exec -T postgres \
  pg_dump -U postgres -d zoro_academy > /opt/backups/zoro_backup_$(date +%Y%m%d_%H%M%S).sql
```

Verify the backup file exists and has content:
```bash
ls -lh /opt/backups/
```

### 5.2. Restore a Database Backup

> [!CAUTION]
> Restoring a database backup replaces or overwrites existing records. Always take a fresh backup before executing a restore operation.

1. Restoring from a custom compressed `.dump` file:
   ```bash
   docker compose --env-file .env.production exec -T postgres \
     pg_restore -U postgres -d zoro_academy --clean --if-exists < /opt/backups/zoro_backup_YYYYMMDD_HHMMSS.dump
   ```

2. Restoring from a plain `.sql` file:
   ```bash
   docker compose --env-file .env.production exec -T postgres \
     psql -U postgres -d zoro_academy < /opt/backups/zoro_backup_YYYYMMDD_HHMMSS.sql
   ```

### 5.3. Automated Daily Backup Cron Job

Add a cron job to automatically dump the database every day at 03:00 AM and retain backups for 14 days:

```bash
sudo crontab -e
```
Add the following line:
```cron
0 3 * * * cd /opt/zoro-academy-app && docker compose --env-file .env.production exec -T postgres pg_dump -U postgres -d zoro_academy -Fc > /opt/backups/zoro_backup_$(date +\%Y\%m\%d_\%H\%M\%S).dump && find /opt/backups -name "zoro_backup_*.dump" -mtime +14 -delete
```

---

## 6. Production Health & Verification Checklist

Do **not** consider the deployment ready solely because the containers started. Execute this checklist:

| Check | Command / Action | Expected Result |
| :--- | :--- | :--- |
| **Container Status** | `docker compose --env-file .env.production ps` | Both containers report `Up (healthy)`. |
| **Backend Logs** | `docker compose --env-file .env.production logs backend --tail=50` | No stack traces; shows `Started ZoroAcademyApplication`. |
| **Flyway Migrations** | `docker compose --env-file .env.production logs backend \| grep -i flyway` | `Successfully validated 53 migrations`. |
| **API Health via Nginx** | `curl -i https://api.zoroenglish.com/api/time` | HTTP 200 with current IST timestamp. |
| **CORS Response** | `curl -H "Origin: https://zoroenglish.com" -I https://api.zoroenglish.com/api/time` | Header `Access-Control-Allow-Origin: https://zoroenglish.com`. |
| **Bunny CDN Connectivity** | Log in as admin and call `GET https://api.zoroenglish.com/api/admin/bunny-health` | HTTP 200 with `storage: OK` and `stream: OK`. |
| **Public Landing Page** | Visit `https://zoroenglish.com` in browser | Home page renders; course/competition cards load banners. |
| **Candidate Login** | Log in as a student in `https://zoroenglish.com/login` | Session established, redirected to portal without errors. |
| **Database Port Closed** | `nc -zv api.zoroenglish.com 5432` from an outside machine | Connection timed out or refused (port not reachable). |

---

## 7. Ongoing Maintenance & Application Updates

When new code or updates are pulled:

1. **Pull latest code**:
   ```bash
   cd /opt/zoro-academy-app
   git pull origin main
   ```

2. **Rebuild and restart backend**:
   ```bash
   docker compose --env-file .env.production build backend
   docker compose --env-file .env.production up -d --no-deps backend
   ```

3. **Recompile and deploy frontend**:
   ```bash
   cd /opt/zoro-academy-app/frontend
   npm ci
   VITE_API_BASE_URL="https://api.zoroenglish.com/api" npm run build
   sudo rsync -av --delete dist/ /var/www/zoroenglish.com/dist/
   ```

4. **Monitor logs**:
   ```bash
   docker compose --env-file .env.production logs -f backend
   ```

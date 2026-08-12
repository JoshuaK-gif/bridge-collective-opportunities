#!/usr/bin/env bash
# ============================================================
#  Deploy Bridge Collective Opportunities to an Alavps Free VPS
#  Target: Ubuntu 22.04/24.04, root access, Docker
#
#  Usage (as root on the VPS):
#    bash deploy-alavps.sh
#
#  Optional env vars (override defaults):
#    DOMAIN=bridgecollectiveopport.org
#    CLOUDINARY_CLOUD_NAME=...
#    CLOUDINARY_API_KEY=...
#    CLOUDINARY_API_SECRET=...
#    GITHUB_REPO=https://github.com/JoshuaK-gif/bridge-collective-opportunities.git
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-bridgecollectiveopport.org}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/JoshuaK-gif/bridge-collective-opportunities.git}"
APP_DIR="/home/ubuntu/app"
ENV_FILE="$APP_DIR/server/.env"

echo "=============================================="
echo "  Deploying Bridge Collective Opportunities"
echo "  Domain : $DOMAIN"
echo "=============================================="

# --- 1. Install Docker + Compose plugin ---
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/6] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "[1/6] Docker already installed."
fi
apt-get update -y
apt-get install -y docker-compose-plugin git curl ufw >/dev/null

# --- 2. Clone / update the repository ---
echo "[2/6] Fetching code from GitHub..."
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$GITHUB_REPO" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/master
fi
chown -R ubuntu:ubuntu "$APP_DIR"

# --- 3. Build the frontend (dist/ is served by the API) ---
echo "[3/6] Building frontend (this can take a few minutes)..."
cd "$APP_DIR"
npm ci --silent
npm run build

# --- 4. Write production .env with freshly generated secrets ---
echo "[4/6] Writing production environment..."
JWT_SECRET="$(openssl rand -hex 32)"
DB_PASSWORD="$(openssl rand -hex 20)"
WEBHOOK_SECRET="$(openssl rand -hex 32)"
CRON_SECRET="$(openssl rand -hex 32)"

cat > "$ENV_FILE" <<EOF
NODE_ENV=production
LOG_LEVEL=info
USE_PGLITE=false

PORT=3000
DOMAIN=${DOMAIN}
SITE_URL=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}

DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/bridge_jobs
DB_POOL_MAX=200
DB_SSL=false
REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
CRON_SECRET=${CRON_SECRET}

CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}

OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
EOF
chown ubuntu:ubuntu "$ENV_FILE"

# --- 5. Firewall: allow SSH, HTTP, HTTPS ---
echo "[5/6] Configuring firewall..."
ufw --force enable >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 3000/tcp >/dev/null

# --- 6. Launch the stack ---
echo "[6/6] Starting Docker Compose stack..."
cd "$APP_DIR/server"
docker compose up -d --build

echo ""
echo "=============================================="
echo "  DEPLOYMENT COMPLETE"
echo "=============================================="
echo "  App       : http://$(curl -4 -s ifconfig.me || hostname -I | awk '{print $1}') (direct IP)"
echo "  Production: https://${DOMAIN}  (after DNS points here)"
echo ""
echo "  DNS to configure at your domain registrar:"
echo "    A  ${DOMAIN}  ->  <this server's public IP>"
echo "    A  www.${DOMAIN}  ->  <this server's public IP>"
echo ""
echo "  Next: set CLOUDINARY_* keys and SMTP config in admin settings."
echo "=============================================="

#!/usr/bin/env bash
# vm-setup.sh — Bootstrap Paperclip on a fresh Ubuntu 22.04 / 24.04 VM
#
# Run as a user with sudo privileges:
#   curl -fsSL https://raw.githubusercontent.com/paperclip-ai/paperclip/master/deploy/vm-setup.sh | bash
# or after cloning:
#   bash deploy/vm-setup.sh
#
# The script:
#   1. Installs Docker Engine + Compose plugin
#   2. Creates /opt/paperclip data directory
#   3. Writes an .env file stub (fill in secrets before starting)
#   4. Provides a one-line start command

set -euo pipefail

PAPERCLIP_DIR="/opt/paperclip"
ENV_FILE="$PAPERCLIP_DIR/.env"
COMPOSE_FILE="docker-compose.cloud.yml"
REPO_URL="https://github.com/paperclip-ai/paperclip"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${GREEN}[+]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
section() { echo -e "\n${BOLD}$*${NC}"; }

# ── 1. Install Docker ─────────────────────────────────────────────────────────
section "Step 1: Docker"
if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  info "Installing Docker Engine..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
  info "Docker installed: $(docker --version)"
fi

# Allow current user to run docker without sudo (takes effect on next login)
if ! groups "${SUDO_USER:-$USER}" | grep -q docker; then
  usermod -aG docker "${SUDO_USER:-$USER}" 2>/dev/null || true
  warn "Added ${SUDO_USER:-$USER} to the docker group (re-login to apply)"
fi

# ── 2. Set up data directory ──────────────────────────────────────────────────
section "Step 2: Data directory"
mkdir -p "$PAPERCLIP_DIR/data"
info "Data directory: $PAPERCLIP_DIR"

# ── 3. Get docker-compose.cloud.yml ──────────────────────────────────────────
section "Step 3: Compose file"
if [[ -f "$COMPOSE_FILE" ]]; then
  # Running from inside a cloned repo — copy the file
  cp "$COMPOSE_FILE" "$PAPERCLIP_DIR/$COMPOSE_FILE"
  info "Copied $COMPOSE_FILE from repo"
elif [[ ! -f "$PAPERCLIP_DIR/$COMPOSE_FILE" ]]; then
  info "Downloading $COMPOSE_FILE from GitHub..."
  curl -fsSL "$REPO_URL/raw/master/$COMPOSE_FILE" \
    -o "$PAPERCLIP_DIR/$COMPOSE_FILE"
  info "Downloaded $COMPOSE_FILE"
else
  info "$COMPOSE_FILE already present"
fi

# ── 4. Write .env stub ────────────────────────────────────────────────────────
section "Step 4: Environment variables"
if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists at $ENV_FILE — skipping (edit it manually)"
else
  cat > "$ENV_FILE" <<'EOF'
# Paperclip cloud deployment environment variables
# Edit this file, then run: docker compose -f docker-compose.cloud.yml up -d

# --- Required ---

# External PostgreSQL connection string
# Examples:
#   AWS RDS:   postgres://paperclip:PASS@my-instance.rds.amazonaws.com:5432/paperclip
#   Supabase:  postgres://postgres:PASS@db.PROJECT.supabase.co:5432/postgres?sslmode=require
#   Neon:      postgres://user:PASS@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL=

# Public HTTPS URL of this instance (must match what users type in their browser)
PAPERCLIP_PUBLIC_URL=https://paperclip.example.com

# Random 32+ char secret — generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=

# --- Optional ---

# LLM provider keys (needed for Claude / Codex adapters)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Host port (default: 3100)
# PAPERCLIP_PORT=3100

# Persistent data directory on this host (default: ./data/paperclip)
# PAPERCLIP_DATA_DIR=/opt/paperclip/data
EOF

  chmod 600 "$ENV_FILE"
  info "Created .env stub at $ENV_FILE"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
section "Setup complete"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo ""
echo -e "  1. Edit ${BOLD}$ENV_FILE${NC} — fill in DATABASE_URL, PAPERCLIP_PUBLIC_URL, BETTER_AUTH_SECRET"
echo ""
echo -e "  2. Start Paperclip:"
echo -e "     ${BOLD}cd $PAPERCLIP_DIR && docker compose -f $COMPOSE_FILE --env-file .env up -d --build${NC}"
echo ""
echo -e "  3. Check logs:"
echo -e "     ${BOLD}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo ""
echo -e "  4. Open \${PAPERCLIP_PUBLIC_URL} in your browser."
echo ""
warn "Configure your firewall/reverse-proxy to terminate TLS before Paperclip."
warn "The app binds to 0.0.0.0:3100 — restrict access at the network level if needed."

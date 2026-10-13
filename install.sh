#!/usr/bin/env bash
# One-step SalesKnot install for a fresh Ubuntu/Debian VPS.
#   curl -fsSL https://raw.githubusercontent.com/opsknot/salesknot/main/install.sh | sudo bash
# Safe to re-run: it keeps an existing .env and never deletes data.
set -euo pipefail

REPO="${SALESKNOT_REPO:-https://github.com/opsknot/salesknot.git}"
DIR="${SALESKNOT_DIR:-/opt/salesknot}"

if ! command -v docker >/dev/null 2>&1; then
  echo "== Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git; }

if [ -d "$DIR/.git" ]; then
  echo "== Updating $DIR"
  git -C "$DIR" pull --ff-only
else
  echo "== Downloading SalesKnot to $DIR"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  echo "== Creating .env with fresh passwords"
  cp .env.example .env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 24)|" .env
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 32)|" .env
fi

if ! grep -q '^CLOUDFLARE_TUNNEL_TOKEN=..' .env; then
  echo
  echo "Paste the Cloudflare tunnel token (the long text after --token), then press Enter."
  echo "Nothing will show while you paste; that's normal."
  read -rs TOKEN < /dev/tty
  echo
  TOKEN="$(echo "$TOKEN" | awk '{print $NF}')"   # also accepts the whole command Cloudflare shows
  [ -n "$TOKEN" ] || { echo "No token given. Re-run this script when you have it."; exit 1; }
  sed -i "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$TOKEN|" .env
fi

echo "== Building and starting (first time takes several minutes)"
docker compose up -d --build

echo "== Waiting for SalesKnot to finish database setup"
for i in $(seq 1 60); do
  if docker compose exec -T server curl -sf http://localhost:3000/healthz >/dev/null 2>&1; then
    echo
    echo "SalesKnot is running."
    echo "Next: in Cloudflare, add the hostnames (README step 1), then sign up at https://my.salesknot.app"
    exit 0
  fi
  printf '.'; sleep 10
done
echo
echo "Still starting after 10 minutes. Check: cd $DIR && docker compose logs --tail 50 server"

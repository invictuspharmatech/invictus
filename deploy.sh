#!/bin/bash
# Invictus Pharma — run this on the live server after you git push from Windows.
# Does not touch host MySQL or .env passwords.
#
#   chmod +x deploy.sh
#   ./deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f docker-compose.yml ]]; then
  echo "deploy.sh must live in the project root (next to docker-compose.yml)."
  exit 1
fi

echo "==> $(date -Is)  updating ${ROOT}"

if [[ -f /etc/letsencrypt/live/invictuspharma.net/fullchain.pem ]]; then
  cp deploy/compose.ssl.override.yml docker-compose.override.yml
  echo "==> HTTPS override in place (docker-compose.override.yml)"
fi

# Local edits to tracked files block git pull. HTTPS belongs in the override file.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git restore --worktree --staged -- deploy.sh docker-compose.yml 2>/dev/null \
    || git checkout -- deploy.sh docker-compose.yml
fi

DIRTY="$(git status --porcelain)"
if [[ -n "${DIRTY}" ]]; then
  echo "Server still has local changes (not deploy.sh / docker-compose.yml):"
  echo "${DIRTY}"
  echo "Move those aside, then run ./deploy.sh again."
  exit 1
fi

echo "==> git pull"
git pull --ff-only

if [[ -f /etc/letsencrypt/live/invictuspharma.net/fullchain.pem ]]; then
  cp deploy/compose.ssl.override.yml docker-compose.override.yml
fi

echo "==> docker compose build"
docker compose build

echo "==> docker compose up -d"
docker compose up -d

echo "==> status"
docker compose ps

echo "==> health"
if docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=8)"; then
  echo
  echo "backend /api/health/ ok"
else
  echo
  echo "Health check failed. Recent backend logs:"
  docker compose logs --tail=40 backend
  exit 1
fi

echo "==> done. Site should be live."
echo "    Hard-refresh the browser after a frontend rebuild."

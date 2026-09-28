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

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Server has uncommitted files. Commit or stash them before deploy:"
  git status --short
  exit 1
fi

echo "==> git pull"
git pull --ff-only

echo "==> docker compose build"
docker compose build

echo "==> docker compose up -d"
docker compose up -d

echo "==> status"
docker compose ps

echo "==> health"
if curl -fsS --max-time 10 "http://127.0.0.1/api/health/" ; then
  echo
else
  echo
  echo "Health check failed. Recent backend logs:"
  docker compose logs --tail=40 backend
  exit 1
fi

echo "==> done. Site should be live."
echo "    Frontend image rebuilds with this script; wait a minute then hard-refresh the browser."

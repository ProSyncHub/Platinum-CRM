#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

EXPECTED_SHA="${1:-}"
APP_DIR="${APP_DIR:-/var/www/prosync-crm}"
PM2_APP_NAME="${PM2_APP_NAME:-prosync-crm}"
LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://127.0.0.1:3010/}"

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "A full 40-character Git commit SHA is required." >&2
  exit 1
fi

cd "$APP_DIR"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Deployment stopped: the VPS checkout has uncommitted tracked changes." >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Deployment stopped: the VPS checkout is on $CURRENT_BRANCH instead of main." >&2
  exit 1
fi

git fetch --prune origin main

if ! git merge-base --is-ancestor "$EXPECTED_SHA" origin/main; then
  echo "Deployment stopped: $EXPECTED_SHA is not present on origin/main." >&2
  exit 1
fi

CURRENT_SHA="$(git rev-parse HEAD)"
if git merge-base --is-ancestor "$EXPECTED_SHA" "$CURRENT_SHA"; then
  echo "The VPS already contains commit $EXPECTED_SHA or a newer main commit."
elif git merge-base --is-ancestor "$CURRENT_SHA" "$EXPECTED_SHA"; then
  git merge --ff-only "$EXPECTED_SHA"
else
  echo "Deployment stopped: the VPS checkout has diverged from origin/main." >&2
  exit 1
fi

DEPLOYED_SHA="$(git rev-parse HEAD)"
echo "Preparing CRM deployment at $DEPLOYED_SHA"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
fi

for command_name in node npm npx pm2 curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Deployment stopped: $command_name is not available for $(whoami)." >&2
    exit 1
  fi
done

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 20 )); then
  echo "Deployment stopped: Node.js 20 or newer is required." >&2
  exit 1
fi

if [[ ! -s .env ]]; then
  echo "Deployment stopped: $APP_DIR/.env is missing or empty." >&2
  exit 1
fi

npm ci --no-audit --no-fund
npx prisma validate
npx prisma generate
npm run build

# MongoDB uses db push rather than Prisma Migrate. No data-loss override is
# supplied, so a destructive schema change stops the deployment for review.
npx prisma db push

# Recreate this app so PM2 cannot keep stale command metadata from an older
# process definition. Other PM2 apps on the VPS are left untouched.
pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --only "$PM2_APP_NAME" --update-env
pm2 save

for attempt in {1..12}; do
  if curl --fail --max-time 15 --silent --show-error --output /dev/null "$LOCAL_HEALTH_URL"; then
    echo "CRM deployment is healthy at $DEPLOYED_SHA"
    exit 0
  fi
  echo "Waiting for CRM health check ($attempt/12)..."
  sleep 5
done

echo "CRM did not become healthy after the PM2 reload." >&2
pm2 logs "$PM2_APP_NAME" --lines 80 --nostream >&2 || true
exit 1

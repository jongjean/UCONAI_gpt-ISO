#!/usr/bin/env bash
# Automates backup -> build -> deploy workflow for the ISO frontend.
# Backups all modified/new src files (per git status), builds, and deploys to /var/www/iso.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC_DIR="${FRONTEND_DIR}/src"
DEPLOY_DIR="/var/www/iso"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

cd "${FRONTEND_DIR}"

echo "[1/5] Detecting modified/new src files..."
mapfile -d '' CHANGED_ENTRIES < <(git status --porcelain=1 -z -- src)

if [[ ${#CHANGED_ENTRIES[@]} -eq 0 ]]; then
  echo "  No tracked changes under src/. Skipping backup step."
else
  for entry in "${CHANGED_ENTRIES[@]}"; do
    path="${entry:3}"
    abs_path="${FRONTEND_DIR}/${path}"
    if [[ -f "${abs_path}" ]]; then
      backup_path="${abs_path}.${TIMESTAMP}.bak"
      cp "${abs_path}" "${backup_path}"
      echo "  Backed up ${path} -> ${path}.${TIMESTAMP}.bak"
    fi
  done
fi

if [[ -d dist ]]; then
  echo "Clearing existing dist/ (may require sudo if root-owned)..."
  rm -rf dist || sudo rm -rf dist
fi

echo "[2/5] Installing dependencies (npm install)..."
npm install >/dev/null 2>&1 || npm install

echo "[3/5] Building frontend (npm run build)..."
npm run build

echo "[4/5] Cleaning ${DEPLOY_DIR}..."
sudo rm -rf "${DEPLOY_DIR}"/*

echo "[5/5] Deploying to ${DEPLOY_DIR}..."
sudo cp -r dist/* "${DEPLOY_DIR}/"

echo "Deployment complete."

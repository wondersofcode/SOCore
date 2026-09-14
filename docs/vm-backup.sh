#!/bin/bash
# SOCore Full Backup Script
# Run this on the GCP VM as a user with sudo access.
# Usage: bash vm-backup.sh

set -euo pipefail

BACKUP_DIR="$HOME/socore-full-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== SOCore Full Backup ==="
echo "Target: $BACKUP_DIR"
echo "Time:   $TIMESTAMP"
echo ""

# ── 1. Create directory structure ───────────────────────────────────────────
mkdir -p "$BACKUP_DIR"/{wazuh,misp,cortex,shuffle,docker,nginx,letsencrypt,env}

# ── 2. Wazuh ────────────────────────────────────────────────────────────────
echo "[+] Wazuh..."
sudo cp /var/ossec/etc/ossec.conf              "$BACKUP_DIR/wazuh/"        2>/dev/null || echo "    SKIP: ossec.conf not found"
sudo cp /var/ossec/etc/rules/local_rules.xml   "$BACKUP_DIR/wazuh/"        2>/dev/null || echo "    SKIP: local_rules.xml not found"
sudo cp /var/ossec/etc/client.keys             "$BACKUP_DIR/wazuh/"        2>/dev/null || echo "    SKIP: client.keys not found"
sudo cp -r /var/ossec/integrations             "$BACKUP_DIR/wazuh/integrations" 2>/dev/null || echo "    SKIP: integrations dir not found"
# Also grab custom integration scripts from the project repo if present
if [ -d "$HOME/SOCore/wazuh-integration" ]; then
  cp -r "$HOME/SOCore/wazuh-integration"       "$BACKUP_DIR/wazuh/wazuh-integration-repo"
fi
sudo chown -R "$USER":"$USER" "$BACKUP_DIR/wazuh"

# ── 3. MISP ─────────────────────────────────────────────────────────────────
echo "[+] MISP events export..."
MISP_URL="${MISP_URL:-https://localhost}"
MISP_KEY="${MISP_KEY:-}"   # set MISP_KEY env var before running, or edit here

if [ -n "$MISP_KEY" ]; then
  curl -sk -o "$BACKUP_DIR/misp/events_export.json" \
    -H "Authorization: $MISP_KEY" \
    -H "Accept: application/json" \
    "$MISP_URL/events/restSearch/json" \
    && echo "    Events exported" \
    || echo "    WARN: MISP export failed (check MISP_KEY/MISP_URL)"
else
  echo "    SKIP: MISP_KEY not set. Export manually:"
  echo "      curl -sk -H 'Authorization: <key>' -H 'Accept: application/json' \\"
  echo "           https://localhost/events/restSearch/json > $BACKUP_DIR/misp/events_export.json"
fi

# MISP config files (Docker volume paths – adjust if using non-Docker install)
for F in /var/www/MISP/app/Config/config.php \
          /var/www/MISP/app/Config/database.php; do
  sudo cp "$F" "$BACKUP_DIR/misp/" 2>/dev/null || echo "    SKIP: $F not found"
done
sudo chown -R "$USER":"$USER" "$BACKUP_DIR/misp" 2>/dev/null || true

# ── 4. Cortex ────────────────────────────────────────────────────────────────
echo "[+] Cortex analyzer list..."
CORTEX_URL="${CORTEX_URL:-http://localhost:9001}"
CORTEX_KEY="${CORTEX_KEY:-}"

if [ -n "$CORTEX_KEY" ]; then
  curl -s -o "$BACKUP_DIR/cortex/analyzers.json" \
    -H "Authorization: Bearer $CORTEX_KEY" \
    "$CORTEX_URL/api/analyzer" \
    && echo "    Analyzers listed" \
    || echo "    WARN: Cortex export failed"
else
  echo "    SKIP: CORTEX_KEY not set. Export manually:"
  echo "      curl -s -H 'Authorization: Bearer <key>' \\"
  echo "           http://localhost:9001/api/analyzer > $BACKUP_DIR/cortex/analyzers.json"
fi

# Cortex config
for F in /etc/cortex/application.conf; do
  sudo cp "$F" "$BACKUP_DIR/cortex/" 2>/dev/null || echo "    SKIP: $F not found"
done
sudo chown -R "$USER":"$USER" "$BACKUP_DIR/cortex" 2>/dev/null || true

# ── 5. Shuffle ───────────────────────────────────────────────────────────────
echo "[+] Shuffle workflows export..."
SHUFFLE_URL="${SHUFFLE_URL:-http://localhost:3001}"
SHUFFLE_KEY="${SHUFFLE_KEY:-}"

if [ -n "$SHUFFLE_KEY" ]; then
  curl -s -o "$BACKUP_DIR/shuffle/workflows.json" \
    -H "Authorization: Bearer $SHUFFLE_KEY" \
    "$SHUFFLE_URL/api/v1/workflows" \
    && echo "    Workflows exported" \
    || echo "    WARN: Shuffle export failed"
else
  echo "    SKIP: SHUFFLE_KEY not set. Export manually:"
  echo "      curl -s -H 'Authorization: Bearer <key>' \\"
  echo "           http://localhost:3001/api/v1/workflows > $BACKUP_DIR/shuffle/workflows.json"
fi

# ── 6. Docker Compose files ──────────────────────────────────────────────────
echo "[+] Docker Compose files..."
for D in "$HOME"/misp "$HOME"/cortex "$HOME"/shuffle "$HOME"/wazuh-docker \
          "$HOME"/SOCore/socore-backend; do
  if [ -f "$D/docker-compose.yml" ]; then
    NAME=$(basename "$D")
    cp "$D/docker-compose.yml" "$BACKUP_DIR/docker/${NAME}-docker-compose.yml"
    echo "    Copied $D/docker-compose.yml"
  fi
done
# Also search common paths
find "$HOME" -maxdepth 3 -name "docker-compose.yml" 2>/dev/null | while read -r F; do
  DEST="$BACKUP_DIR/docker/$(echo "$F" | tr '/' '_').yml"
  cp "$F" "$DEST" 2>/dev/null || true
done

# ── 7. socore-backend .env ───────────────────────────────────────────────────
echo "[+] socore-backend .env..."
for ENV_PATH in "$HOME/SOCore/socore-backend/.env" \
                "$HOME/socore-backend/.env" \
                "/opt/socore-backend/.env"; do
  if [ -f "$ENV_PATH" ]; then
    cp "$ENV_PATH" "$BACKUP_DIR/env/socore-backend.env"
    echo "    Copied $ENV_PATH"
    break
  fi
done

# ── 8. SSL certificates ──────────────────────────────────────────────────────
echo "[+] SSL certificates (Let's Encrypt)..."
if [ -d /etc/letsencrypt ]; then
  sudo cp -r /etc/letsencrypt "$BACKUP_DIR/letsencrypt/"
  sudo chown -R "$USER":"$USER" "$BACKUP_DIR/letsencrypt"
  echo "    Copied /etc/letsencrypt"
else
  echo "    SKIP: /etc/letsencrypt not found"
fi

# ── 9. Nginx ──────────────────────────────────────────────────────────────────
echo "[+] Nginx config..."
if [ -d /etc/nginx/sites-available ]; then
  sudo cp -r /etc/nginx/sites-available "$BACKUP_DIR/nginx/"
  sudo chown -R "$USER":"$USER" "$BACKUP_DIR/nginx"
  echo "    Copied /etc/nginx/sites-available"
else
  echo "    SKIP: /etc/nginx/sites-available not found"
fi

# ── 10. Archive ───────────────────────────────────────────────────────────────
echo ""
echo "[+] Creating archive..."
tar czf "$HOME/socore-full-backup.tar.gz" -C "$HOME" socore-full-backup
echo "    Created: $HOME/socore-full-backup.tar.gz"
echo "    Size:    $(du -sh "$HOME/socore-full-backup.tar.gz" | cut -f1)"

# ── 11. Secrets zip (password-protected) ─────────────────────────────────────
echo "[+] Creating password-protected secrets zip..."
if [ -f "$BACKUP_DIR/env/socore-backend.env" ]; then
  cd "$HOME"
  # ZIP_PASS env dəyişəni ilə non-interaktiv icra
  if [ -z "${ZIP_PASS:-}" ]; then
    echo "    SKIP: ZIP_PASS env dəyişəni təyin edilməyib"
    exit 1
  fi
  zip -P "$ZIP_PASS" socore-secrets.zip socore-full-backup/env/socore-backend.env
  echo "    Created: $HOME/socore-secrets.zip"
  echo "    Size:    $(du -sh "$HOME/socore-secrets.zip" | cut -f1)"
else
  echo "    SKIP: .env not found, skipping secrets zip"
fi

echo ""
echo "=== Done. Files ready for download: ==="
echo "  ~/socore-full-backup.tar.gz  (full config archive)"
echo "  ~/socore-secrets.zip         (password-protected .env)"
echo ""
echo "Download with:"
echo "  gcloud compute scp socore:~/socore-full-backup.tar.gz . --zone=us-central1-a --project=gen-lang-client-0361659433"
echo "  gcloud compute scp socore:~/socore-secrets.zip . --zone=us-central1-a --project=gen-lang-client-0361659433"

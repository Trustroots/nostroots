#!/bin/bash
set -e

CONTAINER_NAME="${STRFRY_CONTAINER:-nostroots-server-strfry-nostr-relay-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_FILE="${SCRIPT_DIR}/backups/strfry-backup-$(date +%Y%m%d-%H%M%S).jsonl"

mkdir -p "${SCRIPT_DIR}/backups"

echo "Stopping container..."
docker stop "${CONTAINER_NAME}" || true

echo "Exporting database..."
docker run --rm \
  -v "${SCRIPT_DIR}/strfry.conf:/etc/strfry.conf:ro" \
  -v "${SCRIPT_DIR}/strfry-db:/app/strfry-db:ro" \
  ghcr.io/trustroots/strfry:master \
  export > "${BACKUP_FILE}"

echo "Starting container..."
docker start "${CONTAINER_NAME}"

echo "Backup saved to: ${BACKUP_FILE}"

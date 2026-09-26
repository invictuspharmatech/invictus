#!/bin/bash
# Dump the HOST MySQL/MariaDB (invictuspharma). Run on master or, better, on the slave.
# Usage:
#   sudo bash deploy/mysql/backup-host.sh
# Cron (daily 02:15):
#   15 2 * * * root /var/www/invictus/deploy/mysql/backup-host.sh

set -euo pipefail

DB_NAME="${MYSQL_DATABASE:-invictuspharma}"
BACKUP_DIR="${MYSQL_BACKUP_DIR:-/var/backups/invictus-mysql}"
KEEP_DAYS="${MYSQL_BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%F_%H%M)"
FILE="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"

mysqldump \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --default-character-set=utf8mb4 \
  "${DB_NAME}" | gzip -c > "${FILE}"

chmod 640 "${FILE}"
find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete

echo "Wrote ${FILE}"
ls -lh "${FILE}"

#!/bin/bash
set -euo pipefail

LOG="/srv/five9/logs/ingest.log"
TZ_REGION="America/Los_Angeles"
SOURCE_BASE="/five9sftp/upload/SB CS"
TODAY="$(TZ="${TZ_REGION}" date +%m_%d_%Y)"
SOURCE_DIR="${SOURCE_BASE}/${TODAY}/"
DEST_DIR="/srv/five9/incoming/"
CLEANUP_SCRIPT="/srv/five9/cleanup.sh"
DISK_TRIGGER_PERCENT=70

mkdir -p /srv/five9/{incoming,logs}

DISK_BEFORE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
echo "$(date): Starting ingest... (disk ${DISK_BEFORE}%, source ${SOURCE_DIR})" >> "${LOG}"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "$(date): Source directory not found: ${SOURCE_DIR}" >> "${LOG}"
  exit 0
fi

rsync -av --update "${SOURCE_DIR}" "${DEST_DIR}" >> "${LOG}" 2>&1

echo "$(date): Ingest complete" >> "${LOG}"

DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
echo "$(date): Disk usage after ingest: ${DISK_USAGE}%" >> "${LOG}"

if [ "${DISK_USAGE}" -ge "${DISK_TRIGGER_PERCENT}" ]; then
  echo "$(date): Disk usage above ${DISK_TRIGGER_PERCENT}%, running cleanup" >> "${LOG}"
  if [ -x "${CLEANUP_SCRIPT}" ]; then
    "${CLEANUP_SCRIPT}" >> "${LOG}" 2>&1 || echo "$(date): Cleanup failed" >> "${LOG}"
  else
    echo "$(date): Cleanup script not found or not executable" >> "${LOG}"
  fi
fi

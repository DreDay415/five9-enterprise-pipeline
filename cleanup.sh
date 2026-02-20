#!/bin/bash
set -euo pipefail

LOG="/srv/five9/logs/cleanup.log"
PROCESSED_DB="/srv/five9/processed-files.json"
SOURCE_DIR="/sftp/five9sftp/recordings/SB CS"
DEST_DIR="/srv/five9/incoming"

THRESHOLD_HIGH=70
THRESHOLD_LOW=60
THRESHOLD_EMERGENCY=85
MIN_AGE_HOURS=24
MIN_KEEP_COUNT=100
DRY_RUN="${DRY_RUN:-0}"

log() {
  echo "$(date -Iseconds): $*" | tee -a "${LOG}"
}

get_disk_usage() {
  df / | tail -1 | awk '{print $5}' | sed 's/%//'
}

ensure_db() {
  if [ ! -f "${PROCESSED_DB}" ]; then
    echo '{"processed":[],"last_cleanup":null,"disk_usage_before":null,"disk_usage_after":null}' > "${PROCESSED_DB}"
  fi
}

ensure_dependencies() {
  if ! command -v jq >/dev/null 2>&1; then
    log "ERROR: jq is required for cleanup.sh"
    exit 1
  fi
}

delete_file() {
  local filename="$1"
  local deleted_from=""

  if [ "${DRY_RUN}" = "1" ]; then
    log "DRY_RUN: Would delete ${filename} from ${DEST_DIR} and ${SOURCE_DIR}"
    return 0
  fi

  if [ -d "${DEST_DIR}" ]; then
    if find "${DEST_DIR}" -type f -name "${filename}" -print -delete | grep -q .; then
      deleted_from="incoming"
    fi
  fi

  if [ -d "${SOURCE_DIR}" ]; then
    if find "${SOURCE_DIR}" -type f -name "${filename}" -print -delete | grep -q .; then
      deleted_from="${deleted_from:+${deleted_from},}sftp"
    fi
  fi

  echo "${deleted_from}"
}

ensure_dependencies
ensure_db

DISK_BEFORE=$(get_disk_usage)
log "Disk usage before cleanup: ${DISK_BEFORE}%"

if [ "${DISK_BEFORE}" -lt "${THRESHOLD_HIGH}" ]; then
  log "Disk usage below ${THRESHOLD_HIGH}%, no cleanup needed"
  exit 0
fi

if [ "${DISK_BEFORE}" -ge 80 ]; then
  log "WARNING: Disk usage >= 80%"
fi

if [ "${DISK_BEFORE}" -ge "${THRESHOLD_EMERGENCY}" ]; then
  log "EMERGENCY: Disk usage >= ${THRESHOLD_EMERGENCY}%"
fi

CUTOFF_TIME=$(date -d "-${MIN_AGE_HOURS} hours" +%s)

ACTIVE_COUNT=$(jq '[.processed[] | select(.deleted == null)] | length' "${PROCESSED_DB}")
SAFE_DELETE_COUNT=$((ACTIVE_COUNT - MIN_KEEP_COUNT))
if [ "${SAFE_DELETE_COUNT}" -lt 0 ]; then
  SAFE_DELETE_COUNT=0
fi

CANDIDATES=$(jq -r --arg cutoff "${CUTOFF_TIME}" '
  .processed
  | map(select(.deleted == null and .notion_uploaded != null and (.notion_uploaded | fromdateiso8601) < ($cutoff | tonumber)))
  | sort_by(.notion_uploaded)
  | .[] | .filename
' "${PROCESSED_DB}")

if [ -z "${CANDIDATES}" ]; then
  log "No eligible processed files older than ${MIN_AGE_HOURS}h"
  exit 0
fi

DELETED_COUNT=0
while IFS= read -r filename; do
  if [ -z "${filename}" ]; then
    continue
  fi

  CURRENT_DISK=$(get_disk_usage)
  if [ "${CURRENT_DISK}" -lt "${THRESHOLD_LOW}" ] && [ "${DRY_RUN}" != "1" ]; then
    log "Disk usage below ${THRESHOLD_LOW}%, stopping cleanup"
    break
  fi

  if [ "${DELETED_COUNT}" -ge "${SAFE_DELETE_COUNT}" ] && [ "${DRY_RUN}" != "1" ]; then
    log "Reached minimum keep count (${MIN_KEEP_COUNT})"
    break
  fi

  deleted_from=$(delete_file "${filename}")

  if [ -n "${deleted_from}" ] || [ "${DRY_RUN}" = "1" ]; then
    if [ "${DRY_RUN}" != "1" ]; then
      jq --arg file "${filename}" --arg time "$(date -Iseconds)" --arg from "${deleted_from}" '
        .processed |= map(
          if .filename == $file then
            . + {deleted: $time, deletion_reason: "disk_space_threshold", deleted_from: $from}
          else . end
        )
      ' "${PROCESSED_DB}" > "${PROCESSED_DB}.tmp" && mv "${PROCESSED_DB}.tmp" "${PROCESSED_DB}"
      log "Deleted ${filename} from ${deleted_from}"
    fi
    DELETED_COUNT=$((DELETED_COUNT + 1))
  else
    log "WARN: File ${filename} not found in source or destination"
  fi
done <<< "${CANDIDATES}"

DISK_AFTER=$(get_disk_usage)
if [ "${DRY_RUN}" != "1" ]; then
  jq --arg time "$(date -Iseconds)" --arg before "${DISK_BEFORE}%" --arg after "${DISK_AFTER}%" '
    .last_cleanup = $time
    | .disk_usage_before = $before
    | .disk_usage_after = $after
  ' "${PROCESSED_DB}" > "${PROCESSED_DB}.tmp" && mv "${PROCESSED_DB}.tmp" "${PROCESSED_DB}"
fi

log "Cleanup complete: deleted ${DELETED_COUNT} files, disk ${DISK_BEFORE}% -> ${DISK_AFTER}%"

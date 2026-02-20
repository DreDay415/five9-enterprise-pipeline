#!/bin/bash
set -euo pipefail

PROCESSED_DB="/srv/five9/processed-files.json"
LOG="/srv/five9/logs/processed.log"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <filename> <notion_page_id> [transcribed_at]" >&2
  exit 1
fi

FILENAME="$1"
NOTION_ID="$2"
TRANSCRIBED_AT="${3:-$(date -Iseconds)}"
NOTION_UPLOADED_AT="$(date -Iseconds)"

mkdir -p /srv/five9/logs

if ! command -v jq >/dev/null 2>&1; then
  echo "$(date -Iseconds): ERROR: jq is required for mark-processed.sh" >> "${LOG}"
  exit 1
fi

if [ ! -f "${PROCESSED_DB}" ]; then
  echo '{"processed":[],"last_cleanup":null,"disk_usage_before":null,"disk_usage_after":null}' > "${PROCESSED_DB}"
fi

EXISTS=$(jq --arg file "${FILENAME}" '.processed | any(.filename == $file)' "${PROCESSED_DB}")

if [ "${EXISTS}" = "true" ]; then
  jq --arg file "${FILENAME}" \
     --arg notion "${NOTION_ID}" \
     --arg transcribed "${TRANSCRIBED_AT}" \
     --arg uploaded "${NOTION_UPLOADED_AT}" '
    .processed |= map(
      if .filename == $file then
        . + {transcribed: $transcribed, notion_uploaded: $uploaded, notion_page_id: $notion}
      else . end
    )
  ' "${PROCESSED_DB}" > "${PROCESSED_DB}.tmp" && mv "${PROCESSED_DB}.tmp" "${PROCESSED_DB}"
  echo "$(date -Iseconds): Updated ${FILENAME} with Notion ID ${NOTION_ID}" >> "${LOG}"
else
  jq --arg file "${FILENAME}" \
     --arg notion "${NOTION_ID}" \
     --arg transcribed "${TRANSCRIBED_AT}" \
     --arg uploaded "${NOTION_UPLOADED_AT}" '
    .processed += [{
      filename: $file,
      transcribed: $transcribed,
      notion_uploaded: $uploaded,
      notion_page_id: $notion,
      deleted: null,
      deletion_reason: null,
      deleted_from: null
    }]
  ' "${PROCESSED_DB}" > "${PROCESSED_DB}.tmp" && mv "${PROCESSED_DB}.tmp" "${PROCESSED_DB}"
  echo "$(date -Iseconds): Marked ${FILENAME} as processed (Notion: ${NOTION_ID})" >> "${LOG}"
fi

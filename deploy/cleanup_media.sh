#!/bin/bash
# Periodic cleanup of disposable media on the VM.
# Deletes scan images and dynamically-generated voicebot audio older than
# RETENTION_DAYS. Does NOT touch the permanent voicebot prompt recordings
# (followup_q1.wav, scenario1.wav, etc.) — only the per-call dynamic/ files.
#
# Run daily via cron (see HETZNER_DEPLOY.md).
set -e

MEDIA_ROOT="${MEDIA_ROOT:-/opt/medical_camp/media}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Old scanned report images
if [ -d "$MEDIA_ROOT/scanned_reports" ]; then
    find "$MEDIA_ROOT/scanned_reports" -type f -mtime +"$RETENTION_DAYS" -delete
fi

# Per-call dynamic voicebot audio (TTS generated per call)
if [ -d "$MEDIA_ROOT/voicebot_prompts/dynamic" ]; then
    find "$MEDIA_ROOT/voicebot_prompts/dynamic" -type f -mtime +"$RETENTION_DAYS" -delete
fi

echo "$(date -u +%FT%TZ) cleanup done (retention ${RETENTION_DAYS}d)"

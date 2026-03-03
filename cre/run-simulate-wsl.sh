#!/usr/bin/env bash
# Run from ~/dev/SentinelFlow/cre after one-time: cre login
# Usage: ./run-simulate-wsl.sh [payload-file]
# Default payload: sentinelflow/payload-a.json

set -e
export PATH="$HOME/.cre/bin:$PATH"
cd "$(dirname "$0")"
PAYLOAD="${1:-sentinelflow/payload-a.json}"
echo "Running CRE simulate (payload=$PAYLOAD)..."
cre workflow simulate ./sentinelflow --target staging-settings --non-interactive --trigger-index 0 --http-payload "$PAYLOAD"

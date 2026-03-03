#!/usr/bin/env bash
# From ~/dev/SentinelFlow/cre: ensure Javy plugin exists, then run CRE simulate.
# Requires: Linux Bun (~/.bun/bin), CRE CLI (~/.cre/bin), and one-time `cre login`.
set -e
export PATH="$HOME/.bun/bin:$HOME/.cre/bin:$PATH"
cd "$(dirname "$0")"
WORKFLOW_DIR="sentinelflow"
PLUGIN_DIST="$WORKFLOW_DIR/node_modules/@chainlink/cre-sdk-javy-plugin/dist"
PLUGIN_WASM="$PLUGIN_DIST/javy-chainlink-sdk.plugin.wasm"
JAVY_CACHE="$HOME/.cache/javy/v5.0.4/linux-x64/javy"

if [[ ! -f "$PLUGIN_WASM" ]]; then
  echo "Javy plugin not found. Building it..."
  if [[ ! -f "$JAVY_CACHE" ]]; then
    echo "Run 'bun x cre-setup' from $WORKFLOW_DIR first (or install Bun and run it)."
    exit 1
  fi
  "$JAVY_CACHE" init-plugin \
    "$PLUGIN_DIST/javy_chainlink_sdk.wasm" \
    -o "$PLUGIN_WASM"
  echo "Plugin built."
fi

PAYLOAD="${1:-$WORKFLOW_DIR/payload-a.json}"
echo "Running CRE simulate (payload=$PAYLOAD)..."
cre workflow simulate "./$WORKFLOW_DIR" --target staging-settings --non-interactive --trigger-index 0 --http-payload "$PAYLOAD"

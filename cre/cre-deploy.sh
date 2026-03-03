#!/usr/bin/env bash
# Run after: cre account access (request access + get approval) and wallet has mainnet ETH.
# From cre/: ./cre-deploy.sh [path-to-.env]
# Example: ./cre-deploy.sh /mnt/c/dev/SentinelFlow/.env   (WSL) or ./cre-deploy.sh ../.env
set -e
ENV_FILE="${1:-.env}"
export PATH="${HOME}/.bun/bin:${HOME}/.cre/bin:${PATH}"
cd "$(dirname "$0")"

echo "Using .env: $ENV_FILE"
echo "=== 1. Linking key (mainnet tx) ==="
cre account link-key --owner-label "SentinelFlow" --yes -e "$ENV_FILE"

echo ""
echo "=== 2. Deploying workflow ==="
cre workflow deploy ./sentinelflow --target staging-settings --yes -e "$ENV_FILE"

echo ""
echo "=== 3. Activating workflow ==="
cre workflow activate ./sentinelflow --target staging-settings --yes -e "$ENV_FILE"

echo ""
echo "Done. Workflow is deployed and active on the CRE network."

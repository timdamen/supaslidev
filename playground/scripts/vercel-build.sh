#!/usr/bin/env bash
set -euo pipefail

# Generate the static dashboard in deploy mode
SUPASLIDEV_PROJECT_ROOT="$PWD" \
SUPASLIDEV_PRESENTATIONS_DIR="$PWD/presentations" \
NUXT_PUBLIC_DEPLOY_MODE=true \
  node_modules/.bin/nuxt generate ../packages/supaslidev

# Copy output to dist for Vercel (vercel-static preset outputs here)
cp -r ../packages/supaslidev/.vercel/output/static dist

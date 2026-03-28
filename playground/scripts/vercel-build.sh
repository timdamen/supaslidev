#!/usr/bin/env bash
set -euo pipefail

# Symlink node_modules so nuxt can resolve itself from the supaslidev rootDir
ln -sf "$PWD/node_modules" ../packages/supaslidev/node_modules

# Generate the static dashboard in deploy mode
SUPASLIDEV_PROJECT_ROOT="$PWD" \
SUPASLIDEV_PRESENTATIONS_DIR="$PWD/presentations" \
NUXT_PUBLIC_DEPLOY_MODE=true \
  node_modules/.bin/nuxt generate ../packages/supaslidev

# Copy output to dist for Vercel
cp -r ../packages/supaslidev/.output/public dist

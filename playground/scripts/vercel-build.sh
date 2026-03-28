#!/usr/bin/env bash
set -euo pipefail

# Step 1: Build each Slidev presentation
for dir in presentations/*/; do
  id=$(basename "$dir")
  echo "Building presentation: $id"
  (cd "$dir" && npx slidev build --base "/presentations/$id/" --out dist)
done

# Step 2: Generate the Nuxt dashboard in deploy mode
SUPASLIDEV_PROJECT_ROOT="$PWD" \
SUPASLIDEV_PRESENTATIONS_DIR="$PWD/presentations" \
NUXT_PUBLIC_DEPLOY_MODE=true \
  node_modules/.bin/nuxt generate ../packages/supaslidev

# Step 3: Assemble output
cp -r ../packages/supaslidev/.vercel/output/static dist

# Copy each presentation's built files
for dir in presentations/*/; do
  id=$(basename "$dir")
  if [ -d "$dir/dist" ]; then
    mkdir -p "dist/presentations/$id"
    cp -r "$dir/dist/." "dist/presentations/$id/"
  fi
done

# Include presentations.json
cp .supaslidev/presentations.json dist/presentations.json

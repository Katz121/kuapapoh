#!/usr/bin/env bash
# Deploy the site to Cloudflare Pages (project: kuapapoh).
#
# Only files tracked by git are shipped, so the working folders that .gitignore
# keeps out of the repo (รวมรูป/, _scrape/) never reach the web. README.md and
# .gitignore are repo furniture, not site content, so they are dropped too.
#
#   ./scripts/deploy.sh          deploy whatever is committed right now
#
# Runs automatically on `git push` via .git/hooks/pre-push (see scripts/install-hooks.sh).
set -euo pipefail

PROJECT=kuapapoh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"

git ls-files -z \
  | grep -zEv '^(README\.md|\.gitignore|scripts/.*)$' \
  | while IFS= read -r -d '' f; do
      mkdir -p "$STAGE/$(dirname "$f")"
      cp "$f" "$STAGE/$f"
    done

count=$(find "$STAGE" -type f | wc -l)
echo "→ deploying $count files to $PROJECT.pages.dev"

npx wrangler pages deploy "$STAGE" \
  --project-name="$PROJECT" \
  --branch=main \
  --commit-dirty=true

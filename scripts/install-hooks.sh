#!/usr/bin/env bash
# Install the local git hooks. Run once per clone:
#
#   ./scripts/install-hooks.sh
#
# Adds a pre-push hook so every `git push` to main also ships the site to
# Cloudflare Pages. Needs `npx wrangler login` to have been run on this machine.
# Skip a deploy for one push with:  SKIP_DEPLOY=1 git push
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"

cat > "$HOOK" <<'HOOK_EOF'
#!/usr/bin/env bash
# Auto-deploy to Cloudflare Pages on every push to main. Installed by scripts/install-hooks.sh
set -euo pipefail

[ "${SKIP_DEPLOY:-}" = "1" ] && { echo "↷ SKIP_DEPLOY=1 · ข้าม deploy"; exit 0; }

pushing_main=0
while read -r _local_ref _local_sha remote_ref _remote_sha; do
  case "$remote_ref" in refs/heads/main) pushing_main=1 ;; esac
done
[ "$pushing_main" = "1" ] || exit 0

ROOT="$(git rev-parse --show-toplevel)"
echo "── auto-deploy → Cloudflare Pages ──"
if ! bash "$ROOT/scripts/deploy.sh"; then
  echo "⚠ deploy ไม่ผ่าน · push ต่อไปตามปกติ · รัน ./scripts/deploy.sh เองอีกที" >&2
fi
HOOK_EOF

chmod +x "$HOOK"
echo "✓ ติดตั้ง pre-push hook แล้ว → $HOOK"

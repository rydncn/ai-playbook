#!/usr/bin/env bash
# One-time setup on a machine: links the master personal CLAUDE.md into ~/.claude,
# then registers this repo as a plugin marketplace and installs every plugin in it.
#
# Usage: scripts/install.sh [github-owner/repo]
#   With an owner/repo, the marketplace is added from GitHub (recommended: you get updates
#   on push). Without one, it is added from this local folder.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$REPO_DIR/user/CLAUDE.md"
TARGET="$HOME/.claude/CLAUDE.md"

mkdir -p "$HOME/.claude"

# 1. Personal defaults: symlink so edits in the repo apply immediately.
if [ -L "$TARGET" ] && [ "$(readlink "$TARGET")" = "$SOURCE" ]; then
  echo "✔ ~/.claude/CLAUDE.md already linked"
else
  if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
    BACKUP="$TARGET.backup.$(date +%Y%m%d%H%M%S)"
    mv "$TARGET" "$BACKUP"
    echo "• Existing ~/.claude/CLAUDE.md moved to $BACKUP (merge anything useful into user/CLAUDE.md)"
  fi
  ln -s "$SOURCE" "$TARGET"
  echo "✔ Linked ~/.claude/CLAUDE.md → $SOURCE"
fi

# 2. Plugin marketplace and plugin.
if ! command -v claude >/dev/null 2>&1; then
  echo "! Claude Code CLI not found; install it, then re-run this script."
  exit 1
fi

MARKETPLACE_SOURCE="${1:-$REPO_DIR}"
if claude plugin marketplace list 2>/dev/null | grep -q "ai-playbook"; then
  echo "✔ ai-playbook marketplace already added"
else
  claude plugin marketplace add "$MARKETPLACE_SOURCE"
fi

# Superpowers installed from another marketplace would load twice.
if claude plugin list 2>/dev/null | grep -E "superpowers@" | grep -vq "superpowers@ai-playbook"; then
  echo "! Superpowers is already installed from another marketplace. Uninstall that copy"
  echo "  (claude plugin uninstall superpowers@<that-marketplace>) so it isn't loaded twice."
fi

FAILED=()
for plugin in playbook superpowers pocock-extras codex ponytail security-audit; do
  claude plugin install "$plugin@ai-playbook" || FAILED+=("$plugin")
done
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "! These failed to install: ${FAILED[*]}. Re-run this script, or install them from /plugin."
fi

echo
echo "Done. Two steps left, in Claude Code:"
echo "  1. /plugin → Marketplaces → ai-playbook → Enable auto-update, so pushes reach this machine."
echo "  2. /codex:setup, to check Codex is installed and signed in (leave the review gate off)."

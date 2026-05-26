#!/usr/bin/env bash
# uninstall.sh — remove ccg from the user's system.
#
# What it does:
#   1. Removes the PATH marker block from common shell rc files.
#   2. Removes the entire CCG_HOME directory.
#
# Env overrides:
#   CCG_HOME — installation root (default: ~/.claude-code-gui)

set -euo pipefail

CCG_HOME="${CCG_HOME:-$HOME/.claude-code-gui}"

say() { printf '%s\n' "$*"; }

if [[ ! -d "$CCG_HOME" ]]; then
  say "Nothing to uninstall: $CCG_HOME does not exist."
  exit 0
fi

# Source helpers from the installation if available (preferred path).
if [[ -r "$CCG_HOME/lib/install_util.sh" ]]; then
  # shellcheck source=lib/install_util.sh
  source "$CCG_HOME/lib/install_util.sh"
else
  # Inline fallback (installation may be partial). Keep in sync with install_util.sh.
  CCG_PATH_MARKER_BEGIN="# claude-code-gui (ccg) ↓ DO NOT EDIT"
  CCG_PATH_MARKER_END="# claude-code-gui (ccg) ↑"
  remove_path_block() {
    local rc_file=$1
    [[ -f "$rc_file" ]] || return 0
    if ! grep -qF "$CCG_PATH_MARKER_BEGIN" "$rc_file" 2>/dev/null; then
      return 0
    fi
    local tmp; tmp=$(mktemp)
    awk -v begin="$CCG_PATH_MARKER_BEGIN" -v end="$CCG_PATH_MARKER_END" '
      $0 == begin { skip=1; next }
      $0 == end   { skip=0; next }
      !skip       { print }
    ' "$rc_file" > "$tmp"
    mv "$tmp" "$rc_file"
  }
fi

# Strip PATH block from every rc we might have touched.
# We don't know which one we used originally, so try all common ones.
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
  if [[ -f "$rc" ]] && grep -qF 'claude-code-gui (ccg)' "$rc" 2>/dev/null; then
    remove_path_block "$rc"
    say "Removed PATH entry from $rc"
  fi
done

say "Removing $CCG_HOME..."
rm -rf "$CCG_HOME"

say ""
say "✔ Uninstall complete. You may close any open ccg sessions."
say "  (Open a new terminal to refresh PATH.)"

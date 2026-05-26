#!/usr/bin/env bash
# install_util.sh — shell rc detection and idempotent PATH block management.
#
# Public API:
#   detect_shell_rc                       → echoes "<shell>|<rc_path>"
#   add_to_path_idempotent <rc> <path>    → echoes "added" | "exists"
#   remove_path_block <rc>                → strips marker block (idempotent)
#
# Marker block format (zsh/bash compatible):
#   # claude-code-gui (ccg) ↓ DO NOT EDIT
#   export PATH="<path>:$PATH"
#   # claude-code-gui (ccg) ↑

CCG_PATH_MARKER_BEGIN="# claude-code-gui (ccg) ↓ DO NOT EDIT"
CCG_PATH_MARKER_END="# claude-code-gui (ccg) ↑"

detect_shell_rc() {
  local shell_name=""
  if [[ -n "${SHELL:-}" ]]; then
    shell_name=$(basename "$SHELL")
  fi
  case "$shell_name" in
    zsh)  printf 'zsh|%s' "$HOME/.zshrc" ;;
    bash) printf 'bash|%s' "$HOME/.bashrc" ;;
    fish) printf 'fish|%s' "$HOME/.config/fish/config.fish" ;;
    *)    printf 'unknown|' ;;
  esac
}

# Add an idempotent marker block to a shell rc file.
# Creates the file (and parent dirs) if missing.
add_to_path_idempotent() {
  local rc_file=$1
  local path_to_add=$2

  mkdir -p "$(dirname "$rc_file")"
  touch "$rc_file"

  if grep -qF "$CCG_PATH_MARKER_BEGIN" "$rc_file" 2>/dev/null; then
    printf 'exists'
    return 0
  fi

  {
    printf '\n%s\n' "$CCG_PATH_MARKER_BEGIN"
    printf 'export PATH="%s:$PATH"\n' "$path_to_add"
    printf '%s\n' "$CCG_PATH_MARKER_END"
  } >> "$rc_file"
  printf 'added'
  return 0
}

# Remove the marker block (and everything between) from a rc file.
# No-op if file or marker absent.
remove_path_block() {
  local rc_file=$1
  [[ -f "$rc_file" ]] || return 0

  if ! grep -qF "$CCG_PATH_MARKER_BEGIN" "$rc_file" 2>/dev/null; then
    return 0
  fi

  local tmp
  tmp=$(mktemp)
  awk -v begin="$CCG_PATH_MARKER_BEGIN" -v end="$CCG_PATH_MARKER_END" '
    $0 == begin { skip=1; next }
    $0 == end   { skip=0; next }
    !skip       { print }
  ' "$rc_file" > "$tmp"
  mv "$tmp" "$rc_file"
  return 0
}

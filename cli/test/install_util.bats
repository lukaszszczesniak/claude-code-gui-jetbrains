#!/usr/bin/env bats
# Tests for cli/lib/install_util.sh — shell detection + PATH manipulation.

load 'helpers/common'

setup() {
  isolate_env
  # shellcheck source=../lib/install_util.sh
  source "$CLI_LIB/install_util.sh"
}

# ─── detect_shell_rc: returns "<shell>|<rc_path>" ─────────────

@test "detect_shell_rc: zsh" {
  export SHELL=/bin/zsh
  run detect_shell_rc
  [ "$status" -eq 0 ]
  [ "$output" = "zsh|$HOME/.zshrc" ]
}

@test "detect_shell_rc: bash" {
  export SHELL=/bin/bash
  run detect_shell_rc
  [ "$output" = "bash|$HOME/.bashrc" ]
}

@test "detect_shell_rc: fish" {
  export SHELL=/usr/local/bin/fish
  run detect_shell_rc
  [ "$output" = "fish|$HOME/.config/fish/config.fish" ]
}

@test "detect_shell_rc: unknown shell yields unknown|" {
  export SHELL=/bin/csh
  run detect_shell_rc
  [ "$output" = "unknown|" ]
}

@test "detect_shell_rc: empty SHELL yields unknown|" {
  unset SHELL
  run detect_shell_rc
  [ "$output" = "unknown|" ]
}

# ─── add_to_path_idempotent ──────────────────────────────────

@test "add_to_path_idempotent: first call adds marker block + line" {
  local rc="$HOME/.zshrc"
  run add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"
  [ "$status" -eq 0 ]
  [ "$output" = "added" ]
  grep -qF 'claude-code-gui (ccg)' "$rc"
  grep -qF 'export PATH="' "$rc"
  grep -qF "$HOME/.claude-code-gui/bin" "$rc"
}

@test "add_to_path_idempotent: second call skips (status=exists, file unchanged)" {
  local rc="$HOME/.zshrc"
  add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"
  local before
  before=$(cat "$rc")

  run add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"
  [ "$status" -eq 0 ]
  [ "$output" = "exists" ]

  local after
  after=$(cat "$rc")
  [ "$before" = "$after" ]
}

@test "add_to_path_idempotent: creates rc file if missing" {
  local rc="$HOME/.zshrc"
  [ ! -f "$rc" ]
  run add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"
  [ "$status" -eq 0 ]
  [ -f "$rc" ]
}

@test "add_to_path_idempotent: creates parent dirs for nested rc (fish-style)" {
  local rc="$HOME/.config/fish/config.fish"
  run add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"
  [ "$status" -eq 0 ]
  [ -f "$rc" ]
}

@test "add_to_path_idempotent: preserves pre-existing rc content" {
  local rc="$HOME/.zshrc"
  printf '%s\n' "alias ll='ls -la'" > "$rc"
  printf '%s\n' "export EDITOR=vim" >> "$rc"

  add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"

  grep -qF "alias ll='ls -la'" "$rc"
  grep -qF 'export EDITOR=vim' "$rc"
}

# ─── remove_path_block ───────────────────────────────────────

@test "remove_path_block: removes marker block, leaves other content" {
  local rc="$HOME/.zshrc"
  printf '%s\n' "alias ll='ls -la'" > "$rc"
  add_to_path_idempotent "$rc" "$HOME/.claude-code-gui/bin"
  printf '%s\n' "export EDITOR=vim" >> "$rc"

  run remove_path_block "$rc"
  [ "$status" -eq 0 ]

  grep -qF "alias ll='ls -la'" "$rc"
  grep -qF 'export EDITOR=vim' "$rc"
  ! grep -qF 'claude-code-gui' "$rc"
}

@test "remove_path_block: no-op when block absent" {
  local rc="$HOME/.zshrc"
  printf '%s\n' "unrelated" > "$rc"

  run remove_path_block "$rc"
  [ "$status" -eq 0 ]
  [ "$(cat "$rc")" = "unrelated" ]
}

@test "remove_path_block: no-op when rc file missing" {
  local rc="$HOME/.zshrc"
  [ ! -f "$rc" ]
  run remove_path_block "$rc"
  [ "$status" -eq 0 ]
}

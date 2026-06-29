#!/usr/bin/env bash
# dev.sh — one-button Standalone dev launcher.
#
# Starts both dev servers concurrently and opens the WebView in the browser:
#   - be-dev: Node.js backend (WebSocket server on :19836)
#   - wv-dev: Vite dev server for the WebView (usually :5173)
#
# Each server runs in its OWN process group (via setsid), so a single Ctrl+C
# (or the Stop button in the IDE) tears the whole tree down — no orphaned
# pnpm/node/vite processes left behind. The real Vite URL is parsed from its
# output (works even when Vite falls back to :5174), then opened in the browser.
#
# Run it through the build wrapper:  bash ./scripts/build.sh dev
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL_FALLBACK="http://localhost:5173"

C_DEV='\033[1;36m'; C_BE='\033[1;33m'; C_WV='\033[1;35m'; C_RST='\033[0m'
say() { printf "${C_DEV}[dev]${C_RST} %b\n" "$*"; }

# Session-leader PIDs (PID == PGID after setsid). Killing -PID nukes the tree.
# NOTE: not named GROUPS — that is a reserved bash array (the user's group IDs).
declare -a LEADERS=()
_cleaned=0

cleanup() {
  [ "$_cleaned" = 1 ] && return
  _cleaned=1
  trap - INT TERM EXIT
  echo
  say "Shutting down dev servers..."
  local pid
  for pid in "${LEADERS[@]:-}"; do kill -TERM "-$pid" 2>/dev/null || true; done
  sleep 1
  for pid in "${LEADERS[@]:-}"; do kill -KILL "-$pid" 2>/dev/null || true; done
  rm -rf "${tmp:-}" 2>/dev/null || true
  say "Done."
}
trap cleanup INT TERM EXIT

tmp="$(mktemp -d)"
be_log="$tmp/be.log"; wv_log="$tmp/wv.log"
: >"$be_log"; : >"$wv_log"

# Spawn `build.sh <args...>` detached in its own session/group, log to a file,
# and stream that file to the terminal with a colored [label] prefix.
spawn() { # <label> <color> <logfile> <build.sh args...>
  local label="$1" color="$2" logf="$3"; shift 3
  say "starting ${label}: build.sh $*"
  setsid bash "$ROOT/scripts/build.sh" "$@" >"$logf" 2>&1 &
  LEADERS+=("$!")
  local prefix; prefix="$(printf "%b[%s]%b " "$color" "$label" "$C_RST")"
  setsid bash -c '
    tail -n +1 -F "$1" 2>/dev/null \
      | while IFS= read -r line; do printf "%s%s\n" "$2" "$line"; done
  ' _ "$logf" "$prefix" &
  LEADERS+=("$!")
}

spawn backend "$C_BE" "$be_log" be-dev
spawn webview "$C_WV" "$wv_log" wv-dev

# Watch the webview log for Vite's real Local URL, then open it once.
setsid bash -c '
  log="$1"; fallback="$2"; url=""
  for ((i=0; i<60; i++)); do
    url="$(grep -aoE "https?://(localhost|127\.0\.0\.1):[0-9]+/?" "$log" 2>/dev/null | head -1)"
    [ -n "$url" ] && break
    sleep 0.5
  done
  [ -z "$url" ] && url="$fallback"
  printf "\033[1;36m[dev]\033[0m WebView ready -> %s\n" "$url"
  if   command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open     >/dev/null 2>&1; then open     "$url" >/dev/null 2>&1 || true
  else printf "\033[1;36m[dev]\033[0m Open it manually: %s\n" "$url"
  fi
' _ "$wv_log" "$URL_FALLBACK" &
LEADERS+=("$!")

say "be-dev + wv-dev starting. Press Ctrl+C (or Stop in the IDE) to shut everything down."

# Block until either dev server exits (crash or manual stop), then clean up.
# Plain polling keeps this bash 3.2-compatible (no `wait -n`).
be_pid="${LEADERS[0]}"; wv_pid="${LEADERS[2]}"
while kill -0 "$be_pid" 2>/dev/null && kill -0 "$wv_pid" 2>/dev/null; do
  sleep 1
done
# Reaching here via a signal means cleanup already ran (and printed its notice);
# only announce an unexpected exit when a server actually died on its own.
[ "$_cleaned" = 1 ] || say "A dev server exited on its own — shutting the rest down."
cleanup

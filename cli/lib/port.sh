#!/usr/bin/env bash
# port.sh — inspect and control port 19836.
#
# Public API:
#   port_status                       → "free" | "ours" | "foreign"
#   get_backend_version_via_port      → echoes "x.y.z" or returns 1
#   find_pid_on_port                  → echoes first PID or returns 1
#   graceful_kill_port [timeout_sec]  → SIGTERM then SIGKILL after timeout
#
# Requires version.sh (parse_backend_version) to be sourced first.

: "${CCG_PORT:=19836}"

# Probe /version on the target port.
# Returns 0 + version on stdout if we can parse the response as ours.
get_backend_version_via_port() {
  local body
  body=$(curl -fsSL --max-time 2 "http://127.0.0.1:${CCG_PORT}/version" 2>/dev/null) || return 1
  parse_backend_version "$body"
}

# Determine port occupancy state.
# Priority: our backend response > lsof match > free.
port_status() {
  if get_backend_version_via_port >/dev/null 2>&1; then
    printf 'ours'
    return 0
  fi

  # /version didn't return our shape. Check whether *anything* is listening.
  if find_pid_on_port >/dev/null 2>&1; then
    printf 'foreign'
    return 0
  fi

  printf 'free'
  return 0
}

# Return first PID listening on CCG_PORT (or nonzero if none).
# Uses lsof on unix; falls back to netstat on systems without lsof.
find_pid_on_port() {
  local raw pid
  if command -v lsof >/dev/null 2>&1; then
    raw=$(lsof -ti ":${CCG_PORT}" 2>/dev/null) || return 1
  elif command -v netstat >/dev/null 2>&1; then
    # netstat fallback (Linux/BSD variants differ; best-effort)
    raw=$(netstat -anp 2>/dev/null | awk -v p=":${CCG_PORT}" '$4 ~ p {print $7}' | sed 's|/.*||' | grep -E '^[0-9]+$' | head -1)
  else
    return 1
  fi

  if [[ -z "$raw" ]]; then
    return 1
  fi

  # Take the first non-empty line
  while IFS= read -r pid; do
    if [[ "$pid" =~ ^[0-9]+$ ]]; then
      printf '%s' "$pid"
      return 0
    fi
  done <<< "$raw"
  return 1
}

# Signal-send seam. Wrapped as a function so tests can override it
# (bash builtins like `kill` beat PATH overrides, so PATH-based mocking
# of the external /bin/kill does not work — function override does).
_kill_pid() {
  kill "$@"
}

# Send SIGTERM, wait up to <timeout> seconds, then SIGKILL.
# No-op (returns 0) if nothing is listening.
graceful_kill_port() {
  local timeout=${1:-3}
  local pid

  pid=$(find_pid_on_port) || return 0

  _kill_pid -TERM "$pid" 2>/dev/null || true

  local waited=0
  while (( waited < timeout )); do
    if ! find_pid_on_port >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$(( waited + 1 ))
  done

  # Still alive — escalate
  pid=$(find_pid_on_port) || return 0
  _kill_pid -KILL "$pid" 2>/dev/null || true
  return 0
}

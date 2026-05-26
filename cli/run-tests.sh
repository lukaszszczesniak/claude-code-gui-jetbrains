#!/usr/bin/env bash
# run-tests.sh — standalone bats runner for the cli package.
#
# Usage:
#   ./cli/run-tests.sh                     # run all *.bats in cli/test/
#   ./cli/run-tests.sh test/i18n.bats      # run a specific file
#   ./cli/run-tests.sh test/*.bats         # custom glob
#
# Also reachable via: ./scripts/build.sh cli-test [args]

set -euo pipefail

CLI_DIR="$(cd "$(dirname "$0")" && pwd)"
BATS="$CLI_DIR/test/bats-core/bin/bats"

if [[ ! -x "$BATS" ]]; then
  echo "Error: bats not found at $BATS" >&2
  echo "Run: git submodule update --init --recursive" >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  exec "$BATS" "$@"
fi

# Default: run every .bats file under test/ (not nested helpers)
shopt -s nullglob
files=("$CLI_DIR/test"/*.bats)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No .bats files found in $CLI_DIR/test/" >&2
  exit 1
fi

exec "$BATS" "${files[@]}"

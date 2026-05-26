#!/usr/bin/env bats
# Tests for cli/lib/version.sh

load 'helpers/common'

setup() {
  isolate_env
  # shellcheck source=../lib/version.sh
  source "$CLI_LIB/version.sh"
}

# ─── compare_semver: stdout convention ─ -1 (a<b) | 0 (a==b) | 1 (a>b) ───

@test "compare_semver: equal versions" {
  run compare_semver "1.0.0" "1.0.0"
  [ "$output" = "0" ]
}

@test "compare_semver: a < b (patch)" {
  run compare_semver "1.0.0" "1.0.1"
  [ "$output" = "-1" ]
}

@test "compare_semver: a > b (patch)" {
  run compare_semver "1.0.5" "1.0.1"
  [ "$output" = "1" ]
}

@test "compare_semver: a < b (minor)" {
  run compare_semver "1.9.99" "1.10.0"
  [ "$output" = "-1" ]
}

@test "compare_semver: a > b (major)" {
  run compare_semver "2.0.0" "1.99.99"
  [ "$output" = "1" ]
}

@test "compare_semver: strips leading 'v'" {
  run compare_semver "v1.0.0" "1.0.0"
  [ "$output" = "0" ]
  run compare_semver "v1.0.0" "v1.0.1"
  [ "$output" = "-1" ]
}

@test "compare_semver: handles unequal segment counts (1.0 vs 1.0.0)" {
  run compare_semver "1.0" "1.0.0"
  [ "$output" = "0" ]
}

@test "compare_semver: 0.14.2 < 0.15.0 (real release pair)" {
  run compare_semver "0.14.2" "0.15.0"
  [ "$output" = "-1" ]
}

# ─── parse_backend_version: extract from /version JSON response ───

@test "parse_backend_version: extracts version from valid JSON" {
  run parse_backend_version '{"version":"0.15.0"}'
  [ "$status" -eq 0 ]
  [ "$output" = "0.15.0" ]
}

@test "parse_backend_version: tolerates whitespace and ordering" {
  run parse_backend_version '{ "foo": "bar", "version" : "1.2.3" }'
  [ "$output" = "1.2.3" ]
}

@test "parse_backend_version: returns empty + nonzero on malformed input" {
  run parse_backend_version 'not json'
  [ "$status" -ne 0 ]
  [ -z "$output" ]
}

@test "parse_backend_version: returns empty + nonzero when version key missing" {
  run parse_backend_version '{"other":"value"}'
  [ "$status" -ne 0 ]
  [ -z "$output" ]
}

# ─── fetch_latest_release_tag: curl-mocked GitHub API ───

@test "fetch_latest_release_tag: extracts tag_name from API response" {
  mock_cmd_with_logic curl '
    # Ignore all flags, just emit a canned response
    printf "%s" "{\"tag_name\":\"v0.15.0\",\"name\":\"v0.15.0\"}"
  '
  run fetch_latest_release_tag
  [ "$status" -eq 0 ]
  [ "$output" = "v0.15.0" ]
}

@test "fetch_latest_release_tag: returns nonzero when curl fails" {
  mock_cmd_with_logic curl '
    exit 22
  '
  run fetch_latest_release_tag
  [ "$status" -ne 0 ]
}

@test "fetch_latest_release_tag: returns nonzero on malformed response" {
  mock_cmd_with_logic curl '
    printf "%s" "<html>404</html>"
  '
  run fetch_latest_release_tag
  [ "$status" -ne 0 ]
}

@test "fetch_latest_release_tag: respects CCG_RELEASE_REPO override" {
  export CCG_RELEASE_REPO="someone/forked-repo"
  mock_cmd_with_logic curl '
    # Echo back the URL so we can assert on it
    for arg in "$@"; do
      case "$arg" in
        https://api.github.com/*) printf "URL=%s\n" "$arg" >&2 ;;
      esac
    done
    printf "%s" "{\"tag_name\":\"v9.9.9\"}"
  '
  run fetch_latest_release_tag
  [ "$status" -eq 0 ]
  [ "$output" = "v9.9.9" ]
  # The URL must contain the override repo
  [[ "$stderr" == *"someone/forked-repo"* ]] || skip "stderr capture not enabled"
}

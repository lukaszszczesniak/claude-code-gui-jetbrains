# cli/ — `ccg` Standalone Launcher

This package provides a terminal CLI that runs the **same backend runtime as the JetBrains plugin, in Standalone mode**. Users install it with a single `curl | bash` line and then invoke it via the `ccg` command.

> **What is Standalone mode?** An execution mode that spawns the Node.js backend outside the IDE and connects via a regular browser. It uses the same `backend.mjs` as JetBrains mode, but the client is a browser rather than JCEF. See "Execution Mode Terminology" in the root [../CLAUDE.md](../CLAUDE.md).

## Purpose

- Provide the same WebView UX outside JetBrains, in **Standalone mode**
- A separate distribution channel decoupled from the plugin — **self-contained via GitHub Releases only**, with no npm dependency
- The plugin and standalone coexist on the same machine without conflicts (sharing the same port 19836)

## Package Boundaries (important)

`cli/` is an **independent package**. It adheres to the following principles:

| Principle | Meaning |
|------|------|
| **One-way dependency** | `cli/` only consumes the build artifacts of `backend/` and `webview/` (`backend.mjs`, `webview/dist/`). It does not import source code. |
| **Runtime independence** | The code inside `cli/` is pure Bash. No Node/Python dependency. (The backend it runs naturally requires node.) |
| **Build independence** | The cli unit tests must run with `cli/run-tests.sh` alone. It does not require the build artifacts of other packages. |
| **Version synchronization** | `cli` has no version of its own. Always GitHub Releases tag = plugin = backend = ccg. |

## Architecture

```
User machine
├── ~/.claude-code-gui/
│   ├── bin/ccg              ← added to PATH (dispatcher only)
│   ├── commands/            ← subcommand modules (single <name>.sh or <name>/index.sh)
│   ├── lib/                 ← shared domain logic (single <name>.sh or <name>/index.sh)
│   ├── locales/{en,ko}.sh
│   ├── uninstall.sh
│   ├── .ccg-version         ← installed version stamp
│   └── runtimes/<ver>/      ← runtime cache (backend.mjs + webview/)
│       ├── backend.mjs
│       └── webview/
└── ~/.zshrc (or .bashrc / fish)
    └── # claude-code-gui (ccg) ↓  ... ↑  ← idempotent marker
```

Flow when running `ccg run` after installation:

```
ccg run
 │
 ├─[lib/port]    GET http://127.0.0.1:19836/version
 │
 ├─ No response → [lib/runtime] check cache → download if absent → [lib/spawn] → open browser
 ├─ Our backend → [lib/version] semver comparison
 │                  ├─ latest  → "already running" + open browser
 │                  └─ outdated → user prompt → if y, kill → spawn anew
 └─ Foreign      → error + exit
```

## File Responsibility Separation

**Every file is 100 lines or fewer.** When a file exceeds that, split it into a folder with `<name>/index.sh` (the entry point and barrel) plus sibling files. `index.sh` defines the main function and `source`s its siblings (in the spirit of React's `index.tsx`/`index.ts`).

### Entry / Installation

| File | Responsibility | External Dependencies |
|------|------|----------|
| `bin/ccg` | Path resolution, loading lib/commands in dependency order, locale initialization, the `ccg_main` dispatcher | lib/*, commands/* |
| `install.sh` | Prechecks, asset download, PATH addition (uses install_util) | curl, tar |
| `uninstall.sh` | Directory removal, PATH line removal (uses install_util, with inline fallback) | — |
| `run-tests.sh` | bats entry point (for standalone cli execution) | bats-core (submodule) |
| `locales/{en,ko}.sh` | Per-locale messages (en = default + fallback) | — |

### commands/ — Per-subcommand modules

| Module | Responsibility |
|------|------|
| `commands/run/` | `cmd_run` orchestration (`index.sh`) + pure `decide_action` decision (`decide-action.sh`) |
| `commands/list/` | `cmd_list`, argument parsing, help (`index.sh`) + tree rendering (`format.sh`) |
| `commands/stop/` | `cmd_stop` (`index.sh`) + argument parsing (`args.sh`) + termination mode branching (`modes.sh`) + tree kill (`kill-tree.sh`) + confirmation and single kill (`kill.sh`) |
| `commands/doctor.sh` | `cmd_doctor` environment diagnostics |
| `commands/version.sh` | `cmd_version` + `ccg_self_version` |
| `commands/update.sh` | `cmd_update` forced runtime refresh |
| `commands/self-update.sh` | `cmd_self_update` cli self-update |
| `commands/uninstall.sh` | `cmd_uninstall` |
| `commands/help.sh` | `cmd_help` top-level help |

### lib/ — Shared domain logic (used by 2 or more commands)

| Module | Responsibility | External Dependencies |
|------|------|----------|
| `lib/i18n/` | `t <key> [args...]` translation and locale detection | locales/* |
| `lib/version.sh` | semver comparison, `/version` JSON parsing, GitHub Releases latest lookup | curl |
| `lib/port/` | occupancy and ours/foreign determination (`status`), listen PID lookup (`discover`), kill seam (`kill`), pid→port lsof (`lsof`), tree port confirmation (`tree`) | curl, lsof/netstat |
| `lib/proc/` | ps snapshot and liveness check (`index`), command/ppid lookup (`accessors`), descendant and child traversal (`descendants`) | ps |
| `lib/backend-detect/` | command shape determination (`predicates`), backend root discovery and promotion (`roots`), tree membership (`membership`), prod/dev and source classification (`classify`) | — |
| `lib/browser.sh` | URL encoding, WebView URL generation, opening the browser | open/xdg-open |
| `lib/spawn/` | spawn after securing the runtime (`index`), foreground execution and Ctrl+C trap (`foreground`) | node |
| `lib/runtime.sh` | tgz download, cache management, extraction | curl, tar |
| `lib/install_util.sh` | shell rc detection, PATH addition/removal via idempotent markers | grep, awk |

**Dependency graph**: `bin/ccg` → `commands/*` → `lib/*` → system tools. lib load order: i18n → version → port → proc → backend-detect → browser → runtime → spawn. No cycles allowed.

## Command Interface

```
ccg [run]          # default. port check → version comparison → spawn(foreground) → open browser
ccg list           # show backend + descendant process tree (PID, actual listen port, source/kind labels, /version confirmation)
ccg update         # force-refresh the runtime to latest (if running, graceful kill then replace)
ccg stop           # terminate the backend tree (including descendants, SIGTERM → 3s → SIGKILL)
                   #   variants: <pid> / --port <p> / --all / --force / --no-tree
ccg version        # show installed ccg / cached runtime / running backend versions
ccg doctor         # environment diagnostics (node path, PATH, cache, port, backend process count)
ccg self-update    # update the cli itself (re-run install.sh)
ccg uninstall      # uninstall
```

`list`/`stop` operate against the **process tree of `backend.mjs` (prod) and `server.ts` (dev)**, not against a single port 19836. A dev watch backend must be terminated by promoting its `pnpm dev`/`--watch` ancestor to the root, so that watch cannot resurrect it.

**Lifecycle**: Every spawn is **foreground**. The user can terminate it with Ctrl+C, and logs flow directly to the terminal. Children are cleaned up via `trap SIGINT SIGTERM`.

## Versioning Model

**ccg = runtime = plugin = GitHub Releases tag** (fully unified).

| Source | Value | Comparison Basis |
|------|----|---------| 
| Installed ccg | `~/.claude-code-gui/.ccg-version` file | written by install.sh |
| Cached runtime | `runtimes/<ver>/` directory name | — |
| Running backend | `GET /version` JSON response | semver comparison |
| Latest | `gh api /repos/.../releases/latest` → `tag_name` | compared after stripping the `v` prefix |

semver comparison is `lib/version.sh::compare_semver a b` — result: `-1`/`0`/`1`.

## i18n Rules

**Code vs output distinction**:
- **Code**: variable names, function names, comments, error stacks — English (the project's official common language)
- **User-facing output**: all goes through `t <key> [args...]` — never embed raw strings into output functions

```bash
# Wrong example
echo "Already running v$ver"

# Correct example
t running_already "$ver"
```

**Locale detection order** (`lib/i18n/`::`detect_locale`):
1. `CCG_LANG` env (explicit override)
2. The first 2 characters from the `<ko>_<KR>.UTF-8` format of `LC_ALL` → `LC_MESSAGES` → `LANG`
3. fallback: `en`

**Key naming**: snake_case, flat. Categories are distinguished by prefix (`err_*`, `update_*`, `doctor_*`, `version_*`, `install_*`).

**fallback policy**: if a key is missing in a specific locale → look it up in `en` → if it's also missing there, output the `<<key>>` sentinel (for detecting omissions during development).

**Implementation form** (bash 3.2 compatible):
```bash
# locales/en.sh
MSG_en_running_already="Already running v%s on port 19836..."

# locales/ko.sh
MSG_ko_running_already="이미 v%s가 19836 포트에서 실행 중입니다..."

# lib/i18n/ :: t()
local var="MSG_${CCG_ACTIVE_LOCALE}_${key}"
local template="${!var:-}"  # indirect expansion
printf "$template" "$@"
```

## TDD Rules

This package is developed such that **all of lib/*, commands/*, and bin/ccg are built with TDD**.

### Cycle

```
1. Write a RED test in test/<module>.bats
2. ./cli/run-tests.sh test/<module>.bats → confirm failure
3. Minimal implementation of the relevant module (lib/<name> or commands/<name>)
4. Run again → GREEN
5. Refactor → keep GREEN
```

### Test Writing Guide

- For each function, ≥ 1 happy path test + ≥ 1 edge case test
- Mock external commands (`curl`, `lsof`, `node`, `tar`) by **injecting a mock directory at the front of PATH**:
  ```bash
  setup() {
    export MOCK_BIN="$BATS_TEST_TMPDIR/bin"
    mkdir -p "$MOCK_BIN"
    PATH="$MOCK_BIN:$PATH"
  }
  ```
- Put common mock helpers in `cli/test/helpers/` (`mock_curl_response`, `mock_lsof`, etc.)

### Absolutely Forbidden

- **Adding a lib/* or commands/* function without tests** — even bin/ccg's orchestration logic must be decomposed into small, testable functions
- **A test going straight to GREEN without passing through RED once** — that means the test verifies nothing

## Build/Distribution

### Assets

Attach the following two to each tag in GitHub Releases:

| Asset | Contents | Consumer |
|------|------|--------|
| `claude-code-gui-standalone-v<ver>.tgz` | `backend.mjs` + `webview/` (Standalone mode runtime) | downloaded by `ccg` on first run |
| `ccg-cli-v<ver>.tar.gz` | `cli/bin/` + `cli/commands/` + `cli/lib/` + `cli/locales/` + `cli/uninstall.sh` (excluding test, README, CLAUDE.md) | downloaded by `install.sh` during installation |

### Build Commands

```bash
./scripts/build.sh standalone-tgz   # backend + webview → claude-code-gui-standalone-v<ver>.tgz
./scripts/build.sh ccg-cli-tgz      # package cli/ → ccg-cli-v<ver>.tar.gz
./scripts/build.sh cli-test         # run bats tests
```

### Release Flow

In the asset-attachment step (one of its 8 steps), the `/deploy` skill attaches the two tgz files above via `gh release upload`. The existing JetBrains Marketplace zip stays as is.

## Known Constraints

| Constraint | Reason |
|------|------|
| **bash 3.2+ compatible** | Since macOS's default bash is 3.2, `declare -A` (associative array) is not used. i18n is implemented with the variable-prefix pattern (`MSG_<lang>_<key>` + indirect expansion `${!var}`). |
| **node ≥ 18 required** | backend.mjs uses ES2022 + native fetch |
| **No Windows support (v1)** | Depends on bash. WSL or git-bash is best-effort. A PowerShell port is separate, future work. |
| **POSIX tool dependency** | Assumes `curl`, `tar`, `lsof` (unix)/`netstat` (win-WSL) exist. doctor diagnoses this. |

## Security / Trust Model

- All downloads trust GitHub Releases HTTPS only. No separate checksum verification (a deliberate decision).
- `install.sh` **modifies rc files** — handled safely with idempotent markers (`# claude-code-gui (ccg) ↓ ... ↑`). Only the lines inside the markers are added/removed.
- Never writes to any path other than `~/.claude-code-gui/` (exception: rc files).

## Relationship with the JetBrains Plugin (user notice required)

What ccg updates is **only the backend runtime for terminal execution**. The plugin itself, installed in the JetBrains IDE, must be updated separately through the Marketplace. Display this caution on every update prompt (i18n key: `caution_marketplace`).

Since the plugin and ccg share port 19836 on the same machine, **whoever launched first, they see the same backend**. If the `/version` response matches, it is reused as is; if the version differs, the user is asked whether to replace it.

## Debugging Tips

- **Backend stdout/stderr**: since it's foreground mode, it flows directly to the terminal. No separate log file.
- **Missing i18n keys**: the key itself is printed (wrapping it as `>>>> running_already <<<<` makes it more visible — handled in `lib/i18n/`)
- **Mocking debug**: when running bats tests, check stdout with the `--show-output-of-passing-tests` flag
- **`ccg doctor`**: the first diagnostic tool. Most environment problems are caught here.

## Unresolved / Out of Scope

- Windows native support — PowerShell port is separate work
- Auto-update (background check) — respect the user's explicit `ccg update` intent
- Multi-port — `ccg run` spawns on a single port 19836. (However, `ccg list`/`stop` also detect and terminate the arbitrary-port trees of dev and JetBrains, in addition to prod 19836.)
- Log file option — foreground alone is sufficient. If needed, the user can do `ccg | tee log.txt`.

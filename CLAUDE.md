# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Claude Code GUI plugin for JetBrains IDEs. The goal is to provide, in the JetBrains environment, the same UX as Cursor's Claude Code extension.

## Architecture

Composed of 3 layers:

1. **Node.js Backend (the only backend)** - Claude Code CLI execution, session/settings/file I/O, WebSocket server
2. **WebView UI** - chat/session/diff card UI, implemented identically to Cursor UX (communicates with Node.js over WebSocket)
3. **Bridge (per-environment adapter)** - BrowserBridge (browser) / KotlinBridge (JetBrains IDE native API)

## Reference Repository

When implementing, use the `idea-claude-code-gui` (GitHub) repository as the primary reference. Priority: Cursor UX > reference repository > JetBrains conventions

## Technical Constraints

- The WebView uses JCEF (Swing UI is prohibited, with the permission dialog as an exception)
- The agent runtime is separated into a process external to the IDE
- Event-driven, streaming-first design

## Single Backend Architecture

Regardless of the client runtime environment, the WebView always communicates with the Node.js backend over WebSocket.

| Client environment | Bootstrap | Backend | Bridge |
|----------------|-----------|--------|--------|
| Browser | Vite dev server | Node.js WebSocket server | BrowserBridge (no-op, etc.) |
| JetBrains IDE | Kotlin spawns Node.js → localhost:PORT | Node.js WebSocket server | KotlinBridge (IDE API) |

**Both environments are environments in which the actual product runs.** The browser environment is not for development only; it is an independent deployment target.

### Run Mode Terminology

| Term | Meaning |
|------|------|
| **JetBrains mode** | The IDE spawns the Node.js backend and connects via the JCEF WebView. Activated by the `JETBRAINS_MODE=true` environment variable. |
| **Standalone mode** | Run the Node.js backend outside the IDE and connect via a regular browser. Applied automatically when `JETBRAINS_MODE` is unset. Two bootstrap paths: ① the Vite dev server for development, ② the `ccg` command on the user's machine (terminal launcher). |

Distribution artifact names follow this terminology as well — `claude-code-gui-standalone-v<ver>.tgz` is the backend + webview runtime for standalone mode. The JetBrains-mode artifact is the marketplace zip (`claude-code-gui-jetbrains-<ver>.zip`).

### Core Principles

- **The only backend is Node.js**: all business logic (sessions, settings, Claude CLI, file I/O) is handled in Node.js
- **The Bridge is an ORM adapter**: only functionality that must necessarily differ per environment (editor tabs, diff viewer, etc.) is abstracted behind the Bridge interface
- **Kotlin is an implementation behind Node.js**: the WebView does not communicate with Kotlin directly. When Node.js needs IDE-native functionality, it calls the Bridge (Kotlin)

### No Code Duplication

Since Node.js is the only backend, a dual implementation of business logic is unnecessary. Do not implement business logic in Kotlin.

## Principle of Preserving Original Data

The original data structures produced by the Claude Code CLI (JSONL entries, session metadata, etc.) must **keep their structure intact all the way to the WebView endpoint**.

### Rules

1. **No key/value renaming**: do not rename original field names in the intermediate layers. (e.g., `title` → ~~`firstPrompt`~~, `createdAt` → ~~`created`~~)
2. **No intermediate filtering**: the intermediate forwarding layer (Node.js backend) must not filter or drop original data. Filtering is the responsibility of the final consumer, the WebView.
3. **No information loss**: even fields not currently used by the UI must not be removed from the forwarding path. Preserve the possibility of future use.
4. **Data type conversion is allowed**: cross-language type mapping (e.g., JSON → Kotlin data class → JSON) is allowed, but key names or structure must not change in the process.

### Rationale

- The project does not yet fully utilize all of Claude Code's original data. If an intermediate layer edits the information, it creates unnecessary cost later when re-discovering the original structure.
- **At any layer, looking at the data should let you understand "what the Claude Code original looks like," and that content must be trustworthy.**

### Scope

| Layer | Role | Allowed | Not allowed |
|------|------|-------------|---------------|
| Node.js backend (dev-bridge) | Forward original | Type conversion, serialization | Field renaming, filtering, dropping |
| WebView (React) | Final consumption | Filtering, sorting, display-oriented processing | — |

## Consistent Naming

Names that refer to the same purpose and the same behavior must consistently use the **same word**, regardless of layer or language.

### Rules

1. **One word per behavior.** Use the same verb for the same action everywhere — method names, IPC message types, variable names, RPC handler names, etc. When reading along the pipeline, a changing word is mistaken for a different action. (e.g., ~~`create()` → `NEW_SESSION`~~ → `create()` → `CREATE_SESSION`)
2. **Different words for different behaviors.** Actions with different meanings, such as "reset the session in the current tab" and "open a new editor tab," must not share the same name.
3. **Use clear verbs.** Use CRUD verbs (`create`, `get`, `update`, `delete`) or clear action verbs (`load`, `clear`, `open`, `stop`). Avoid ambiguous words like `new` or `change`.

### IPC Message Types via the `MessageType` enum (single source)

Every IPC message `type` that travels between webview↔backend (and Node↔Kotlin) uses the `MessageType` enum instead of a plain string literal.

- **Definition location**: `webview/src/shared/message-type.ts` ↔ `backend/src/shared/message-type.ts` (mirror directories, 1:1 sync required — see `shared/CLAUDE.md`). The webview imports from `@/shared`, the backend from `../shared` (matching the path depth).
- **Member name = string value**: `MessageType.GET_ACCOUNT === 'GET_ACCOUNT'`. The wire format and the code read and grep identically. This is the mechanism that enforces the "one word per behavior" principle above at the IPC boundary.
- **Prohibited**: plain strings like `send('GET_ACCOUNT')`. Always `send(MessageType.GET_ACCOUNT)`.
- **When adding a new message type**: add a member to the enum and **leave an English comment describing the meaning of each value** (direction: inbound webview→backend / outbound backend→webview / Node↔Kotlin / logging channel). Reflect identically in both shared copies.
- **Scope**: `bridge.request`/`send`/`subscribe`/`waitFor`, backend routing `switch...case`, `connections.sendTo`/`broadcast`, JSON-RPC `method`, the logging channel (`LOG_BATCH`), and everywhere else a message `type` is used. However, sub-classifications inside the `payload` rather than the message envelope (`type`) — e.g., `CLI_ERROR` within the CLI_EVENT payload — are out of scope.

## State Machine

Idle → Streaming → Waiting Permission → Has Diff → Error

## UI Terminology

| Term | Description |
|------|------|
| **Top bar** | The region element at the top of the chat screen containing the new tab button and the session dropdown toggle button |
| **Session dropdown toggle button** | The dropdown toggle button on the left of the top bar that displays the current session's title |
| **Session dropdown** | The dropdown menu that opens by clicking the session dropdown toggle button |
| **New tab button** | The plus button on the right of the top bar. Clicking it opens a new Claude Code editor tab in the IDE |
| **Uninitialized session** | A state in which no session has been created yet because not even the first message has started |
| **Input banner** | The guidance line that appears just above the chat input (the general-purpose `InputBanner` component). Distinct from the top-of-screen banner (`BannerArea`). Composed of left-side text + right-side action + a rightmost X close button. Reused for things like telemetry-consent guidance |

## Build Commands

All builds are run through `bash ./scripts/build.sh <command>`. Do not directly combine `cd`, `pnpm`, or `./gradlew` commands.

> **Important**: You can see the full list of commands with `bash ./scripts/build.sh -h`.

### Main Commands

| Command | Purpose |
|------|------|
| `bash ./scripts/build.sh be-build` | Build the backend |
| `bash ./scripts/build.sh wv-build` | Build the webview |
| `bash ./scripts/build.sh build` | Build the plugin |
| `bash ./scripts/build.sh full-build` | Full build (be + wv + plugin) |
| `bash ./scripts/build.sh dist` | Distribution build (be + wv + buildPlugin) |
| `bash ./scripts/build.sh run-ide` | Run the IDE for testing |
| `bash ./scripts/build.sh clear-cache` | Reset build cache/artifacts |
| `bash ./scripts/build.sh wv-lint` | WebView TypeScript check |
| `bash ./scripts/build.sh wv-test` | WebView tests |
| `bash ./scripts/build.sh all` | Full build + run IDE |

### Agent Behavior Guidelines

1. **For build/test**: always use `bash ./scripts/build.sh`
2. **No cd**: the script handles paths internally with `pnpm -C` and `gradlew -p`
3. **When a new command is needed**: propose adding a case to `scripts/build.sh`
4. **Run every shell command prefixed with `bash`**: e.g., `bash ./scripts/build.sh build`, `bash -c "ls -la"`, etc.

## Local Skills

Project-local skills are located in `.claude/skills/`. Prefer **project-local skills** over oh-my-claudecode skills.

> **Structure rule**: each skill must be of the form `.claude/skills/<name>/SKILL.md` (folder + SKILL.md), and SKILL.md must have `name`·`description` YAML frontmatter at the top so it auto-triggers on natural-language requests. A flat `.claude/skills/<name>.md` file is not recognized as a skill by Claude Code.

| Skill | File path | Trigger keywords |
|------|-----------|--------------|
| `/cc-gui-reporter` | `.claude/skills/cc-gui-reporter/SKILL.md` | "마켓플레이스 확인", "리뷰/댓글/대댓글 확인", "미응답", "미해결 버그", "현황", "리포트", "report", "triage" |
| `/deploy` | `.claude/skills/deploy/SKILL.md` | "배포", "deploy", "릴리즈", "release", "publish", "마켓플레이스 발행" |
| `/build` | `.claude/skills/build/SKILL.md` | "빌드", "build", "컴파일", "compile" |
| `/precheck` | `.claude/skills/precheck/SKILL.md` | "프리체크", "precheck", "배포 전 검수" |
| `/release-monitor` | `.claude/skills/release-monitor/SKILL.md` | "릴리즈 모니터링", "release-monitor", "마켓플레이스 모니터링", "approval 확인" |

Data collection for `/cc-gui-reporter` is handled by `./ignore/cc-gui-report.sh` (the user can run it directly; read-only. Not tracked by git — the `ignore/` folder).

## Notes on Using the JetBrains SDK API

When publishing to the JetBrains Marketplace, the **Plugin Verifier** automatically validates API usage.

- Using **Deprecated API** → warning
- Using **Internal API** → error, deployment may be rejected
- Beware of classes that may be internal/deprecated, such as `EnvironmentUtil`
- Never use `@ApiStatus.Internal` classes or classes inside `impl` packages
- Before deployment, build with `bash ./scripts/build.sh dist` and always check the Plugin Verifier results

## JetBrains Marketplace Approval Guidelines (v1.3, 2026-03-31)

When deploying, all of the criteria below must be met. Violations may delay or reject approval.

### 1. Plugin Content

| Item | Requirement |
|------|---------|
| **Logo** | Do not use the default IntelliJ template logo. Do not resemble JetBrains product logos. **40x40px SVG** required |
| **Name** | Must be unique. Max 30 characters. Only Latin letters/digits/symbols allowed. Must not include JetBrains product names such as "Plugin", "IntelliJ", "JetBrains". Must not manipulate search ranking by starting with "A" or ".". Avoid using "Support" or "Integration" on their own |
| **Vendor** | The vendor website and email must be valid. No impersonation/false representation |
| **Description** | English required (primary language). Correct formatting/spelling/grammar. Media must display correctly |
| **Change notes** | Placeholder text ("Add change notes here") prohibited. Include only relevant information |
| **Links** | All external links must be valid. Only links related to the plugin/author are allowed |
| **Assets** | No infringement of JetBrains brand assets. No copyright/trademark infringement |

### 2. Plugin Functionality

| Item | Requirement |
|------|---------|
| **Compatibility** | Compatible with at least 1 JetBrains product. Must be installable on the defined compatible products/versions |
| **Plugin Verifier** | Binary compatibility verification required on every upload. **No Internal API usage violations** |
| **Security** | Must have no security vulnerabilities or privacy issues |
| **Performance** | Must not seriously degrade JetBrains product performance |
| **No interference** | Must not modify/hide/intercept/interfere with JetBrains product features (including licensing, subscription, trial, and upgrade flows) |
| **Data collection** | **Explicit user consent required** when processing personal/statistical/telemetry data. No data transmission while the plugin is disabled |
| **No search manipulation** | Must not manipulate search results or disrupt Marketplace features via metadata/marketing assets |

### 3. Legal Requirements

- Agreement to the Developer Agreement is required
- A Developer EULA is required for every plugin
- Open-source-licensed plugins **require a source code link**
- A **Privacy Policy is required** when collecting personal data
- A trader/non-trader status declaration related to EEA consumer protection law is required

### Agent Checklist (verify before deployment)

Before running deployment (`/deploy`), check the following items:

- [ ] Logo: 40x40px SVG, not similar to the JetBrains logo
- [ ] Name: within 30 characters, no JetBrains product name
- [ ] Description: English-first, no broken links/images
- [ ] Change notes: actual changes written, not a placeholder
- [ ] All external links valid
- [ ] Plugin Verifier passes (0 Internal API violations)
- [ ] Privacy Policy link present when collecting personal data
- [ ] Source code link present (open source)

## Logging System

See [logging.md](./logging.md).

## Work Plan

Before starting work, you must read `ignore/plan.md` and follow the agent instructions. When the conversation refers to the "plan file," it means this file. If the user asks what to do next, answer based on this plan file first.

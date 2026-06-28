# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Definition of the term "Agent"

In this document, **"Agent"** refers to a general-purpose AI coding agent that is not tied to any specific tool.
Representative examples include Claude Code (Anthropic), Codex (OpenAI), Gemini CLI (Google), Cline, and others.
This document is written so that it can be referenced from any agent tool.

## Project Overview

A Claude Code GUI plugin for JetBrains IDEs. The goal is to provide, in the JetBrains environment, the same UX as Cursor's Claude Code extension.

## Architecture

Composed of 3 layers:

1. **Node.js Backend (the only backend)** - Agent CLI execution, session/settings/file I/O, WebSocket server
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

### Core Principles

- **The only backend is Node.js**: all business logic (sessions, settings, Agent CLI, file I/O) is handled in Node.js
- **The Bridge is an ORM adapter**: only functionality that must necessarily differ per environment (editor tabs, diff viewer, etc.) is abstracted behind the Bridge interface
- **Kotlin is an implementation behind Node.js**: the WebView does not communicate with Kotlin directly. When Node.js needs IDE-native functionality, it calls the Bridge (Kotlin)

### No Code Duplication

Since Node.js is the only backend, a dual implementation of business logic is unnecessary. Do not implement business logic in Kotlin.

## Principle of Preserving Original Data

The original data structures produced by the Agent CLI (JSONL entries, session metadata, etc.) must **keep their structure intact all the way to the WebView endpoint**.

### Rules

1. **No key/value renaming**: do not rename original field names in the intermediate layers. (e.g., `title` → ~~`firstPrompt`~~, `createdAt` → ~~`created`~~)
2. **No intermediate filtering**: the intermediate forwarding layer (Node.js backend) must not filter or drop original data. Filtering is the responsibility of the final consumer, the WebView.
3. **No information loss**: even fields not currently used by the UI must not be removed from the forwarding path. Preserve the possibility of future use.
4. **Data type conversion is allowed**: cross-language type mapping (e.g., JSON → Kotlin data class → JSON) is allowed, but key names or structure must not change in the process.

### Rationale

- The project does not yet fully utilize all of the Agent's original data. If an intermediate layer edits the information, it creates unnecessary cost later when re-discovering the original structure.
- **At any layer, looking at the data should let you understand "what the Agent original looks like," and that content must be trustworthy.**

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

## State Machine

Idle → Streaming → Waiting Permission → Has Diff → Error

## UI Terminology

| Term | Description |
|------|------|
| **Top bar** | The region element at the top of the chat screen containing the new tab button and the session dropdown toggle button |
| **Session dropdown toggle button** | The dropdown toggle button on the left of the top bar that displays the current session's title |
| **Session dropdown** | The dropdown menu that opens by clicking the session dropdown toggle button |
| **New tab button** | The plus button on the right of the top bar. Clicking it opens a new Agent editor tab in the IDE |
| **Uninitialized session** | A state in which no session has been created yet because not even the first message has started |

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

| Skill | File path | Trigger keywords |
|------|-----------|--------------|
| `/deploy` | `.claude/skills/deploy.md` | "배포", "deploy", "릴리즈", "release", "publish", "마켓플레이스 발행" |
| `/build` | `.claude/skills/build.md` | "빌드", "build", "컴파일", "compile" |
| `/precheck` | `.claude/skills/precheck.md` | "프리체크", "precheck", "배포 전 검수" |

## Notes on Using the JetBrains SDK API

When publishing to the JetBrains Marketplace, the **Plugin Verifier** automatically validates API usage.

- Using **Deprecated API** → warning
- Using **Internal API** → error, deployment may be rejected
- Beware of classes that may be internal/deprecated, such as `EnvironmentUtil`
- Never use `@ApiStatus.Internal` classes or classes inside `impl` packages
- Before deployment, build with `bash ./scripts/build.sh dist` and always check the Plugin Verifier results

## Logging System

See [logging.md](./logging.md).

## Work Plan

Before starting work, you must read `ignore/plan.md` and follow the agent instructions. When the conversation refers to the "plan file," it means this file. If the user asks what to do next, answer based on this plan file first.

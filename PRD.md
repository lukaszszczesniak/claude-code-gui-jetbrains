# PRD — JetBrains Claude Code GUI (Cursor-identical UX)

## 0. Document Purpose

This document is a **Product Requirements Document (PRD)** for providing, in JetBrains IDEs, an experience **almost identical to the UI/UX of Cursor's Claude Code extension**.

For items in this PRD that are **not clearly defined or that have multiple implementation choices**, the **structure, patterns, and decisions** of the following repository are, in principle, taken as the primary reference.

* Reference baseline repository: idea-claude-code-gui (GitHub)
* Principle: *when behavior, UX, or structure conflict, prioritize in the order Cursor UX > reference repository > JetBrains conventions*

---

## 1. Product Goals

### 1.1 Primary Goal (MVP)

* The **visual and interactive UX is almost identical** to Cursor's Claude Code extension
* The **agent runtime can be used self-containedly inside the IDE** without a terminal

### 1.2 Non-goals (excluded from the initial scope)

* UX improvements/differentiation relative to Cursor
* Active use of JetBrains-specific features (advanced diff UX, etc.)
* State synchronization across multiple IDEs

---

## 2. Core User Scenarios

1. The user opens the Claude panel via a shortcut or menu
2. The user types a request into the chat input box
3. The agent outputs the response via **streaming**
4. When the agent proposes a file modification/command execution, the user chooses **allow/reject**
5. Change proposals can be reviewed in diff form and then applied/reverted
6. Sessions are saved automatically and can be resumed at any time

---

## 3. Overall Architecture Overview

### 3.1 Layer Separation Principle

This product is composed of the following 3 independent layers.

1. **IDE Plugin (Kotlin/JVM)**

* IDE API access and control
* WebView hosting and bridging
* Security/permission/file system integration

2. **WebView UI (JCEF, Web App)**

* Implements the same UI/UX as Cursor
* Chat, sessions, diff cards, input UX

3. **AI Bridge (separate process)**

* Runs agents such as Claude Code
* Streaming parsing
* State machine (plan/execute/verify)

> Inter-layer communication and responsibility separation use the structure of the idea-claude-code-gui repository as the primary reference.

---

## 4. UI / UX Requirements (Cursor-identical)

### 4.1 ToolWindow (main panel)

#### Composition

* Session list area
* Main conversation stream area
* Bottom input composer

#### Requirements

* All messages use **streaming rendering**
* Markdown + Code Block rendering
* Tool-call / Plan / Result are expressed as card UIs

> The specific layout and component separation follow the webview implementation of the reference repository.

---

### 4.2 Input Composer

* Multi-line input
* Enter / Shift+Enter
* History navigation
* Slash command support (`/init`, `/review`, etc.)
* Context attachment UI (@file, selection)

---

### 4.3 Diff / Change Proposal UX

* When the agent proposes a file change:

    * Display a diff card within the panel
    * Provide a per-file change summary
* The user can choose one of:

    * Open Diff (IDE diff viewer)
    * Apply
    * Reject

> The patch display method and card UI follow the UX of the reference repository.

---

## 5. Context Collection Rules

### 5.1 Context Types

* Selection
* Active File
* Open Files
* Explicit File (@file)

### 5.2 Priority

1. Explicit attachment (@file, drag)
2. Selection
3. Active file

> Whether to inject context automatically and the scope-limiting policy follow the reference repository and Cursor behavior.

---

## 6. Permission and Security Policy

### 6.1 Permission Types

* File write
* File delete
* Command execution
* Network access

### 6.2 UX Principles

* Default: **user approval is always required**
* Approval requests are displayed as Tool-call cards
* High-risk operations use an IDE-native dialog

> The permission-remembering (scope) policy uses the reference repository's implementation as the primary reference.

---

## 7. Event / Message Protocol

### 7.1 Basic Principles

* Event-driven
* Streaming-first
* Every request is traceable by request_id

> Event types and payload structures either follow the reference repository's protocol definitions as-is, or are designed to be compatible with them.

---

## 8. Session and State Management

### 8.1 Sessions

* Sessions are saved per project
* Auto-save
* Sessions can be resumed

### 8.2 State Machine

* Idle
* Streaming
* Waiting Permission
* Has Diff
* Error

> State transition rules are based on the actual behavior of Cursor's Claude Code.

---

## 9. Diff / Patch Application Policy

* Manage change proposals at the patch granularity
* On Apply, reflect changes to the IDE file system
* On Reject, discard the changes
* Must be undoable

> The patch format (unified diff vs file edits) follows the reference repository's implementation.

---

## 10. Technical Constraints and Decision Principles

* The WebView uses JCEF
* Swing-based UI is not used (exception: the permission dialog)
* The agent runtime is separated into a process external to the IDE

---

## 11. Milestones

### M1 — Basic Conversation

* ToolWindow + WebView
* Streaming responses

### M2 — Context

* Selection / File attachment
* Session saving

### M3 — Change Proposals

* Diff cards
* Apply / Reject

### M4 — Agent Maturity

* Permission flow
* Stop / Retry / Continue

---

## 12. Principle for Handling Undecided Items (Important)

The following items not specified in this PRD:

* IPC method
* Bridge internal structure
* WebView state management approach
* Error/recovery strategy

👉 are **decided using the latest implementation of the idea-claude-code-gui repository as the primary reference**.

---

## 13. Success Criteria

* Usable by Cursor Claude Code users without UX explanation
* The same tasks can be completed without using a terminal
* No IDE freezes/crashes during agent work

---

## 14. Future Extensions (out of scope)

* Active use of JetBrains diff UX
* Multi-agent
* Remote runtime
* Team session sharing

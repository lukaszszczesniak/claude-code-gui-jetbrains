# shared folder synchronization rules

This folder must keep its contents **completely identical** to `backend/src/shared/`.

## Rules

1. When you modify a file in this folder, you must apply the same modification to `backend/src/shared/` as well.
2. Conversely, when `backend/src/shared/` is modified, reflect the same changes in this folder.
3. The file list, contents, and structure must always match 1:1.
4. This CLAUDE.md file itself also exists identically on both sides.

## Purpose

Since backend and webview are separate pnpm workspaces, this is a convention for keeping shared types/enums identical on both sides.

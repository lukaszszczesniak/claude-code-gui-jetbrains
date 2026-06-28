# Logging System

Records all `console.*` output from the backend and WebView to a file.

## Structure

| Component | File | Role |
|----------|------|------|
| `FileLogger` | `backend/src/logging/file-logger.ts` | File writing, rotation (5MB), capacity management (2GB) |
| `LogWebSocketServer` | `backend/src/logging/log-ws.ts` | `/logs`-dedicated WebSocket, receives WebView logs |
| `Logger` | `backend/src/logging/logger.ts` | Facade. console interception + FileLogger + LogWS integration |
| `LogForwarder` | `webview/src/api/logging/LogForwarder.ts` | Captures WebView console.* → batch-sends to backend |

## Log File Location

```
~/.claude-code-gui/logs/
  server.log                          ← active log
  server-20260313T153000123Z.log      ← archive
```

## Log Format

```
{ISO timestamp} {LEVEL} [{source}][{sessionId?}] {message}
```

Example:
```
2026-03-13T14:30:22.123Z ERROR [node-backend] WebSocket server listening on port 3456
2026-03-13T14:31:00.345Z LOG [webview][abc123] SessionDropdown rendered
```

## WebSocket Channels

| Path | Purpose |
|------|------|
| `/ws` | Chat/streaming (existing) |
| `/logs` | Log-dedicated (WebView → backend log forwarding + real-time log broadcast) |

## Rules

- **No external logging libraries**: implemented directly on top of `createWriteStream`
- **console interception must always preserve the original functions**: in JetBrains mode Kotlin reads stderr, so the original `console.error` etc. must still output to stderr
- **Reentrancy prevention**: calling console from within the Logger would cause infinite recursion, so it is blocked with the `isIntercepting` flag
- **Preventing log loss during rotation**: uses the `isRotating` + `rotationBuffer` mechanism
- **Graceful shutdown**: `stream.end()` + waiting for the `finish` event (5-second timeout)
- **Initialization order**: `initLogger()` → `interceptConsole()` → server start → `setLogWs()` (during the period when LogWS is not yet set, only file recording happens)

## Rotation

- **Criterion**: when the active log (`server.log`) exceeds 50MB
- **Archive filename**: `server-{timestamp}.log` (timestamp: ISO 8601 with `:` and `.` removed)
- **Retention limit**: 2GB total for the `logs/` folder; when exceeded, the oldest archives are deleted first
- **Buffering during rotation**: `isRotating` flag + accumulation into `rotationBuffer[]` → flush after opening the new stream

## Initialization Flow

### Backend (`server.ts`)

```
main() {
  initLogger()           // 1. Initialize FileLogger immediately
  logger.init()          // 2. Create log directory + open WriteStream
  logger.interceptConsole()  // 3. Capture all console.* from here on
  // ... server start ...
  logger.setLogWs(logWs)    // 4. Set LogWS reference (WS broadcast starts afterwards)
}
```

### WebView (`main.tsx`)

```
initLogForwarder()       // Initialize before app rendering
// ... React rendering ...
// Call getLogForwarder().setSessionId() when currentSessionId changes in SessionContext
```

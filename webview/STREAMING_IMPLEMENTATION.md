# WebView Streaming Response Handler Implementation

## Overview

Phase 1.4 complete: Implemented a handler for displaying Claude's streaming responses in the WebView UI

## Implemented Components

### 1. hooks/useStreaming.ts
Streaming state management hook

**Key features:**
- Streaming state tracking (idle, streaming, paused, error)
- Buffer management and chunk queuing
- requestAnimationFrame-based throttling (60fps)
- Integration with the useBridge hook to receive IPC messages

**API:**
```typescript
const {
  state,              // Current streaming state
  buffer,             // Accumulated buffer for the current message
  currentMessageId,   // ID of the message being streamed
  isPaused,           // Paused state
  pause,              // Pause
  resume,             // Resume
  reset,              // Reset state
  getBufferForMessage // Retrieve the buffer for a specific message
} = useStreaming(options);
```

**Performance optimizations:**
- RAF-based chunk flushing to guarantee render performance
- Maximum buffer size limit (default 100KB)
- Throttling to prevent unnecessary re-renders

### 2. components/StreamingMessage.tsx
Streaming message renderer

**Key features:**
- Incremental Markdown rendering using the Streamdown library
- Typing animation effect
- Shiki-based code block syntax highlighting
- Handling of incomplete Markdown (e.g., unclosed code fences)

**Usage example:**
```tsx
<StreamingMessage
  content={messageContent}
  isStreaming={isCurrentlyStreaming}
  className="custom-class"
/>
```

**Highlights:**
- Automatic dark/light theme support (Shiki)
- Visual indicator while streaming (dot animation)
- Cursor display on incomplete code blocks

### 3. components/MessageList.tsx
Message list container

**Key features:**
- Grouping messages by date
- Auto-scroll (when the user has not scrolled manually)
- Position preservation based on a scroll anchor
- Retry/copy action buttons

**Usage example:**
```tsx
<MessageList
  messages={messages}
  streamingMessageId={currentStreamingId}
  onRetry={handleRetry}
  onCopy={handleCopy}
/>
```

**UX optimizations:**
- Scroll position detection and a "scroll to bottom" button
- Action buttons shown on message hover
- Tool usage (ToolUse) status display
- Context information display

### 4. utils/markdownParser.ts
Markdown utilities

**Key functions:**
- `extractCodeBlocks()` - Extract code blocks
- `isMarkdownComplete()` - Check Markdown completeness
- `isInsideCodeBlock()` - Check whether a position is inside a code block
- `escapeHtml()` - HTML escaping
- `formatCode()` - Code formatting
- `detectLanguage()` - Automatic code language detection

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Streamdown 2.1** - Streaming Markdown rendering
- **Shiki** - Syntax highlighting
- **Tailwind CSS** - Styling
- **JCEF** - WebView hosting (JetBrains)

## Integration Guide

### IPC Message Protocol

The Kotlin bridge must send the following messages:

```typescript
// Streaming start
{
  type: 'stream:start',
  payload: { messageId: string }
}

// Chunk received
{
  type: 'stream:chunk',
  payload: { messageId: string, delta: string }
}

// Streaming end
{
  type: 'stream:end',
  payload: { messageId: string }
}

// Error occurred
{
  type: 'stream:error',
  payload: { error: string }
}
```

### Usage Example

See `examples/StreamingExample.tsx` for a full integration example:

```tsx
import { useStreaming, useChat } from './hooks';
import { MessageList } from './components';

function ChatPanel() {
  const { messages, isStreaming, streamingMessageId } = useChat();
  const { state, buffer } = useStreaming();

  return (
    <MessageList
      messages={messages}
      streamingMessageId={streamingMessageId}
    />
  );
}
```

## File Structure

```
webview/src/
├── hooks/
│   ├── useStreaming.ts          # Streaming state management
│   └── index.ts                 # Export
├── components/
│   ├── StreamingMessage.tsx     # Markdown renderer
│   ├── MessageList.tsx          # Message list
│   └── index.ts                 # Export
├── utils/
│   └── markdownParser.ts        # Markdown utilities
└── examples/
    └── StreamingExample.tsx     # Integration example
```

## Verification Complete

### TypeScript Compilation
```bash
npm run lint
# ✓ No errors
```

### Production Build
```bash
npm run build
# ✓ Built successfully
# Output: ../src/main/resources/webview/
```

### Bundle Size
- index.js: 612.26 kB (gzipped: 191.58 kB)
- index.css: 18.83 kB (gzipped: 4.37 kB)

## Next Steps

1. **Phase 1.5** - Implement the tool usage permission dialog
2. **Phase 1.6** - Implement the Diff card component
3. Integrate the IPC message protocol with the Kotlin plugin
4. Test streaming responses against the real Claude API

## References

- [Streamdown documentation](https://github.com/jjaimealeman/streamdown)
- [Shiki themes](https://shiki.style/themes)
- [JetBrains Platform UI Guidelines](https://plugins.jetbrains.com/docs/intellij/user-interface-components.html)

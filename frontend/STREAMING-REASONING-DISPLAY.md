# Streaming Reasoning Display System

## Overview

The Streaming Reasoning Display System enables real-time visualization of AI assistant responses with expandable reasoning steps. As the AI generates responses, the system:

1. **Streams content in real-time** - Shows the assistant's response as it's being generated
2. **Extracts reasoning blocks** - Automatically identifies and separates `<think>`, `<thinking>`, and `<AI_THINK>` tags
3. **Displays interactive accordion** - Users can expand/collapse individual reasoning steps
4. **Maintains live updates** - Reasoning steps appear and become interactive as they're generated

## Architecture

### Components

#### 1. **StreamingThoughtAccordion** (`components/tailwind/streaming-thought-accordion.tsx`)
The main UI component that displays streaming messages with reasoning sections.

**Props:**
- `messageId` (string) - Unique message identifier
- `content` (string) - Final/complete message content
- `streamingContent` (string, optional) - Real-time partial content as it arrives
- `reasoningSteps` (string[], optional) - Pre-extracted reasoning steps
- `isStreaming` (boolean, optional) - Whether message is still streaming
- `onInsertClick` (function, optional) - Callback when user clicks Insert button
- `className` (string, optional) - Additional CSS classes

**Key Features:**
- Live content rendering with Markdown support
- Expandable reasoning steps accordion
- Copy buttons for visible content and reasoning
- Insert button for editors (workspace mode)
- Streaming indicator bar with pulse animation
- Step counter badge showing total reasoning steps

#### 2. **useStreamingChat Hook** (`hooks/useStreamingChat.ts`)
Custom React hook for managing streaming responses with reasoning extraction.

**Methods:**
```typescript
// Stream raw response body
streamMessage(
  messageId: string,
  endpoint: string,
  body: any,
  options?: { headers?: Record<string, string>, onChunk?: (chunk: string) => void }
): Promise<string>

// Stream Server-Sent Events (SSE) format
streamMessageSSE(
  messageId: string,
  endpoint: string,
  body: any,
  options?: { headers?: Record<string, string>, onChunk?: (chunk: string) => void }
): Promise<string>

// Cancel ongoing stream
cancel(): void

// Reset streaming state
reset(): void
```

**Returns:**
```typescript
{
  isStreaming: boolean
  streamingContent: string
  reasoningSteps: string[]
  streamMessage: (messageId, endpoint, body, options?) => Promise<string>
  streamMessageSSE: (messageId, endpoint, body, options?) => Promise<string>
  cancel: () => void
  reset: () => void
}
```

#### 3. **StreamingChatMessage** (`components/tailwind/streaming-chat-message.tsx`)
Wrapper component for displaying both user and assistant messages with streaming support.

**Props:**
- `messageId` (string)
- `role` ('user' | 'assistant')
- `content` (string)
- `streamingContent` (string, optional)
- `reasoningSteps` (string[], optional)
- `isStreaming` (boolean, optional)
- `timestamp` (number)
- `onInsertClick` (function, optional)
- `className` (string, optional)

### Reasoning Extraction

The system automatically extracts reasoning blocks using these tags:
- `<think>...</think>` - Claude's thinking tag
- `<thinking>...</thinking>` - Alternative thinking tag
- `<AI_THINK>...</AI_THINK>` - Custom AI thinking tag
- `<tool_call>...</tool_call>` - Tool invocation blocks (hidden from public view)

#### Extraction Process

1. **Real-time parsing** - As chunks arrive, the system scans for complete reasoning blocks
2. **Block isolation** - Each `<tag>...content...</tag>` becomes a separate step
3. **Public/Private split** - Reasoning blocks are removed from visible content
4. **Step deduplication** - Duplicate reasoning blocks are filtered out

Example:

```
Raw Response:
<think>
Let me analyze this SOW request carefully.
Looking at the budget constraints...
</think>

Here's my analysis of the SOW:
## Overview
...content...

Result:
- Public Text: "Here's my analysis of the SOW:\n## Overview\n...content..."
- Reasoning Steps: ["Let me analyze this SOW request carefully.\nLooking at the budget constraints..."]
```

## Usage Examples

### Basic Setup in Chat Components

```typescript
import { StreamingThoughtAccordion } from "@/components/tailwind/streaming-thought-accordion";
import { useStreamingChat } from "@/hooks/useStreamingChat";

export function MyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { streamingContent, reasoningSteps, streamMessage, isStreaming } = useStreamingChat();

  const handleSendMessage = async (userMessage: string) => {
    const messageId = `msg${Date.now()}`;
    
    // Add user message
    setMessages(prev => [...prev, {
      id: messageId,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }]);

    // Add empty assistant message
    const assistantId = `msg${Date.now() + 1}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }]);

    // Stream the response
    try {
      await streamMessage(assistantId, '/api/chat', { message: userMessage }, {
        onUpdate: (update) => {
          // Update message with streaming content
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? {
                  ...msg,
                  streamingContent: update.content,
                  reasoningSteps: update.reasoningSteps
                }
              : msg
          ));
        }
      });
    } catch (error) {
      console.error('Streaming failed:', error);
    }
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          {msg.role === 'assistant' ? (
            <StreamingThoughtAccordion
              messageId={msg.id}
              content={msg.content}
              streamingContent={msg.streamingContent}
              reasoningSteps={msg.reasoningSteps}
              isStreaming={isStreaming && msg.id === currentStreamingId}
            />
          ) : (
            <div>{msg.content}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Dashboard Chat Integration

```typescript
export default function DashboardChat({ ... }: DashboardChatProps) {
  const [streamingUpdates, setStreamingUpdates] = useState<
    Map<string, { content: string; reasoningSteps: string[] }>
  >(new Map());

  return (
    <StreamingThoughtAccordion
      messageId={msg.id}
      content={msg.content}
      isStreaming={streamingMessageId === msg.id}
      streamingContent={streamingUpdates.get(msg.id)?.content}
      reasoningSteps={streamingUpdates.get(msg.id)?.reasoningSteps}
    />
  );
}
```

## UI Features

### Visible Content Section
- **Markdown Rendering** - Full support for markdown formatting
- **Syntax Highlighting** - Code blocks are highlighted
- **Live Updates** - Content renders as it arrives
- **Copy Button** - Copy visible content to clipboard
- **Insert Button** - (Workspace mode) Insert content into SOW editor

### Reasoning Accordion
- **Step Counter** - Shows "Show thinking (5)" indicating 5 steps
- **Toggle Button** - Collapse/expand reasoning section
- **Individual Steps** - Each step can be expanded independently
  - Step number and preview on header row
  - Full step content when expanded
  - Syntax highlighting for code in reasoning
- **Copy All** - Copy entire reasoning section
- **Live Updates** - New reasoning steps appear as generated

### Streaming Indicators
- **Streaming Badge** - Shows "streaming..." with animated spinner
- **Animated Bar** - Pulsing gradient bar at bottom while streaming
- **Loading Text** - "AI is thinking..." when no visible content yet

## Styling and Theming

The system uses Tailwind CSS with a dark slate theme:

```css
/* Background colors */
--streaming-bg: bg-slate-800/50
--header-bg: bg-slate-900/60
--reasoning-bg: bg-slate-900/40
--step-bg: bg-slate-900/60

/* Text colors */
--text-primary: text-slate-100
--text-secondary: text-slate-300
--text-muted: text-slate-400

/* Accent colors */
--accent-emerald: emerald-600 (for buttons, indicators)
--accent-yellow: yellow-300 (for thinking icon)

/* Border colors */
--border: border-slate-700
--border-subtle: border-slate-700/50
```

## Performance Considerations

### Optimization Strategies

1. **Chunked Parsing** - Process streaming chunks incrementally
2. **Deduplication** - Avoid duplicate reasoning steps
3. **Lazy Rendering** - Only render expanded steps' content
4. **Memoization** - Use `useMemo` for expensive parsing operations
5. **Text Decoder** - Efficient UTF-8 decoding from ReadableStream

### Best Practices

1. **Limit visible messages** - Window to last N messages (e.g., 100)
2. **Debounce updates** - Consider throttling extremely frequent updates
3. **Cancel old streams** - Cancel previous stream if new message sent
4. **Memory cleanup** - Clear streaming state when component unmounts

## Error Handling

### Stream Cancellation

```typescript
const { cancel } = useStreamingChat();

// Cancel ongoing stream
cancel(); // Cleans up AbortController and resets state
```

### Network Errors

The hook handles common network errors:
- **AbortError** - User cancelled or navigated away (logged, not thrown)
- **API Errors** - Non-2xx responses throw with status code
- **Network Failures** - Connection errors trigger error callback

### Error Callback

```typescript
await streamMessage(messageId, endpoint, body, {
  onError: (messageId, error) => {
    console.error(`Stream failed for ${messageId}:`, error);
    // Update UI with error state
  }
});
```

## API Integration Points

### Required Endpoints

Your API endpoints should support streaming responses:

1. **Dashboard Chat** - `/api/dashboard/chat`
   - Returns `text/event-stream` or raw text stream
   - Streams complete response with thinking blocks included

2. **Workspace Chat** - `/api/anythingllm/generate-sow`
   - Streams SOW generation with reasoning

3. **Chat** - `/api/chat`
   - Generic chat streaming endpoint

### Response Format

Responses should include thinking blocks:

```
<think>
Initial analysis of the request...
</think>

Main response content here...

<thinking>
Additional reasoning about implications...
</thinking>

More main content...
```

## Browser Compatibility

Requires:
- **ReadableStream API** - For streaming response bodies
- **TextDecoder API** - For UTF-8 decoding
- **AbortController** - For stream cancellation
- **ES6+ Features** - Async/await, Map, Set

Supported browsers:
- Chrome 76+
- Firefox 65+
- Safari 13.1+
- Edge 76+

## Troubleshooting

### Reasoning Steps Not Appearing

**Check:**
1. Response includes proper `<think>...</think>` tags
2. `isStreaming` prop is set to `true` while streaming
3. `streamingContent` is being updated from hook
4. Console for parsing errors

### Content Not Rendering

**Check:**
1. Markdown content is valid
2. No unescaped special characters
3. JSON content detected correctly (starts with `{` or `[`)
4. Component has sufficient width to render

### Performance Issues

**Optimize:**
1. Reduce number of visible messages
2. Disable markdown rendering for large responses
3. Use larger chunk sizes in stream processing
4. Profile with Chrome DevTools

## Future Enhancements

- [ ] Token counting for reasoning vs. visible content
- [ ] Streaming metrics (steps/sec, tokens/sec)
- [ ] Custom reasoning formatters (JSON, YAML, etc.)
- [ ] Reasoning step search/filter
- [ ] Export reasoning steps as separate document
- [ ] Streaming animation improvements
- [ ] Mobile optimizations for small screens
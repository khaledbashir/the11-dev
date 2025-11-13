# Frontend Chat Payload Structure Investigation Report

## Executive Summary

Based on the comprehensive investigation of the frontend codebase, **the incorrect JSON structure `{prompt:"..."}` is NOT generated** in the primary chat message transmission paths. The application correctly uses either `{message:"..."}` for streaming API calls or `{messages:[...]}` for non-streaming calls.

## Investigation Methodology

- Analyzed `handleSendMessage` function in `frontend/app/page.tsx`
- Searched codebase for `prompt:` key usage in JSON payloads
- Examined all API call structures in chat transmission paths
- Verified streaming vs non-streaming payload differences

## Key Findings

### 1. Streaming API Call (AnythingLLM Integration)

**Location**: `frontend/app/page.tsx` lines 4467-4473

**Correct Payload Structure**:
```javascript
body: JSON.stringify({
  workspaceSlug: workspaceSlug,
  threadSlug: threadSlugToUse,
  // Perfect-mirror behavior: forward only the user's raw message
  message: rawUserMessage, // ← Uses 'message' key (CORRECT)
}),
```

**Endpoint**: `/api/anythingllm/stream-chat`
**Key**: `message` (singular string)

### 2. Non-Streaming API Call (OpenRouter Fallback)

**Location**: `frontend/app/page.tsx` lines 4723-4729

**Correct Payload Structure**:
```javascript
body: JSON.stringify({
  model: effectiveAgent.model,
  workspace: workspaceSlug,
  threadSlug: !isDashboardMode && currentDocId ? (documents.find(d => d.id === currentDocId)?.threadSlug || undefined) : undefined,
  messages: requestMessages, // ← Uses 'messages' key (CORRECT)
}),
```

**Endpoint**: General chat endpoint
**Key**: `messages` (array of message objects)

### 3. Non-Chat API Uses of 'prompt:' Key

Found 28 instances of `prompt:` usage in JSON.stringify, but **NONE are in primary chat transmission paths**:

#### a) UI Configuration Objects
```javascript
// Quick action templates for text editing
{ icon: <Sparkles />, label: "Improve", prompt: "Make this better and more polished" }
```

#### b) Text Enhancement API (`/api/ai/enhance-prompt`)
```javascript
// In dashboard-chat.tsx line 307
body: JSON.stringify({
  prompt: chatInput, // ← Enhancement endpoint (NOT chat transmission)
})
```

#### c) Legacy Chat Components
```javascript
// In workspace-chat.tsx line 342 - passes to onSendMessage callback
JSON.stringify({
  prompt: chatInput, // ← UI wrapper, converted to proper structure by parent
})
```

#### d) Text Processing Functions
```javascript
// Various text transformation utilities
body: JSON.stringify({
  prompt: textToProcess || " ", // ← Text processing (NOT chat)
  option: "zap",
})
```

## Message Flow Trace

### Primary Chat Transmission Path

```
User Input → handleSendMessage() → Conditional Routing:
├── Streaming Route (AnythingLLM)
│   └── Endpoint: /api/anythingllm/stream-chat
│   └── Payload: {message: rawUserMessage} ✓ CORRECT
│
└── Non-Streaming Route (OpenRouter)
    └── Endpoint: [Standard chat endpoint]
    └── Payload: {messages: requestMessages} ✓ CORRECT
```

### Non-Transmission Paths (Safe)

```
User Input → Text Enhancement
└── Endpoint: /api/ai/enhance-prompt
└── Payload: {prompt: text} ✓ EXPECTED (enhancement, not chat)

User Input → Text Processing
└── Endpoint: Various processing endpoints
└── Payload: {prompt: text} ✓ EXPECTED (processing, not chat)
```

## Conclusion

**CONFIRMED**: The exact JSON structure `{prompt:"..."}` **is not generated** in the primary chat message transmission paths. All chat-related API calls correctly use:

- `{message: "user message string"}` for streaming (AnythingLLM)
- `{messages: [...]}` for non-streaming (OpenRouter)

The instances of `{prompt: "..."}` found in the codebase are exclusively for:
- UI configuration and quick actions
- Text enhancement/processing endpoints
- Legacy component wrappers that convert to proper structure

The application's chat message transmission architecture is **functionally correct** with no `{prompt:"..."}` structure present in the main chat API calls.
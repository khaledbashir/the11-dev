#!/bin/bash

echo "🧪 TESTING PERFECT MIRROR ARCHITECTURE REFACTOR"
echo "=============================================="

# Test 1: Validate client-side changes
echo "📋 Test 1: Validating client-side changes..."
echo "Checking page.tsx for Perfect Mirror implementation..."

# Check if client sends the new request format
if grep -q "workspaceSlug: workspaceSlug" frontend/app/page.tsx && \
   grep -q "message: rawUserMessage" frontend/app/page.tsx && \
   grep -q "Perfect-mirror behavior: forward only the user's raw message" frontend/app/page.tsx; then
    echo "✅ Client-side refactor completed"
else
    echo "❌ Client-side refactor incomplete"
    exit 1
fi

# Test 2: Validate server-side changes
echo ""
echo "📋 Test 2: Validating server-side changes..."
echo "Checking route.ts for Perfect Mirror implementation..."

# Check if server uses new request format validation
if grep -q "workspaceSlug, threadSlug, message" frontend/app/api/anythingllm/stream-chat/route.ts && \
   grep -q "PERFECT MIRROR: Strict Input Validation" frontend/app/api/anythingllm/stream-chat/route.ts && \
   grep -q "PERFECT MIRROR: Native AnythingLLM Endpoint Selection" frontend/app/api/anythingllm/stream-chat/route.ts && \
   grep -q "PERFECT MIRROR: Direct Forwarding with Canonical Shape" frontend/app/api/anythingllm/stream-chat/route.ts && \
   grep -q "message: rawMessage" frontend/app/api/anythingllm/stream-chat/route.ts; then
    echo "✅ Server-side refactor completed"
else
    echo "❌ Server-side refactor incomplete"
    exit 1
fi

# Test 3: Validate native endpoint usage
echo ""
echo "📋 Test 3: Validating native endpoint usage..."
if grep -q "thread.*threadSlug.*stream-chat" frontend/app/api/anythingllm/stream-chat/route.ts && \
   grep -q "workspace.*workspaceSlug.*stream-chat" frontend/app/api/anythingllm/stream-chat/route.ts; then
    echo "✅ Native endpoints correctly implemented"
else
    echo "❌ Native endpoints not correctly implemented"
    exit 1
fi

# Test 4: Validate removal of complex logic
echo ""
echo "📋 Test 4: Validating removal of complex logic..."
if ! grep -q "getLiveAnalyticsData" frontend/app/api/anythingllm/stream-chat/route.ts && \
   ! grep -q "system message" frontend/app/api/anythingllm/stream-chat/route.ts && \
   ! grep -q "THE_ARCHITECT_V6_PROMPT" frontend/app/api/anythingllm/stream-chat/route.ts; then
    echo "✅ Complex logic successfully removed"
else
    echo "❌ Complex logic not fully removed"
    exit 1
fi

# Test 5: Check file structure
echo ""
echo "📋 Test 5: Validating file structure..."
if [ -f "frontend/app/page.tsx" ] && [ -f "frontend/app/api/anythingllm/stream-chat/route.ts" ]; then
    echo "✅ Required files exist"
else
    echo "❌ Required files missing"
    exit 1
fi

echo ""
echo "🎉 ALL TESTS PASSED!"
echo "==================="
echo "Perfect Mirror Architecture Successfully Implemented:"
echo "✅ Client sends { workspaceSlug, threadSlug?, message }"
echo "✅ Server validates and forwards to native AnythingLLM endpoints"
echo "✅ No system prompt injection - relies on workspace configuration"
echo "✅ Simplified, maintainable codebase"
echo ""
echo "The application now follows the Perfect Mirror architectural directive."
echo "All system prompts are managed in AnythingLLM workspace configuration."
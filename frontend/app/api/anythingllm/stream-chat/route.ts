import { NextRequest } from 'next/server';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

export async function POST(request: NextRequest) {
  try {
    const { messages, workspaceSlug, workspace, mode = 'chat' } = await request.json();
    
    // Use 'workspace' if provided, otherwise fall back to 'workspaceSlug'
    const effectiveWorkspaceSlug = workspace || workspaceSlug;
    
    console.log('🔍 [AnythingLLM Stream] Workspace Debug:', {
      receivedWorkspace: workspace,
      receivedWorkspaceSlug: workspaceSlug,
      effectiveWorkspaceSlug,
      mode
    });
    
    if (!effectiveWorkspaceSlug) {
      return new Response(
        JSON.stringify({ error: 'No workspace specified. Must provide workspace or workspaceSlug parameter.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the system prompt (if provided)
    const systemMessage = messages.find((m: any) => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response(
        JSON.stringify({ error: 'No user message provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Combine system prompt with user message if system prompt exists
    const messageToSend = systemPrompt 
      ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${lastMessage.content}`
      : lastMessage.content;

    // Send streaming chat request to AnythingLLM workspace
    console.log(`🚀 [AnythingLLM Stream] Sending to workspace: ${effectiveWorkspaceSlug}`);
    console.log(`📍 [AnythingLLM Stream] Full URL: ${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/stream-chat`);
    
    const response = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/stream-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageToSend,
        mode, // 'chat' or 'query'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AnythingLLM Stream] Error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AnythingLLM API error: ${response.statusText}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return the SSE stream directly to the client
    // Set up proper SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Create a TransformStream to pass through the SSE data
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start reading from AnythingLLM stream and writing to our stream
    (async () => {
      try {
        if (!response.body) {
          console.error('❌ [AnythingLLM Stream] No response body');
          await writer.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('✅ [AnythingLLM Stream] Stream complete');
            await writer.close();
            break;
          }

          // Decode the chunk
          buffer += decoder.decode(value, { stream: true });
          
          // Split by newlines to handle SSE format
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              // Forward the SSE line to the client
              console.log('📤 [AnythingLLM Stream] Forwarding:', line.substring(0, 100));
              await writer.write(encoder.encode(line + '\n'));
            }
          }
        }
      } catch (error) {
        console.error('❌ [AnythingLLM Stream] Error:', error);
        await writer.abort(error);
      }
    })();

    return new Response(readable, { headers });
  } catch (error) {
    console.error('❌ [AnythingLLM Stream] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { NextRequest } from 'next/server';

// Prefer secure server-side env vars; fallback to NEXT_PUBLIC for flexibility in current deployments
const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL;
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Require server-side configuration only
    if (!ANYTHINGLLM_URL || !ANYTHINGLLM_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AnythingLLM is not configured on the server. Set ANYTHINGLLM_URL and ANYTHINGLLM_API_KEY.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // ============================================================================
    // CRITICAL DEBUG: INCOMING /stream-chat PAYLOAD
    // ============================================================================
    const requestBody = await request.json();
    // Sanitize messages by removing any injected system prompts
    const sanitizedForLog = {
      ...requestBody,
      messages: Array.isArray(requestBody.messages)
        ? requestBody.messages.filter((m: any) => m && m.role !== 'system')
        : requestBody.messages,
    };
    const removedSystems = Array.isArray(requestBody.messages)
      ? requestBody.messages.filter((m: any) => m && m.role === 'system').length
      : 0;
    
    console.log('//////////////////////////////////////////////////');
    console.log('// CRITICAL DEBUG: INCOMING /stream-chat PAYLOAD //');
    console.log('//////////////////////////////////////////////////');
    console.log('FULL REQUEST BODY (sanitized: system messages removed from log):');
    console.log(JSON.stringify(sanitizedForLog, null, 2));
    console.log('');
    if (removedSystems > 0) {
      console.log(`WARN: Detected and ignored ${removedSystems} system message(s) in incoming payload.`);
    }
    console.log('KEY FIELDS:');
    console.log('  workspace:', sanitizedForLog.workspace);
    console.log('  workspaceSlug:', sanitizedForLog.workspaceSlug);
    console.log('  threadSlug:', sanitizedForLog.threadSlug);
    console.log('  mode:', sanitizedForLog.mode);
    console.log('  model:', sanitizedForLog.model);
    console.log('  messages.length:', sanitizedForLog.messages?.length);
    if (sanitizedForLog.messages && sanitizedForLog.messages.length > 0) {
      console.log('  messages[0].role:', sanitizedForLog.messages[0].role);
      console.log('  messages[0].content (first 200 chars):', sanitizedForLog.messages[0].content?.substring(0, 200));
      console.log('  messages[messages.length-1].role:', sanitizedForLog.messages[sanitizedForLog.messages.length - 1].role);
      console.log('  messages[messages.length-1].content (first 200 chars):', sanitizedForLog.messages[sanitizedForLog.messages.length - 1].content?.substring(0, 200));
    }
    console.log('//////////////////////////////////////////////////');
    // ============================================================================
    
  const body = requestBody;
  let { messages, workspaceSlug, workspace, threadSlug, mode = 'chat', model } = body;
    // Guard: strip any system messages from actual processing
    if (Array.isArray(messages)) {
      messages = messages.filter((m: any) => m && m.role !== 'system');
    }
    
    // Use 'workspace' if provided, otherwise fall back to 'workspaceSlug'
    const effectiveWorkspaceSlug = workspace || workspaceSlug;
    
    console.log('');
    console.log('=== WORKSPACE RESOLUTION ===');
    console.log('workspace param:', workspace);
    console.log('workspaceSlug param:', workspaceSlug);
    console.log('effectiveWorkspaceSlug:', effectiveWorkspaceSlug);
    console.log('');
    
    if (!effectiveWorkspaceSlug) {
      const errorMsg = 'No workspace specified. Must provide workspace or workspaceSlug parameter.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const errorMsg = 'No messages provided. Must provide messages array.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
  // Get the last user message
  const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      const errorMsg = 'No user message provided. Last message must be from user.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pass the user's message through without adding or appending extra instructions.
    // The workspace's system prompt governs behavior; do not inject per-message rails here.
    const messageToSend: string = typeof lastMessage.content === 'string' ? lastMessage.content : '';
    
    if (!messageToSend || typeof messageToSend !== 'string') {
      const errorMsg = 'Message content must be a non-empty string.';
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine the endpoint based on whether this is thread-based chat
    let endpoint: string;
  if (threadSlug) {
      // Thread-based streaming chat (saves to SOW's thread)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/thread/${threadSlug}/stream-chat`;
    } else {
      // Workspace-level streaming chat (legacy behavior)
      endpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/stream-chat`;
    }
    
    console.log('');
    console.log('=== ABOUT TO SEND TO ANYTHINGLLM ===');
    console.log('Endpoint:', endpoint);
    console.log('Workspace:', effectiveWorkspaceSlug);
    console.log('Mode:', mode);
    console.log('ThreadSlug:', threadSlug);
    console.log('');
    console.log('⚠️  CRITICAL: The system prompt for this workspace is configured in AnythingLLM.');
    console.log('⚠️  This route does NOT inject prompts - it relies on workspace configuration.');
    console.log('⚠️  If responses are generic, check the workspace settings in AnythingLLM admin.');
    console.log('');
    console.log('Message to send (first 500 chars):');
    console.log(messageToSend.substring(0, 500));
    console.log('...');
    console.log('=== END DEBUG ===');
    console.log('');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageToSend,
        mode, // 'chat' or 'query' (provided by caller)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Special logging for 401
      if (response.status === 401) {
        // Silently fail for 401 - do not expose auth details
      }
      
      return new Response(
        JSON.stringify({ 
          error: `AnythingLLM API error: ${response.statusText}`,
          details: errorText.substring(0, 200),
          status: response.status
        }),
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
          await writer.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
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
              await writer.write(encoder.encode(line + '\n'));
            }
          }
        }
      } catch (error) {
        await writer.abort(error);
      }
    })();

    return new Response(readable, { headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

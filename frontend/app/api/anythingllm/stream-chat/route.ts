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

    console.log('🔄 [Perfect Mirror] Processing new request...');

    // 🎯 PERFECT MIRROR: Strict Input Validation
    const requestBody = await request.json();
    const { workspaceSlug, threadSlug, message } = requestBody;

    // Validate required fields
    if (!workspaceSlug || typeof workspaceSlug !== 'string') {
      return new Response(
        JSON.stringify({ error: 'workspaceSlug is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'message is required and must be a non-empty string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate message is plain string (no JSON objects)
    const rawMessage = message.trim();
    if (rawMessage.startsWith('{') && rawMessage.endsWith('}')) {
      try {
        JSON.parse(rawMessage);
        return new Response(
          JSON.stringify({ error: 'message must be plain text, not JSON' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      } catch {
        // Not JSON, continue
      }
    }

    console.log('✅ [Perfect Mirror] Input validation passed');
    console.log('  workspaceSlug:', workspaceSlug);
    console.log('  threadSlug:', threadSlug || '(none)');
    console.log('  message (first 100 chars):', rawMessage.substring(0, 100));

    // 🎯 PERFECT MIRROR: Native AnythingLLM Endpoint Selection
    const endpoint = threadSlug
      ? `${ANYTHINGLLM_URL}/api/v1/workspace/${workspaceSlug}/thread/${threadSlug}/stream-chat`
      : `${ANYTHINGLLM_URL}/api/v1/workspace/${workspaceSlug}/stream-chat`;

    console.log('🎯 [Perfect Mirror] Forwarding to native endpoint:', endpoint);

    // 🎯 PERFECT MIRROR: Direct Forwarding with Canonical Shape
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: rawMessage,
        mode: 'chat'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Perfect Mirror] AnythingLLM API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({
          error: `AnythingLLM API error: ${response.statusText}`,
          details: errorText.substring(0, 500),
          status: response.status
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [Perfect Mirror] Forwarding successful, establishing stream...');

    // Return the SSE stream directly to the client
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Create a TransformStream to pass through the SSE data
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Start reading from AnythingLLM stream and writing to our stream
    (async () => {
      try {
        if (!response.body) {
          console.error('❌ [Perfect Mirror] No response body from AnythingLLM');
          await writer.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('✅ [Perfect Mirror] Stream completed');
            await writer.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          let lineEndIndex;
          while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEndIndex);
            buffer = buffer.substring(lineEndIndex + 1);

            if (line.trim()) {
              await writer.write(new TextEncoder().encode(line + '\n'));
            }
          }
        }
      } catch (error) {
        console.error('❌ [Perfect Mirror] Stream error:', error);
        await writer.abort(error);
      }
    })();

    return new Response(readable, { headers });
  } catch (error) {
    console.error('❌ [Perfect Mirror] Internal server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

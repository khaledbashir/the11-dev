import { NextRequest, NextResponse } from 'next/server';

/**
 * Prompt Enhancement Proxy
 * Routes enhancement requests to the utility-prompt-enhancer workspace in AnythingLLM
 */
export async function POST(req: NextRequest) {
  try {
    const anythingLLMURL = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL;
    const anythingLLMKey = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY;
    
    if (!anythingLLMURL || !anythingLLMKey) {
      console.error('[enhance-prompt] Missing AnythingLLM configuration');
      return NextResponse.json(
        { error: 'AnythingLLM not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { prompt, mode = 'enhance' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'No prompt provided. Must provide prompt as a string.' },
        { status: 400 }
      );
    }

    console.log('[enhance-prompt] Enhancing prompt:', {
      promptLength: prompt.length,
      mode,
    });

    // Route to the utility-prompt-enhancer workspace via stream-chat
    const endpoint = `${anythingLLMURL.replace(/\/$/, '')}/api/v1/workspace/utility-prompt-enhancer/stream-chat`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anythingLLMKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        mode: 'chat',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[enhance-prompt] AnythingLLM error:', {
        status: response.status,
        error: errorText.substring(0, 200),
      });
      
      return NextResponse.json(
        { 
          error: `AnythingLLM API error: ${response.statusText}`,
          details: errorText.substring(0, 200),
        },
        { status: response.status }
      );
    }

    // Stream the response back to client
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Create passthrough stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

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

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              await writer.write(encoder.encode(line + '\n'));
            }
          }
        }

        if (buffer.trim()) {
          await writer.write(encoder.encode(buffer));
        }
      } catch (error) {
        console.error('[enhance-prompt] Stream error:', error);
        await writer.abort(error);
      }
    })();

    return new Response(readable, { headers });

  } catch (error: any) {
    console.error('[enhance-prompt] Exception:', error);
    return NextResponse.json(
      { 
        error: 'Enhancement request failed',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    service: 'prompt-enhancer',
    workspace: 'utility-prompt-enhancer'
  });
}

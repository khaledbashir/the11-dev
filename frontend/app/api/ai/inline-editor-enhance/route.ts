import { NextRequest, NextResponse } from 'next/server';

/**
 * Inline Editor Enhancement Proxy
 * Routes text improvement requests to the utility-inline-enhancer workspace in AnythingLLM
 * This is SEPARATE from the prompt enhancer - it's for enhancing selected text in the editor
 */
export async function POST(req: NextRequest) {
  try {
    const anythingLLMURL = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL;
    const anythingLLMKey = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY;
    
    if (!anythingLLMURL || !anythingLLMKey) {
      console.error('[inline-editor-enhance] Missing AnythingLLM configuration');
      return NextResponse.json(
        { error: 'AnythingLLM not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'No text provided. Must provide text as a string.' },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Selected text is empty.' },
        { status: 400 }
      );
    }

    console.log('[inline-editor-enhance] Improving text:', {
      textLength: text.length,
      preview: text.substring(0, 100),
    });

    // Route to the utility-inline-enhancer workspace via stream-chat
    const endpoint = `${anythingLLMURL.replace(/\/$/, '')}/api/v1/workspace/utility-inline-enhancer/stream-chat`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anythingLLMKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text,
        mode: 'chat',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[inline-editor-enhance] AnythingLLM error:', {
        status: response.status,
        error: errorText.substring(0, 200),
      });
      
      // Check if workspace doesn't exist
      if (response.status === 404) {
        return NextResponse.json(
          { 
            error: 'Inline editor enhancement workspace not found. Please run create-inline-editor-workspace.sh',
            details: 'The utility-inline-enhancer workspace needs to be created first',
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `AnythingLLM API error: ${response.statusText}`,
          details: errorText.substring(0, 200),
        },
        { status: response.status }
      );
    }

    // Consume the SSE stream and accumulate the improved text
    let improvedText = '';
    
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json({ 
        error: 'No response body from AnythingLLM' 
      }, { status: 500 });
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const json = JSON.parse(data);
              if (json.textResponse) {
                improvedText += json.textResponse;
              }
            } catch (e) {
              // Skip JSON parse errors in stream
              console.log('[inline-editor-enhance] Skipping line:', line.substring(0, 50));
            }
          }
        }
      }

      // Final flush of any remaining buffer
      if (buffer && buffer.trim() && buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data !== '[DONE]') {
          try {
            const json = JSON.parse(data);
            if (json.textResponse) {
              improvedText += json.textResponse;
            }
          } catch (e) {
            // Final buffer parse error
          }
        }
      }

      improvedText = improvedText.trim();

      if (!improvedText) {
        console.warn('[inline-editor-enhance] Enhancement returned empty text');
        return NextResponse.json(
          { error: 'Enhancement returned empty text. Try again.' },
          { status: 400 }
        );
      }

      console.log('[inline-editor-enhance] Text improved successfully:', {
        originalLength: text.length,
        improvedLength: improvedText.length,
        preview: improvedText.substring(0, 100),
      });

      return NextResponse.json({
        success: true,
        improvedText,
        enhancedText: improvedText, // Alias for compatibility
        original: text,
        originalLength: text.length,
        improvedLength: improvedText.length,
      });

    } catch (e: any) {
      console.error('[inline-editor-enhance] Stream reading error:', e);
      return NextResponse.json(
        { error: 'Failed to read enhancement stream', details: e.message },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[inline-editor-enhance] Exception:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

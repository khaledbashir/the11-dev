import { NextRequest } from 'next/server';
import { match } from "ts-pattern";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<Response> {
  const anythingLLMURL = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL || '';
  const anythingLLMKey = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY || '';
  
  if (!anythingLLMURL || !anythingLLMKey) {
    return new Response(
      JSON.stringify({ error: "AnythingLLM not configured" }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { prompt, option, command } = await req.json();

  const userMessage = match(option)
    .with("continue", () => `Continue: ${prompt}`)
    .with("generate", () => command || prompt)
    .with("improve", () => `Improve: ${prompt}`)
    .with("shorter", () => `Shorter: ${prompt}`)
    .with("longer", () => `Longer: ${prompt}`)
    .with("fix", () => `Fix: ${prompt}`)
    .with("zap", () => `${command}\n\n${prompt}`)
    .otherwise(() => prompt);

  try {
    const response = await fetch(
      `${anythingLLMURL.replace(/\/$/, '')}/api/v1/workspace/utility-inline-editor/stream-chat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anythingLLMKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          mode: 'chat',
        }),
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `AnythingLLM error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          let buffer = '';

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
                  if (json.textResponse && json.type === 'textResponse') {
                    controller.enqueue(encoder.encode(json.textResponse));
                  }
                } catch (e) {}
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'AnythingLLM request failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

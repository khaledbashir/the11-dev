import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from 'next/server';
import { match } from "ts-pattern";

// IMPORTANT! Set the runtime to edge: https://vercel.com/docs/functions/edge-functions/edge-runtime
export const runtime = "edge";

export async function POST(req: NextRequest): Promise<Response> {
  // Check if AnythingLLM credentials are set
  if (!process.env.ANYTHINGLLM_API_KEY || process.env.ANYTHINGLLM_API_KEY === "") {
    return new Response("Missing ANYTHINGLLM_API_KEY - make sure to add it to your .env file.", {
      status: 400,
    });
  }
  
  if (!process.env.ANYTHINGLLM_WORKSPACE_SLUG || process.env.ANYTHINGLLM_WORKSPACE_SLUG === "") {
    return new Response("Missing ANYTHINGLLM_WORKSPACE_SLUG - make sure to add it to your .env file.", {
      status: 400,
    });
  }

  // Rate limiting disabled - KV client type incompatibility with Ratelimit
  // Can be re-enabled with proper Redis client setup

  const { prompt, option, command, model = "anthropic/claude-3.5-sonnet" } = await req.json();

  const messages = match(option)
    .with("continue", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that continues existing text based on context from prior text. " +
          "Give more weight/priority to the later characters than the beginning ones. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
          "Use Markdown formatting when appropriate.",
      },
      {
        role: "user",
        content: prompt,
      },
    ])
    .with("improve", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that improves existing text. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
          "Use Markdown formatting when appropriate.",
      },
      {
        role: "user",
        content: `The existing text is: ${prompt}`,
      },
    ])
    .with("shorter", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that shortens existing text. " + "Use Markdown formatting when appropriate.",
      },
      {
        role: "user",
        content: `The existing text is: ${prompt}`,
      },
    ])
    .with("longer", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that lengthens existing text. " +
          "Use Markdown formatting when appropriate.",
      },
      {
        role: "user",
        content: `The existing text is: ${prompt}`,
      },
    ])
    .with("fix", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that fixes grammar and spelling errors in existing text. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
          "Use Markdown formatting when appropriate.",
      },
      {
        role: "user",
        content: `The existing text is: ${prompt}`,
      },
    ])
    .with("zap", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that generates text based on a prompt. " +
          "You take an input from the user and a command for manipulating the text" +
          "Use Markdown formatting when appropriate.",
      },
      {
        role: "user",
        content: `For this text: ${prompt}. You have to respect the command: ${command}`,
      },
    ])
    .run();

  try {
    // Build the prompt message for AnythingLLM
    const fullPrompt = match(option)
      .with("continue", () => `Continue this text: ${prompt}`)
      .with("improve", () => `Improve this text: ${prompt}`)
      .with("shorter", () => `Make this shorter: ${prompt}`)
      .with("longer", () => `Make this longer: ${prompt}`)
      .with("fix", () => `Fix grammar and spelling: ${prompt}`)
      .with("zap", () => `${command}: ${prompt}`)
      .run();

    const anythingllmUrl = process.env.ANYTHINGLLM_URL || "https://ahmad-anything-llm.840tjq.easypanel.host";
    const workspaceSlug = process.env.ANYTHINGLLM_WORKSPACE_SLUG || "pop";
    const apiKey = process.env.ANYTHINGLLM_API_KEY;

    // Call AnythingLLM stream-chat endpoint (correct endpoint for streaming)
    // POST /v1/workspace/{slug}/stream-chat
    const response = await fetch(
      `${anythingllmUrl}/api/v1/workspace/${workspaceSlug}/stream-chat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: fullPrompt,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AnythingLLM error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ error: `AnythingLLM API error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle streaming response from AnythingLLM
    // stream-chat returns Server-Sent Events (SSE) format
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
            
            // Parse SSE format (lines starting with "data: ")
            const lines = buffer.split('\n');
            
            // Keep the last incomplete line in buffer
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                
                // Skip [DONE] marker
                if (data === '[DONE]') continue;
                
                try {
                  // Try to parse as JSON
                  const json = JSON.parse(data);
                  // AnythingLLM stream-chat returns: { "id": "...", "textResponse": "..." }
                  const text = json.textResponse || json.text || json.message || '';
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                } catch (e) {
                  // If not valid JSON, try sending as plain text
                  if (data && data !== '') {
                    controller.enqueue(encoder.encode(data));
                  }
                }
              }
            }
          }
          
          // Process any remaining data in buffer
          if (buffer.trim()) {
            if (buffer.startsWith('data: ')) {
              const data = buffer.slice(6).trim();
              if (data !== '[DONE]') {
                try {
                  const json = JSON.parse(data);
                  const text = json.textResponse || json.text || json.message || '';
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                } catch (e) {
                  if (data) {
                    controller.enqueue(encoder.encode(data));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
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
    console.error('AnythingLLM API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get response from AnythingLLM' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

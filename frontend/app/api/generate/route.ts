import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from 'next/server';
import { match } from "ts-pattern";

// IMPORTANT! Set the runtime to edge: https://vercel.com/docs/functions/edge-functions/edge-runtime
export const runtime = "edge";

export async function POST(req: NextRequest): Promise<Response> {
  // Check if OpenRouter API key is set
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === "") {
    return new Response("Missing OPENROUTER_API_KEY - make sure to add it to your .env file.", {
      status: 400,
    });
  }

  // Rate limiting disabled - KV client type incompatibility with Ratelimit
  // Can be re-enabled with proper Redis client setup

  // Get model from request or fall back to env var, then to default
  const { prompt, option, command, model } = await req.json();
  const defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemini-2.0-flash-exp:free";
  const selectedModel = model || defaultModel;

  const messages = match(option)
    .with("continue", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that continues existing text based on context from prior text. " +
          "Give more weight/priority to the later characters than the beginning ones. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
          "Output ONLY the continuation text, no explanations or commentary.",
      },
      {
        role: "user",
        content: prompt,
      },
    ])
    .with("generate", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that generates new content based on user requests. " +
          "Output ONLY the generated content, no explanations or commentary. " +
          "Format the response as requested by the user.",
      },
      {
        role: "user",
        content: command || prompt,
      },
    ])
    .with("improve", () => [
      {
        role: "system",
        content:
          "You are an AI writing assistant that improves existing text. " +
          "Output ONLY the improved version, no explanations or commentary. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences.",
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
          "You are an AI writing assistant that shortens existing text. " + 
          "Output ONLY the shortened version, no explanations or commentary.",
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
          "Output ONLY the expanded version, no explanations or commentary.",
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
          "Output ONLY the corrected text, no explanations or commentary. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences.",
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
          "You are an AI writing assistant that transforms text based on user commands. " +
          "Output ONLY the transformed text, no explanations, commentary, or meta-descriptions. " +
          "Just apply the command to the text and return the result directly.",
      },
      {
        role: "user",
        content: `Text: ${prompt}\n\nCommand: ${command}\n\nOutput only the transformed text:`,
      },
    ])
    .run();

  try {
    // Use OpenRouter for direct LLM completion (no RAG/document search needed)
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    
    if (!openRouterApiKey) {
      return new Response("Missing OPENROUTER_API_KEY in .env", {
        status: 400,
      });
    }

    // Call OpenRouter streaming API directly
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: messages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ error: `OpenRouter API error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle OpenRouter streaming response (SSE format)
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
                  // Parse OpenRouter response format
                  const json = JSON.parse(data);
                  // OpenRouter streaming format: { "choices": [{ "delta": { "content": "..." } }] }
                  const content = json.choices?.[0]?.delta?.content || '';
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          // Process any remaining data in buffer
          if (buffer.trim() && buffer.startsWith('data: ')) {
            const data = buffer.slice(6).trim();
            if (data !== '[DONE]') {
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                // Skip invalid JSON
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
    console.error('OpenRouter API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get response from OpenRouter' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

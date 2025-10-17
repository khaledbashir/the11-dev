import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from 'next/server';
import { match } from "ts-pattern";

// IMPORTANT! Set the runtime to edge: https://vercel.com/docs/functions/edge-functions/edge-runtime
export const runtime = "edge";

export async function POST(req: NextRequest): Promise<Response> {
  // Check if the OPENROUTER_API_KEY is set, if not return 400
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === "") {
    return new Response("Missing OPENROUTER_API_KEY - make sure to add it to your .env file.", {
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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true, // Enable streaming
      }),
    });

    if (!response.ok) {
      return new Response(await response.text(), { status: response.status });
    }

    // Transform OpenRouter SSE stream to AI SDK format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) return;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const json = JSON.parse(data);
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) {
                    // Send in AI SDK format - raw text only
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Skip malformed JSON - sometimes happens with preambles
                  console.error('Stream parse error:', e, 'Data:', data);
                }
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
    console.error('OpenRouter API error:', error);
    return new Response("Failed to get response from OpenRouter", {
      status: 500,
    });
  }
}

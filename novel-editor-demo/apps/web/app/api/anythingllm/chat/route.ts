import { NextRequest, NextResponse } from 'next/server';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

export async function POST(request: NextRequest) {
  try {
    const { messages, workspaceSlug, workspace = 'gen', mode = 'chat' } = await request.json();
    
    // Use 'workspace' if provided, otherwise fall back to 'workspaceSlug', then default to 'gen'
    const effectiveWorkspaceSlug = workspace || workspaceSlug || 'gen';
    
    // Get the system prompt (if provided)
    const systemMessage = messages.find((m: any) => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'No user message provided' },
        { status: 400 }
      );
    }

    console.log('🔵 [AnythingLLM Chat] Sending to workspace:', effectiveWorkspaceSlug);
    console.log('🔵 [AnythingLLM Chat] System Prompt:', systemPrompt ? `${systemPrompt.substring(0, 100)}...` : 'None');
    console.log('🔵 [AnythingLLM Chat] Message:', lastMessage.content.substring(0, 100) + '...');

    // Combine system prompt with user message if system prompt exists
    const messageToSend = systemPrompt 
      ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${lastMessage.content}`
      : lastMessage.content;

    // Send chat request to AnythingLLM workspace
    const response = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/${effectiveWorkspaceSlug}/chat`, {
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
      console.error('❌ [AnythingLLM Chat] Error:', response.status, errorText);
      return NextResponse.json(
        { error: `AnythingLLM API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [AnythingLLM Chat] Response received');

    // Format response to match OpenAI structure
    return NextResponse.json({
      id: data.id || Date.now().toString(),
      object: 'chat.completion',
      created: Date.now(),
      model: 'anythingllm',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.textResponse || 'No response',
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: data.metrics?.prompt_tokens || 0,
        completion_tokens: data.metrics?.completion_tokens || 0,
        total_tokens: data.metrics?.total_tokens || 0,
      },
    });
  } catch (error) {
    console.error('❌ [AnythingLLM Chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

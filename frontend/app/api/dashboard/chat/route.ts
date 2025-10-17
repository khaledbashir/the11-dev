import { NextRequest, NextResponse } from 'next/server';

// ⚠️ CRITICAL: This route is EXCLUSIVELY for dashboard chat
// It is HARDCODED to use the sow-master-dashboard workspace
// NO conditional logic, NO variables for workspace selection

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

// 🔒 HARDCODED WORKSPACE - NEVER CHANGE THIS
const DASHBOARD_WORKSPACE = 'sow-master-dashboard';

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    
    console.log('🎯 [DASHBOARD CHAT] Route called - HARDCODED to sow-master-dashboard');
    console.log('🔒 [DASHBOARD CHAT] Workspace:', DASHBOARD_WORKSPACE);
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from user' },
        { status: 400 }
      );
    }

    // Get system prompt if exists
    const systemMessage = messages.find((m: any) => m.role === 'system');
    const systemPrompt = systemMessage?.content || '';

    // Combine system prompt with user message
    const messageToSend = systemPrompt 
      ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${lastMessage.content}`
      : lastMessage.content;

    console.log('📤 [DASHBOARD CHAT] Sending to AnythingLLM...');
    console.log('📍 [DASHBOARD CHAT] URL:', `${ANYTHINGLLM_URL}/api/v1/workspace/${DASHBOARD_WORKSPACE}/stream-chat`);
    console.log('💬 [DASHBOARD CHAT] Message preview:', messageToSend.substring(0, 100));

    // Call AnythingLLM streaming chat endpoint
    const response = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/${DASHBOARD_WORKSPACE}/stream-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageToSend,
        mode: 'chat',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [DASHBOARD CHAT] AnythingLLM error:', response.status, errorText);
      return NextResponse.json(
        { error: `AnythingLLM API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    console.log('✅ [DASHBOARD CHAT] Response received from AnythingLLM');

    // Check if response is streaming
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('text/event-stream') || contentType?.includes('stream')) {
      console.log('📡 [DASHBOARD CHAT] Streaming response detected');
      
      // Return streaming response
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Handle JSON response
      console.log('📦 [DASHBOARD CHAT] JSON response detected');
      const data = await response.json();
      
      // Format response to match OpenAI structure
      return NextResponse.json({
        id: data.id || Date.now().toString(),
        object: 'chat.completion',
        created: Date.now(),
        model: 'anythingllm-dashboard',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: data.textResponse || 'No response',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    }
  } catch (error) {
    console.error('❌ [DASHBOARD CHAT] Critical error:', error);
    return NextResponse.json(
      { error: 'Internal server error in dashboard chat' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

/**
 * Agent Invocation API Route
 * 
 * This route handles @agent invocations by:
 * 1. Creating an agent invocation in AnythingLLM
 * 2. Returning a WebSocket URL for the client to connect to
 * 3. Client receives streaming tool execution updates via WebSocket
 */
export async function POST(request: NextRequest) {
  try {
    const { message, workspaceSlug, threadSlug } = await request.json();
    
    console.log('🤖 [AGENT API] Agent invocation request:', {
      workspaceSlug,
      threadSlug,
      messagePreview: message.substring(0, 100)
    });
    
    if (!workspaceSlug) {
      return NextResponse.json(
        { error: 'No workspace specified' },
        { status: 400 }
      );
    }

    // Step 1: Create agent invocation in AnythingLLM backend
    const invocationEndpoint = `${ANYTHINGLLM_URL}/api/v1/workspace/${workspaceSlug}/agent-invocation`;
    
    console.log('📡 [AGENT API] Creating invocation at:', invocationEndpoint);
    
    const invocationResponse = await fetch(invocationEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        ...(threadSlug ? { threadSlug } : {}),
      }),
    });

    if (!invocationResponse.ok) {
      const errorText = await invocationResponse.text();
      console.error('❌ [AGENT API] Invocation failed:', invocationResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to create agent invocation: ${invocationResponse.statusText}` },
        { status: invocationResponse.status }
      );
    }

    const invocationData = await invocationResponse.json();
    
    console.log('✅ [AGENT API] Invocation created:', {
      uuid: invocationData.uuid,
      workspaceId: invocationData.workspace_id
    });

    // Step 2: Return WebSocket connection info
    // Client will connect to: ws://anythingllm/agent-invocation/{uuid}
    const wsUrl = ANYTHINGLLM_URL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    
    return NextResponse.json({
      success: true,
      invocation: {
        uuid: invocationData.uuid,
        websocketUrl: `${wsUrl}/agent-invocation/${invocationData.uuid}`,
        workspaceId: invocationData.workspace_id,
      }
    });

  } catch (error) {
    console.error('❌ [AGENT API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

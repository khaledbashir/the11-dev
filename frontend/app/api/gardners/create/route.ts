import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      category = 'custom',
      systemPrompt,
      temperature = 0.7,
      chatHistory = 20,
      chatMode = 'chat',
      similarityThreshold = 0.25,
      topN = 4,
      queryRefusalResponse = 'There is no relevant information in this workspace to answer your query.',
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    console.log('🌱 [Gardner Create] Creating new Gardner:', name);

    // Step 1: Create workspace in AnythingLLM
    const workspaceResponse = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        openAiTemp: temperature,
        openAiHistory: chatHistory,
        openAiPrompt: systemPrompt,
        chatMode,
        similarityThreshold,
        topN,
        queryRefusalResponse,
      }),
    });

    if (!workspaceResponse.ok) {
      const errorText = await workspaceResponse.text();
      console.error('❌ [Gardner Create] AnythingLLM workspace creation failed:', errorText);
      return NextResponse.json(
        { error: `Failed to create workspace: ${workspaceResponse.statusText}` },
        { status: workspaceResponse.status }
      );
    }

    const responseText = await workspaceResponse.text();
    let workspaceData;
    
    try {
      workspaceData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [Gardner Create] Failed to parse response (got HTML?):', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Invalid response from AnythingLLM (check API URL and key)' },
        { status: 502 }
      );
    }
    const workspaceSlug = workspaceData.workspace.slug;

    console.log('✅ [Gardner Create] Workspace created:', workspaceSlug);

    // Step 2: Store Gardner reference in database
    const gardnerId = `gardner-${uuidv4()}`;
    
    await query(
      'INSERT INTO gardners (id, workspace_slug, category) VALUES (?, ?, ?)',
      [gardnerId, workspaceSlug, category]
    );

    console.log('✅ [Gardner Create] Gardner stored in database:', gardnerId);

    return NextResponse.json({
      success: true,
      gardner: {
        id: gardnerId,
        name: workspaceData.workspace.name,
        slug: workspaceSlug,
        category,
        systemPrompt,
        temperature,
        chatHistory,
        chatMode,
        createdAt: workspaceData.workspace.createdAt,
      },
    });

  } catch (error) {
    console.error('❌ [Gardner Create] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

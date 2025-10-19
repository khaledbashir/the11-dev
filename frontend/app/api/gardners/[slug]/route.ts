import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

// GET - Get single Gardner by slug
export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    const { slug } = params;
    console.log('🌱 [Gardner Get] Fetching Gardner:', slug);

    // Fetch workspace details from AnythingLLM
    const workspaceResponse = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/${slug}`, {
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workspaceResponse.ok) {
      return NextResponse.json(
        { error: 'Gardner not found' },
        { status: 404 }
      );
    }

    const { workspace } = await workspaceResponse.json();
    
    // Get Gardner metadata from database
    const gardnerData = await query(
      'SELECT * FROM gardners WHERE workspace_slug = ?',
      [slug]
    ) as any[];

    const gardner = gardnerData[0];

    return NextResponse.json({
      gardner: {
        id: gardner?.id || slug,
        name: workspace[0].name,
        slug: workspace[0].slug,
        category: gardner?.category || 'custom',
        systemPrompt: workspace[0].openAiPrompt,
        temperature: workspace[0].openAiTemp,
        chatHistory: workspace[0].openAiHistory,
        chatMode: workspace[0].chatMode,
        chatProvider: workspace[0].chatProvider,
        chatModel: workspace[0].chatModel,
        createdAt: gardner?.created_at || workspace[0].createdAt,
        lastUpdated: workspace[0].lastUpdatedAt,
      },
    });

  } catch (error) {
    console.error('❌ [Gardner Get] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update Gardner
export async function PUT(
  request: NextRequest, 
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    const { slug } = params;
    const body = await request.json();
    
    console.log('🌱 [Gardner Update] Updating Gardner:', slug);

    const {
      name,
      systemPrompt,
      temperature,
      chatHistory,
      chatMode,
      category,
    } = body;

    // Update workspace in AnythingLLM
    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (systemPrompt !== undefined) updatePayload.openAiPrompt = systemPrompt;
    if (temperature !== undefined) updatePayload.openAiTemp = temperature;
    if (chatHistory !== undefined) updatePayload.openAiHistory = chatHistory;
    if (chatMode !== undefined) updatePayload.chatMode = chatMode;

    const workspaceResponse = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/${slug}/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!workspaceResponse.ok) {
      const errorText = await workspaceResponse.text();
      console.error('❌ [Gardner Update] Failed to update workspace:', errorText);
      return NextResponse.json(
        { error: 'Failed to update Gardner' },
        { status: workspaceResponse.status }
      );
    }

    // Update category in database if provided
    if (category !== undefined) {
      await query(
        'UPDATE gardners SET category = ? WHERE workspace_slug = ?',
        [category, slug]
      );
    }

    console.log('✅ [Gardner Update] Gardner updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Gardner updated successfully',
    });

  } catch (error) {
    console.error('❌ [Gardner Update] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete Gardner
export async function DELETE(
  request: NextRequest, 
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    const { slug } = params;
    console.log('🌱 [Gardner Delete] Deleting Gardner:', slug);

    // Delete workspace from AnythingLLM
    const workspaceResponse = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspace/${slug}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workspaceResponse.ok && workspaceResponse.status !== 404) {
      console.error('❌ [Gardner Delete] Failed to delete workspace');
      return NextResponse.json(
        { error: 'Failed to delete Gardner workspace' },
        { status: workspaceResponse.status }
      );
    }

    // Remove from database
    await query('DELETE FROM gardners WHERE workspace_slug = ?', [slug]);

    console.log('✅ [Gardner Delete] Gardner deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Gardner deleted successfully',
    });

  } catch (error) {
    console.error('❌ [Gardner Delete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

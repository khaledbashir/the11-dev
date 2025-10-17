import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

export async function GET(request: NextRequest) {
  try {
    console.log('🌱 [Gardner List] Fetching all Gardners...');

    // Step 1: Get all Gardner workspace slugs from database
    const gardners = await query('SELECT * FROM gardners ORDER BY created_at DESC') as any[];

    if (!gardners || gardners.length === 0) {
      console.log('📭 [Gardner List] No Gardners found in database');
      return NextResponse.json({ gardners: [] });
    }

    console.log(`🌱 [Gardner List] Found ${gardners.length} Gardners in database`);

    // Step 2: Fetch all workspaces from AnythingLLM
    const workspacesResponse = await fetch(`${ANYTHINGLLM_URL}/api/v1/workspaces`, {
      headers: {
        'Authorization': `Bearer ${ANYTHINGLLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      console.error('❌ [Gardner List] Failed to fetch workspaces from AnythingLLM');
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: workspacesResponse.status }
      );
    }

    const { workspaces } = await workspacesResponse.json();

    // Step 3: Match Gardners with their workspace data
    const enrichedGardners = gardners.map((gardner) => {
      const workspace = workspaces.find((w: any) => w.slug === gardner.workspace_slug);
      
      if (!workspace) {
        console.warn(`⚠️ [Gardner List] Workspace not found for Gardner: ${gardner.workspace_slug}`);
        return null;
      }

      return {
        id: gardner.id,
        name: workspace.name,
        slug: workspace.slug,
        category: gardner.category,
        systemPrompt: workspace.openAiPrompt,
        temperature: workspace.openAiTemp,
        chatHistory: workspace.openAiHistory,
        chatMode: workspace.chatMode,
        chatProvider: workspace.chatProvider,
        chatModel: workspace.chatModel,
        createdAt: gardner.created_at,
        lastUpdated: workspace.lastUpdatedAt,
      };
    }).filter(Boolean); // Remove null entries

    console.log(`✅ [Gardner List] Returning ${enrichedGardners.length} enriched Gardners`);

    return NextResponse.json({
      gardners: enrichedGardners,
    });

  } catch (error) {
    console.error('❌ [Gardner List] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

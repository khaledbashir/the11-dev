import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ANYTHINGLLM_URL = process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host';
const ANYTHINGLLM_API_KEY = process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA';

export async function GET(request: NextRequest) {
  try {
    console.log('🌱 [Gardner List] Fetching all Gardners from AnythingLLM...');

    // Step 1: Fetch ALL workspaces from AnythingLLM
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

    const responseText = await workspacesResponse.text();
    let workspaces;
    
    try {
      const data = JSON.parse(responseText);
      workspaces = data.workspaces;
    } catch (parseError) {
      console.error('❌ [Gardner List] Failed to parse AnythingLLM response (got HTML?):', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Invalid response from AnythingLLM (check API URL and key)' },
        { status: 502 }
      );
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('📭 [Gardner List] No workspaces found in AnythingLLM');
      return NextResponse.json({ gardners: [] });
    }

    console.log(`🌱 [Gardner List] Found ${workspaces.length} workspaces in AnythingLLM`);

    // Step 2: Define Gardner workspace slugs (all AI agent workspaces)
    const gardnerSlugs = [
      'gen-the-architect',
      'property-marketing-pro',
      'ad-copy-machine',
      'crm-communication-specialist',
      'case-study-crafter',
      'landing-page-persuader',
      'seo-content-strategist',
      'proposal-and-audit-specialist'
    ];
    
    // Filter to only include Gardner workspaces
    const gardnerWorkspaces = workspaces.filter((ws: any) => 
      ws.slug && gardnerSlugs.includes(ws.slug)
    );
    
    console.log(`🔍 [Gardner List] Filtered to ${gardnerWorkspaces.length} Gardners from ${workspaces.length} total workspaces`);
    console.log(`📋 [Gardner List] Gardner slugs found:`, gardnerWorkspaces.map((w: any) => w.slug));

    // Step 3: Get database entries (for category info)
    const dbGardners = await query('SELECT * FROM gardners') as any[];
    const gardnerMap = new Map(dbGardners.map((g: any) => [g.workspace_slug, g]));

    // Step 4: Map Gardner workspaces to enriched Gardner objects
    // Extract category from workspace name (e.g., "GEN - The Architect" -> category from slug pattern)
    const getCategoryFromSlug = (slug: string): string => {
      if (slug.includes('gen') || slug.includes('architect')) return 'sow';
      if (slug.includes('property')) return 'custom';
      if (slug.includes('ad-') || slug.includes('copy')) return 'custom';
      if (slug.includes('crm')) return 'email';
      if (slug.includes('case-study') || slug.includes('crafter')) return 'blog';
      if (slug.includes('landing')) return 'custom';
      if (slug.includes('seo')) return 'blog';
      if (slug.includes('proposal')) return 'sow';
      return 'custom';
    };

    const enrichedGardners = gardnerWorkspaces.map((workspace: any, index: number) => {
      const dbEntry = gardnerMap.get(workspace.slug);
      
      return {
        id: dbEntry?.id || `anythingllm-${workspace.id}`,
        name: workspace.name,
        slug: workspace.slug,
        category: dbEntry?.category || getCategoryFromSlug(workspace.slug),
        systemPrompt: workspace.openAiPrompt,
        temperature: workspace.openAiTemp,
        chatHistory: workspace.openAiHistory,
        chatMode: workspace.chatMode,
        chatProvider: workspace.chatProvider,
        chatModel: workspace.chatModel,
        createdAt: workspace.createdAt || new Date().toISOString(),
        lastUpdated: workspace.lastUpdatedAt || workspace.createdAt,
      };
    });

    console.log(`✅ [Gardner List] Returning ${enrichedGardners.length} Gardners from AnythingLLM`);

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

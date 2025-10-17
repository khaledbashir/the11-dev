import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { anythingLLM } from '@/lib/anythingllm';
import { v4 as uuidv4 } from 'uuid';

/**
 * CREATE NEW GARDNER
 * Creates both a database entry AND an AnythingLLM workspace
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      category = 'custom',
      systemPrompt,
      model,
      temperature = 0.7,
      chatMode = 'chat',
      chatHistory = 20
    } = body;

    // Validation
    if (!name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Name and system prompt are required' },
        { status: 400 }
      );
    }

    // Generate unique ID and workspace slug
    const id = uuidv4();
    const workspaceSlug = `gardner-${name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 40)}-${id.substring(0, 8)}`;

    console.log(`🌱 Creating Gardner: ${name} (${workspaceSlug})`);

    // Step 1: Create AnythingLLM workspace
    const workspaceResponse = await fetch(
      `${process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host'}/api/v1/workspace/new`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Gardner: ${name}`,
        }),
      }
    );

    if (!workspaceResponse.ok) {
      const errorText = await workspaceResponse.text();
      throw new Error(`Failed to create AnythingLLM workspace: ${errorText}`);
    }

    const workspaceData = await workspaceResponse.json();
    const actualSlug = workspaceData.workspace.slug;

    console.log(`✅ AnythingLLM workspace created: ${actualSlug}`);

    // Step 2: Configure workspace (system prompt, model, settings)
    const configResponse = await fetch(
      `${process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host'}/api/v1/workspace/${actualSlug}/update`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openAiPrompt: systemPrompt,
          ...(model && { openAiModel: model }),
          ...(temperature !== undefined && { openAiTemp: temperature }),
          ...(chatMode && { chatMode }),
          ...(chatHistory && { chatHistory }),
        }),
      }
    );

    if (!configResponse.ok) {
      console.warn('⚠️ Workspace created but configuration failed');
    } else {
      console.log(`✅ Workspace configured with custom settings`);
    }

    // Step 3: Save to database
    const result = await db.query(
      `INSERT INTO gardners (id, workspace_slug, name, description, category, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, actualSlug, name, description || null, category]
    );

    console.log(`✅ Gardner saved to database: ${id}`);

    return NextResponse.json({
      success: true,
      gardner: {
        id,
        workspace_slug: actualSlug,
        name,
        description,
        category,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Error creating Gardner:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create Gardner', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * LIST ALL GARDNERS
 */
export async function GET() {
  try {
    const gardners = await db.query(
      `SELECT id, workspace_slug, name, description, category, created_at, updated_at 
       FROM gardners 
       ORDER BY created_at DESC`
    );

    return NextResponse.json({
      success: true,
      gardners,
    });
  } catch (error) {
    console.error('❌ Error listing Gardners:', error);
    return NextResponse.json(
      { error: 'Failed to list Gardners' },
      { status: 500 }
    );
  }
}

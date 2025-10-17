import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET SINGLE GARDNER
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const [gardner] = await db.query(
      `SELECT id, workspace_slug, name, description, category, created_at, updated_at 
       FROM gardners 
       WHERE id = ?`,
      [id]
    );

    if (!gardner) {
      return NextResponse.json(
        { error: 'Gardner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      gardner,
    });
  } catch (error) {
    console.error('❌ Error fetching Gardner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gardner' },
      { status: 500 }
    );
  }
}

/**
 * UPDATE GARDNER
 * Updates database AND AnythingLLM workspace configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { 
      name, 
      description, 
      category,
      systemPrompt,
      model,
      temperature,
      chatMode,
      chatHistory
    } = body;

    // Get existing Gardner to find workspace_slug
    const [existingGardner] = await db.query(
      `SELECT workspace_slug FROM gardners WHERE id = ?`,
      [id]
    );

    if (!existingGardner) {
      return NextResponse.json(
        { error: 'Gardner not found' },
        { status: 404 }
      );
    }

    const workspaceSlug = existingGardner.workspace_slug;

    // Update AnythingLLM workspace if prompt/model/settings changed
    if (systemPrompt || model || temperature !== undefined || chatMode || chatHistory) {
      const updatePayload: any = {};
      
      if (systemPrompt) updatePayload.openAiPrompt = systemPrompt;
      if (model) updatePayload.openAiModel = model;
      if (temperature !== undefined) updatePayload.openAiTemp = temperature;
      if (chatMode) updatePayload.chatMode = chatMode;
      if (chatHistory) updatePayload.chatHistory = chatHistory;
      if (name) updatePayload.name = `Gardner: ${name}`;

      const configResponse = await fetch(
        `${process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host'}/api/v1/workspace/${workspaceSlug}/update`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        }
      );

      if (!configResponse.ok) {
        console.warn('⚠️ Failed to update AnythingLLM workspace configuration');
      } else {
        console.log(`✅ Workspace configuration updated: ${workspaceSlug}`);
      }
    }

    // Update database
    const updates: string[] = [];
    const values: any[] = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (category) {
      updates.push('category = ?');
      values.push(category);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(id);

      await db.query(
        `UPDATE gardners SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      console.log(`✅ Gardner database record updated: ${id}`);
    }

    // Fetch updated Gardner
    const [updatedGardner] = await db.query(
      `SELECT id, workspace_slug, name, description, category, created_at, updated_at 
       FROM gardners 
       WHERE id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      gardner: updatedGardner,
    });
  } catch (error) {
    console.error('❌ Error updating Gardner:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update Gardner',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE GARDNER
 * Deletes from database AND AnythingLLM workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get workspace_slug before deleting
    const [gardner] = await db.query(
      `SELECT workspace_slug, name FROM gardners WHERE id = ?`,
      [id]
    );

    if (!gardner) {
      return NextResponse.json(
        { error: 'Gardner not found' },
        { status: 404 }
      );
    }

    const workspaceSlug = gardner.workspace_slug;

    console.log(`🗑️ Deleting Gardner: ${gardner.name} (${workspaceSlug})`);

    // Delete AnythingLLM workspace
    const deleteResponse = await fetch(
      `${process.env.ANYTHINGLLM_URL || 'https://ahmad-anything-llm.840tjq.easypanel.host'}/api/v1/workspace/${workspaceSlug}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.ANYTHINGLLM_API_KEY || '0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      console.warn('⚠️ Failed to delete AnythingLLM workspace, continuing with database deletion');
    } else {
      console.log(`✅ AnythingLLM workspace deleted: ${workspaceSlug}`);
    }

    // Delete from database
    await db.query(`DELETE FROM gardners WHERE id = ?`, [id]);

    console.log(`✅ Gardner deleted from database: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Gardner deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting Gardner:', error);
    return NextResponse.json(
      { error: 'Failed to delete Gardner' },
      { status: 500 }
    );
  }
}

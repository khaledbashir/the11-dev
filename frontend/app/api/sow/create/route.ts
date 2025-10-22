/**
 * API Route: Create new SOW
 * POST /api/sow/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, generateSOWId, formatDateForMySQL } from '@/lib/db';

export async function POST(req: NextRequest) {
  
  try {
    const body = await req.json();
    console.log(' [SOW CREATE] Incoming body keys:', Object.keys(body));

    // Accept both camelCase and snake_case payloads from various callers
    const title = body.title || body.title_text || body.name || null;
    const clientName = body.clientName || body.client_name || body.client || null;
    const clientEmail = body.clientEmail || body.client_email || null;
    const content = body.content || body.body || body.sowContent || null;
    const totalInvestment = body.totalInvestment ?? body.total_investment ?? 0;
    const folderId = body.folderId || body.folder_id || null;
    const creatorEmail = body.creatorEmail || body.creator_email || null;
    const workspaceSlug = body.workspaceSlug || body.workspace_slug || body.workspace || null;
    const embedId = body.embedId || body.embed_id || null;
    const threadSlug = body.threadSlug || body.thread_slug || null; // 🧵 AnythingLLM thread UUID

    // Validation - only title and content are strictly required for creating a draft SOW
    const missing: string[] = [];
    if (!title) missing.push('title');
    if (!content) missing.push('content');

    if (missing.length) {
      console.error(' [SOW CREATE] Validation failed - missing fields', { missing, receivedKeys: Object.keys(body) });
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}`, received: Object.keys(body) },
        { status: 400 }
      );
    }
    

    // Generate unique ID
  const sowId = generateSOWId();
    
    // Set expiration date (default: 30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Insert into database
    await query(
      `INSERT INTO sows (
        id, title, client_name, client_email, content, total_investment,
        status, workspace_slug, thread_slug, embed_id, folder_id, creator_email, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sowId,
        title,
        clientName,
        clientEmail || null,
        content,
        totalInvestment || 0,  // Default to 0 if not provided
        'draft',
        workspaceSlug || null,
        threadSlug || null, // 🧵 Store the AnythingLLM thread UUID
        embedId || null,
        folderId || null,
        creatorEmail || null,
        formatDateForMySQL(expiresAt),
      ]
    );

    
    // Log activity
    await query(
      `INSERT INTO sow_activities (sow_id, event_type, metadata) VALUES (?, ?, ?)`,
      [sowId, 'sow_created', JSON.stringify({ creatorEmail, folderId })]
    );

    return NextResponse.json({
      success: true,
      id: sowId, // Return 'id' for consistency with frontend expectations
      sowId, // Keep for backward compatibility
      message: 'SOW created successfully',
    });
  } catch (error) {
    console.error(' [SOW CREATE] FATAL ERROR:', error);
    console.error(' [SOW CREATE] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Failed to create SOW', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

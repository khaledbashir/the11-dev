/**
 * API Route: Create new SOW
 * POST /api/sow/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, generateSOWId, formatDateForMySQL } from '@/lib/db';

export async function POST(req: NextRequest) {
  
  try {
    const body = await req.json();
    
    const {
      title,
      clientName,
      clientEmail,
      content,
      totalInvestment,
      folderId,
      creatorEmail,
      workspaceSlug,
      embedId,
    } = body;

    // Validation - only title, clientName, and content are required
    if (!title || !clientName || !content) {
      console.error(' [SOW CREATE] Validation failed - missing fields', { title: !!title, clientName: !!clientName, content: !!content });
      return NextResponse.json(
        { error: 'Missing required fields: title, clientName, content' },
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
        status, workspace_slug, embed_id, folder_id, creator_email, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sowId,
        title,
        clientName,
        clientEmail || null,
        content,
        totalInvestment || 0,  // Default to 0 if not provided
        'draft',
        workspaceSlug || null,
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

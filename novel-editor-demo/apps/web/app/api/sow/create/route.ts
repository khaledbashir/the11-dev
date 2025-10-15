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

    // Validation
    if (!title || !clientName || !content || !totalInvestment) {
      return NextResponse.json(
        { error: 'Missing required fields: title, clientName, content, totalInvestment' },
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
        totalInvestment,
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
      sowId,
      message: 'SOW created successfully',
    });
  } catch (error) {
    console.error('Error creating SOW:', error);
    return NextResponse.json(
      { error: 'Failed to create SOW', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

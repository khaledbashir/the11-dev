/**
 * API Route: Create new SOW
 * POST /api/sow/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, generateSOWId, formatDateForMySQL } from '@/lib/db';

export async function POST(req: NextRequest) {
  console.log('\n🚀 [SOW CREATE] API endpoint called');
  
  try {
    console.log('📥 [SOW CREATE] Parsing request body...');
    const body = await req.json();
    console.log('✅ [SOW CREATE] Body parsed:', {
      title: body.title,
      clientName: body.clientName,
      hasContent: !!body.content,
      totalInvestment: body.totalInvestment,
    });
    
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
      console.error('❌ [SOW CREATE] Validation failed - missing fields');
      return NextResponse.json(
        { error: 'Missing required fields: title, clientName, content, totalInvestment' },
        { status: 400 }
      );
    }
    
    console.log('✅ [SOW CREATE] Validation passed');

    // Generate unique ID
    const sowId = generateSOWId();
    console.log('🆔 [SOW CREATE] Generated ID:', sowId);
    
    // Set expiration date (default: 30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    console.log('⏰ [SOW CREATE] Expires at:', expiresAt.toISOString());

    // Insert into database
    console.log('💾 [SOW CREATE] Inserting into database...');
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

    console.log('✅ [SOW CREATE] Database insert successful');
    
    // Log activity
    console.log('📝 [SOW CREATE] Logging activity...');
    await query(
      `INSERT INTO sow_activities (sow_id, event_type, metadata) VALUES (?, ?, ?)`,
      [sowId, 'sow_created', JSON.stringify({ creatorEmail, folderId })]
    );
    console.log('✅ [SOW CREATE] Activity logged');

    console.log('🎉 [SOW CREATE] Success! Returning response');
    return NextResponse.json({
      success: true,
      sowId,
      message: 'SOW created successfully',
    });
  } catch (error) {
    console.error('❌ [SOW CREATE] FATAL ERROR:', error);
    console.error('❌ [SOW CREATE] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Failed to create SOW', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

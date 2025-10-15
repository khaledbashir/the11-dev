/**
 * API Route: Send SOW to Client
 * POST /api/sow/[id]/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, formatDateForMySQL } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sowId = params.id;
    const body = await req.json();
    
    const { clientEmail, expiryDays = 30 } = body;

    // Fetch SOW to verify it exists
    const sow = await queryOne(
      `SELECT * FROM sows WHERE id = ?`,
      [sowId]
    );

    if (!sow) {
      return NextResponse.json(
        { error: 'SOW not found' },
        { status: 404 }
      );
    }

    // Update SOW status and timestamps
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await query(
      `UPDATE sows 
       SET status = 'sent', 
           sent_at = ?,
           expires_at = ?,
           client_email = ?
       WHERE id = ?`,
      [
        formatDateForMySQL(now),
        formatDateForMySQL(expiresAt),
        clientEmail || sow.client_email,
        sowId,
      ]
    );

    // Log activity
    await query(
      `INSERT INTO sow_activities (sow_id, event_type, metadata) VALUES (?, ?, ?)`,
      [
        sowId,
        'sow_sent',
        JSON.stringify({
          sentAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          clientEmail: clientEmail || sow.client_email,
          method: 'portal_link',
        }),
      ]
    );

    // Generate portal URL
    const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3333'}/portal/sow/${sowId}`;

    // TODO: Send email notification to client
    // This will be implemented in Phase 1 Part 6 (notification system)

    return NextResponse.json({
      success: true,
      portalUrl,
      expiresAt: expiresAt.toISOString(),
      message: 'SOW sent successfully',
    });
  } catch (error) {
    console.error('Error sending SOW:', error);
    return NextResponse.json(
      { error: 'Failed to send SOW', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

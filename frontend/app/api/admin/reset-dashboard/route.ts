import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Danger zone: wipe all SOW analytics/state so the dashboard reads zero
// Protection: require X-Admin-Key header to match process.env.ADMIN_API_KEY
export async function POST(req: NextRequest) {
  const adminKey = process.env.ADMIN_API_KEY;
  const provided = req.headers.get('x-admin-key') || '';

  if (!adminKey) {
    return NextResponse.json(
      { error: 'ADMIN_API_KEY not set on server' },
      { status: 403 }
    );
  }
  if (provided !== adminKey) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    // Delete in safe order (children first)
    const results: Record<string, number> = {};

    const tables = [
      'sow_activities',
      'sow_comments',
      'sow_acceptances',
      'sow_rejections',
      'ai_conversations',
      'sow_snapshots',
      'sows',
    ];

    for (const table of tables) {
      try {
        const r: any = await query<any>(`SELECT COUNT(*) as count FROM ${table}`);
        results[`${table}_before`] = Number(r?.[0]?.count || 0);
      } catch {}
    }

    await query('DELETE FROM sow_activities');
    await query('DELETE FROM sow_comments');
    await query('DELETE FROM sow_acceptances');
    await query('DELETE FROM sow_rejections');
    await query('DELETE FROM ai_conversations');
    await query('DELETE FROM sow_snapshots');
    await query('DELETE FROM sows');

    for (const table of tables) {
      try {
        const r: any = await query<any>(`SELECT COUNT(*) as count FROM ${table}`);
        results[`${table}_after`] = Number(r?.[0]?.count || 0);
      } catch {}
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

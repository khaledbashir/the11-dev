import { NextRequest, NextResponse } from 'next/server';
import { CanonicalSOWSchemaV41, normalizeSOW } from '@/lib/sow-schema';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

// Helper: persist into DB if table/column exist, else fallback to local file in /tmp
async function persistCanonicalJSON(sowId: string, json: any) {
  try {
    const pool = getPool();
    // Try to upsert into `sows` table if `canonical_json` column exists
    // We won't introspect schema; attempt and catch if it fails
    const sql = `UPDATE sows SET canonical_json = ? , updated_at = NOW() WHERE id = ?`;
    await pool.execute(sql, [JSON.stringify(json), sowId]);
    return { method: 'db' as const };
  } catch (e) {
    // Fallback to filesystem
    const outDir = '/tmp/canonical-sow';
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `${sowId}.json`);
    await fs.writeFile(outPath, JSON.stringify(json, null, 2), 'utf-8');
    return { method: 'file' as const, path: outPath };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sowId = (body?.sowId as string) || uuidv4();
    const payload = body?.data ?? body; // allow either {sowId, data} or pure JSON

    // Validate
    const parsed = CanonicalSOWSchemaV41.parse(payload);

    // Normalize (fill rates/costs where possible; compute totals)
    // Rate lookup can be plugged in here later via import from rateCard.ts
    const normalized = normalizeSOW(parsed);

    // Persist
    const persisted = await persistCanonicalJSON(sowId, normalized);

    return NextResponse.json({
      success: true,
      sowId,
      storage: persisted,
      canonical: normalized,
    });
  } catch (error: any) {
    const message = error?.issues ? JSON.stringify(error.issues) : error?.message || 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

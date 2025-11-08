import { NextRequest, NextResponse } from 'next/server';
import { CanonicalSOWSchemaV41, normalizeSOW } from '@/lib/sow-schema';
import { getRateForRole } from '@/lib/rateCard';
import { getPool } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

// Backend PDF service URL (env first, fallback localhost for dev)
const PDF_BACKEND_URL = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://localhost:8000';

async function loadCanonicalFromDB(sowId: string) {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT canonical_json FROM sows WHERE id = ? LIMIT 1', [sowId]);
    const anyRows = rows as any[];
    if (anyRows.length && anyRows[0].canonical_json) {
      return JSON.parse(anyRows[0].canonical_json);
    }
    return null;
  } catch (e) {
    return null; // fallback path will handle
  }
}

async function loadCanonicalFromFile(sowId: string) {
  try {
    const filePath = path.join('/tmp/canonical-sow', `${sowId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function toBackendPayload(normalized: any) {
  // Map canonical structure to ProfessionalPDFRequest expected by backend
  return {
    company: { name: 'Social Garden' }, // placeholder; can be extended later
    clientName: normalized.clientName,
    projectTitle: normalized.projectTitle,
    projectSubtitle: normalized.projectSubtitle || '',
    projectOverview: normalized.projectOverview || '',
    budgetNotes: normalized.budgetNotes || '',
    scopes: normalized.scopes.map((s: any, idx: number) => ({
      id: s.id ?? idx,
      title: s.title,
      description: s.description,
      deliverables: s.deliverables || [],
      assumptions: s.assumptions || [],
      items: s.role_allocation.map((r: any) => ({
        description: r.role, // backend model currently uses 'description' in SOWItem
        role: r.role,
        hours: r.hours,
        cost: r.cost,
      })),
    })),
    currency: normalized.currency || 'AUD',
    gstApplicable: normalized.gstApplicable,
    generatedDate: normalized.generatedDate,
    discount: normalized.discount || 0,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sowId = body.sowId as string;
    if (!sowId) {
      return NextResponse.json({ success: false, error: 'sowId is required' }, { status: 400 });
    }

    console.log('📄 [PRO PDF] Starting professional export for sowId:', sowId);

    // 1. Load canonical JSON (DB first, then file fallback)
    let canonical = await loadCanonicalFromDB(sowId);
    if (!canonical) {
      console.log('⚠️ [PRO PDF] Not in DB, trying file fallback');
      canonical = await loadCanonicalFromFile(sowId);
    }
    if (!canonical) {
      return NextResponse.json({ success: false, error: 'Canonical JSON not found for sowId' }, { status: 404 });
    }

    // 2. Validate canonical JSON strictly
    const parsed = CanonicalSOWSchemaV41.parse(canonical);

    // 3. Normalize with rate lookup
    const normalized = normalizeSOW(parsed, getRateForRole);
    console.log('✅ [PRO PDF] Normalized financials:', normalized.financials);

    // 4. Transform to backend payload
    const backendPayload = toBackendPayload(normalized);

    // 5. Forward to backend `/generate-professional-pdf`
    const resp = await fetch(`${PDF_BACKEND_URL}/generate-professional-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('❌ [PRO PDF] Backend error:', errText);
      return NextResponse.json({ success: false, error: errText }, { status: resp.status });
    }

    // 6. Stream PDF back to client
    const arrayBuf = await resp.arrayBuffer();
    const filename = `${backendPayload.projectTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    return new NextResponse(new Uint8Array(arrayBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('❌ [PRO PDF] Proxy failure:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown error' }, { status: 500 });
  }
}

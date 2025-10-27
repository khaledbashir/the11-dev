/**
 * API Route: Export SOW to Excel (client-facing workbook)
 * GET /api/sow/[id]/export-excel
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';
import { queryOne } from '@/lib/db';
import { validatePricing, type ScopeBlock } from '@/lib/pricing-validation';

type TipTapNode = {
  type?: string;
  attrs?: any;
  content?: TipTapNode[];
  text?: string;
};

type ScopeRole = { role: string; hours: number; rate: number; total: number };
type ParsedScope = {
  title: string;
  overview: string;
  roles: ScopeRole[];
  deliverables: string[];
  assumptions: string[];
};

function textFromNode(node: TipTapNode): string {
  if (!node) return '';
  if (node.type === 'text' && node.text) return node.text;
  const children = Array.isArray(node.content) ? node.content : [];
  return children.map(textFromNode).join('');
}

function flattenParagraphText(node: TipTapNode): string {
  if (!node) return '';
  if (node.type === 'paragraph') return textFromNode(node).trim();
  return '';
}

function extractListItems(node: TipTapNode): string[] {
  const items: string[] = [];
  if (!node || !Array.isArray(node.content)) return items;
  // bulletList|orderedList -> listItem -> paragraph -> text
  for (const li of node.content) {
    if (li?.type === 'listItem' && Array.isArray(li.content)) {
      const para = li.content.find((c) => c.type === 'paragraph');
      const t = para ? textFromNode(para).trim() : '';
      if (t) items.push(t);
    }
  }
  return items;
}

function parseScopesFromTipTap(doc: any): ParsedScope[] {
  const nodes: TipTapNode[] = Array.isArray(doc?.content) ? doc.content : [];
  const scopes: ParsedScope[] = [];

  let current: ParsedScope | null = null;
  let pendingListType: 'deliverables' | 'assumptions' | null = null;

  const pushCurrent = () => {
    if (current) {
      // Trim and finalize
      current.overview = current.overview.trim();
      scopes.push(current);
      current = null;
      pendingListType = null;
    }
  };

  for (const node of nodes) {
    // Start of a new scope: heading level 2 or 3 is considered a major section
    if (node.type === 'heading' && (node as any).attrs?.level && (node as any).attrs.level <= 3) {
      const title = textFromNode(node).trim();
      if (title) {
        pushCurrent();
        current = { title, overview: '', roles: [], deliverables: [], assumptions: [] };
        pendingListType = null;
        continue;
      }
    }

    if (!current) {
      // Ignore content before the first major heading
      continue;
    }

    // Detect section labels that precede lists
    if (node.type === 'paragraph') {
      const ptext = flattenParagraphText(node);
      if (/^\s*deliverables\s*:*/i.test(ptext)) {
        pendingListType = 'deliverables';
        continue;
      }
      if (/^\s*assumptions\s*:*/i.test(ptext)) {
        pendingListType = 'assumptions';
        continue;
      }
      // Otherwise accumulate into overview until a pricing table appears
      if (ptext) {
        current.overview += (current.overview ? '\n\n' : '') + ptext;
      }
    }

    // Capture custom pricing table if present
    if (node.type === 'editablePricingTable' && node.attrs?.rows) {
      const rows = Array.isArray(node.attrs.rows) ? node.attrs.rows : [];
      for (const r of rows) {
        const role = String(r?.role || '').trim();
        const hours = Number(r?.hours) || 0;
        const rate = Number(r?.rate) || 0;
        if (!role || hours <= 0 || rate <= 0) continue;
        current.roles.push({ role, hours, rate, total: hours * rate });
      }
      continue;
    }

    // Capture generic tables if they look like Role/Hours/Rate rows
    if (node.type === 'table' && Array.isArray(node.content)) {
      const dataRows = node.content.slice(1); // skip header
      for (const row of dataRows) {
        const cells = Array.isArray(row?.content) ? row.content : [];
        const role = textFromNode(cells[0] || ({} as any)).trim();
        const hours = parseFloat((textFromNode(cells[1] || ({} as any)) || '0').replace(/[^\d.]/g, '')) || 0;
        const rate = parseFloat((textFromNode(cells[2] || ({} as any)) || '0').replace(/[^\d.]/g, '')) || 0;
        if (!role || hours <= 0 || rate <= 0) continue;
        current.roles.push({ role, hours, rate, total: hours * rate });
      }
      continue;
    }

    // Lists -> deliverables or assumptions depending on latest label
    if ((node.type === 'bulletList' || node.type === 'orderedList') && Array.isArray(node.content)) {
      const items = extractListItems(node);
      if (items.length) {
        if (pendingListType === 'assumptions') current.assumptions.push(...items);
        else current.deliverables.push(...items);
      }
      continue;
    }
  }

  pushCurrent();
  return scopes;
}

// XLSX (SheetJS) community edition does not support rich styling; we focus on data, formulas, and merges.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Fetch SOW by id
    const sow = await queryOne(
      `SELECT id, title, client_name as clientName, content FROM sows WHERE id = ?`,
      [id]
    );
    if (!sow) {
      return NextResponse.json({ error: 'SOW not found' }, { status: 404 });
    }

    // Parse TipTap JSON content
    let content: any = null;
    try {
      content = typeof sow.content === 'string' ? JSON.parse(sow.content) : sow.content;
    } catch {
      content = null;
    }
    if (!content) {
      return NextResponse.json({ error: 'Invalid SOW content' }, { status: 400 });
    }

    const scopes = parseScopesFromTipTap(content);
    if (!scopes.length) {
      // Provide an empty but valid workbook rather than erroring
      // to keep UX consistent; the sheet will explain missing structure.
    }

    // Policy validation before export (block hard errors, surface warnings)
    try {
      const shaped: ScopeBlock[] = scopes.map((s) => ({
        title: s.title,
        roles: (s.roles || []).map((r) => ({ role: r.role, hours: r.hours, rate: r.rate })),
      }));
      const result = validatePricing(shaped);
      const hardErrors = result.violations.filter((v) => v.severity !== 'warning');
      if (hardErrors.length) {
        return NextResponse.json(
          {
            error: 'Pricing validation failed',
            violations: result.violations,
            message:
              'Your SOW is missing mandatory roles or contains invalid pricing rows. Please address the issues and try exporting again.',
          },
          { status: 400 }
        );
      }
      // Non-blocking warnings will be carried in logs; continue export
      if (result.violations.some((v) => v.severity === 'warning')) {
        console.warn('[Export Excel] Pricing validation warnings:', result.violations);
      }
    } catch (e) {
      console.warn('[Export Excel] Validation step failed, proceeding without blocking:', e);
    }

    // Build workbook with XLSX
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData: any[][] = [];
    summaryData[0] = [sow.title || 'Scope of Work Summary', '', '', '', ''];
    summaryData[2] = ['Scope', 'Total Hours', 'Subtotal (ex. GST)', 'GST (10%)', 'Total (inc. GST)'];
    let r = 3;
    scopes.forEach((s) => {
      const totalHours = s.roles.reduce((acc, x) => acc + x.hours, 0);
      const subtotal = s.roles.reduce((acc, x) => acc + x.total, 0);
      const gst = subtotal * 0.1;
      const inc = subtotal + gst;
      summaryData[r++] = [s.title, totalHours, subtotal, gst, inc];
    });
    // Totals row
    if (r > 3) {
      summaryData[r] = [
        'TOTALS',
        { f: `SUM(B4:B${r})` },
        { f: `SUM(C4:C${r})` },
        { f: `SUM(D4:D${r})` },
        { f: `SUM(E4:E${r})` },
      ];
    }
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    // Merge title A1:E1
    summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    // Set column widths
    summaryWs['!cols'] = [
      { wch: 40 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'SOW_Summary');

    // Scope sheets
    scopes.forEach((s, i) => {
      const data: any[][] = [];
      data[0] = [s.title, '', '', ''];
      data[2] = ['Role', 'Hours', 'Rate (AUD)', 'Total (AUD)'];
      let row = 3;
      s.roles.forEach((rr) => {
        data[row++] = [rr.role, rr.hours, rr.rate, rr.total];
      });
      // Totals row
      data[row] = ['TOTAL', { f: `SUM(B4:B${row})` }, '', { f: `SUM(D4:D${row})` }];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      ws['!cols'] = [ { wch: 42 }, { wch: 14 }, { wch: 16 }, { wch: 18 } ];
      XLSX.utils.book_append_sheet(wb, ws, `Scope${i + 1}`);
    });

    // Pricing_Editable sheet
    const pData: any[][] = [];
    pData[0] = ['Scope', 'Role', 'Hours', 'Hourly Rate (AUD)', 'Cost (AUD)', '', 'Parameters', 'Value'];
    pData[1] = ['', '', '', '', '', '', 'Discount %', 0];
    pData[2] = ['', '', '', '', '', '', 'Round to Nearest', 5000];
    let prow = 3;
    scopes.forEach((s) => {
      s.roles.forEach((rItem) => {
        pData[prow] = [
          s.title,
          rItem.role,
          rItem.hours,
          rItem.rate,
          { f: `C${prow + 1}*D${prow + 1}` },
          '',
          '',
          '',
        ];
        prow++;
      });
    });
    // Totals block to the right (starting at row 6 in col G/H)
    let tr = 5;
    pData[tr - 1] = pData[tr - 1] || new Array(8).fill('');
    pData[tr - 1][6] = 'Subtotal (ex. GST)';
    pData[tr - 1][7] = { f: `SUM(E3:E${prow})` };
    tr++;
    pData[tr - 1] = pData[tr - 1] || new Array(8).fill('');
    pData[tr - 1][6] = 'Discount Amount';
    pData[tr - 1][7] = { f: `H${tr - 1}*(H2/100)` };
    tr++;
    pData[tr - 1] = pData[tr - 1] || new Array(8).fill('');
    pData[tr - 1][6] = 'Grand Total (ex. GST)';
    pData[tr - 1][7] = { f: `H${tr - 2}-H${tr - 1}` };
    tr++;
    pData[tr - 1] = pData[tr - 1] || new Array(8).fill('');
    pData[tr - 1][6] = 'GST (10%)';
    pData[tr - 1][7] = { f: `H${tr - 1}*0.10` };
    tr++;
    pData[tr - 1] = pData[tr - 1] || new Array(8).fill('');
    pData[tr - 1][6] = 'Total (inc. GST)';
    pData[tr - 1][7] = { f: `H${tr - 1}+H${tr - 2}` };
    tr++;
    pData[tr - 1] = pData[tr - 1] || new Array(8).fill('');
    pData[tr - 1][6] = 'Rounded Total (inc. GST)';
    pData[tr - 1][7] = { f: `ROUND(H${tr - 1}/H3,0)*H3` };
    const pWs = XLSX.utils.aoa_to_sheet(pData);
    pWs['!cols'] = [
      { wch: 36 }, { wch: 36 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 2 }, { wch: 18 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, pWs, 'Pricing_Editable');

    // Serialize workbook
    const wbout = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${(sow.clientName || 'Client').toString().replace(/[^a-z0-9]/gi, '_')}_Statement_of_Work.xlsx`;

    return new NextResponse(wbout as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Export Excel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export Excel', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

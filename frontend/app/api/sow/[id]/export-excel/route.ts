/**
 * API Route: Export SOW to Excel (client-facing workbook)
 * GET /api/sow/[id]/export-excel
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import path from 'path';
import { queryOne } from '@/lib/db';

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

function applyHeaderStyle(cell: ExcelJS.Cell, green = 'FF4CAF50') {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } } as any;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } } as any;
  cell.alignment = { vertical: 'middle', horizontal: 'center' } as any;
}

function applyTableBorders(ws: ExcelJS.Worksheet, startRow: number, endRow: number, startCol: number, endCol: number) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      } as any;
    }
  }
}

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

    // Build workbook (attempt to load branded template if available)
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Social Garden';
    wb.created = new Date();

    try {
      const templatePath = path.join(process.cwd(), 'public', 'templates', 'Social_Garden_SOW_Template.xlsx');
      const templateBuf = await fs.readFile(templatePath);
      const arrayBuf = templateBuf.buffer.slice(
        templateBuf.byteOffset,
        templateBuf.byteOffset + templateBuf.byteLength
      );
      await wb.xlsx.load(arrayBuf as ArrayBuffer);
    } catch (e) {
      // If template not found or cannot be loaded, continue with a blank workbook
      // eslint-disable-next-line no-console
      console.warn('[Export Excel] Template not found or failed to load. Using blank workbook.', e?.toString?.() || e);
    }

    // Summary Sheet
    const summary = wb.addWorksheet('SOW_Summary');
    summary.columns = [
      { width: 40 },
      { width: 16 },
      { width: 22 },
      { width: 14 },
      { width: 22 },
    ];

    summary.getCell('A1').value = sow.title || 'Scope of Work Summary';
    applyHeaderStyle(summary.getCell('A1'));
    summary.mergeCells('A1:E1');

    const headerRowIdx = 3;
    summary.getRow(headerRowIdx).values = ['Scope', 'Total Hours', 'Subtotal (ex. GST)', 'GST (10%)', 'Total (inc. GST)'];
    for (let c = 1; c <= 5; c++) applyHeaderStyle(summary.getRow(headerRowIdx).getCell(c));

    let r = headerRowIdx + 1;
    scopes.forEach((s) => {
      const totalHours = s.roles.reduce((acc, x) => acc + x.hours, 0);
      const subtotal = s.roles.reduce((acc, x) => acc + x.total, 0);
      const gst = subtotal * 0.1;
      const inc = subtotal + gst;
      summary.getCell(r, 1).value = s.title;
      summary.getCell(r, 2).value = totalHours;
      summary.getCell(r, 3).value = subtotal;
      summary.getCell(r, 4).value = gst;
      summary.getCell(r, 5).value = inc;
      summary.getCell(r, 3).numFmt = '$#,##0.00';
      summary.getCell(r, 4).numFmt = '$#,##0.00';
      summary.getCell(r, 5).numFmt = '$#,##0.00';
      summary.getCell(r, 2).alignment = { horizontal: 'right' } as any;
      summary.getCell(r, 3).alignment = { horizontal: 'right' } as any;
      summary.getCell(r, 4).alignment = { horizontal: 'right' } as any;
      summary.getCell(r, 5).alignment = { horizontal: 'right' } as any;
      r++;
    });

    if (r > headerRowIdx + 1) {
      const totalsRow = summary.getRow(r);
      totalsRow.getCell(1).value = 'TOTALS';
      totalsRow.getCell(1).font = { bold: true } as any;
      totalsRow.getCell(2).value = { formula: `SUM(B${headerRowIdx + 1}:B${r - 1})` } as any;
      totalsRow.getCell(3).value = { formula: `SUM(C${headerRowIdx + 1}:C${r - 1})` } as any;
      totalsRow.getCell(4).value = { formula: `SUM(D${headerRowIdx + 1}:D${r - 1})` } as any;
      totalsRow.getCell(5).value = { formula: `SUM(E${headerRowIdx + 1}:E${r - 1})` } as any;
      totalsRow.getCell(3).numFmt = '$#,##0.00';
      totalsRow.getCell(4).numFmt = '$#,##0.00';
      totalsRow.getCell(5).numFmt = '$#,##0.00';
      totalsRow.commit();
      applyTableBorders(summary, headerRowIdx, r, 1, 5);
    }

    // Scope sheets
    scopes.forEach((s, i) => {
      const ws = wb.addWorksheet(`Scope${i + 1}`);
      ws.columns = [
        { width: 42 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
      ];

      ws.getCell('A1').value = s.title;
      applyHeaderStyle(ws.getCell('A1'));
      ws.mergeCells('A1:D1');

      if (s.overview) {
        ws.getCell('A3').value = s.overview;
        ws.getCell('A3').alignment = { wrapText: true } as any;
        ws.mergeCells('A3:D3');
      }

      let row = 5;
      ws.getRow(row).values = ['Role', 'Hours', 'Rate (AUD)', 'Total (AUD)'];
      for (let c = 1; c <= 4; c++) applyHeaderStyle(ws.getRow(row).getCell(c));
      row++;

      s.roles.forEach((rr) => {
        ws.getCell(row, 1).value = rr.role;
        ws.getCell(row, 2).value = rr.hours;
        ws.getCell(row, 3).value = rr.rate;
        ws.getCell(row, 4).value = rr.total;
        ws.getCell(row, 3).numFmt = '$#,##0.00';
        ws.getCell(row, 4).numFmt = '$#,##0.00';
        ws.getCell(row, 2).alignment = { horizontal: 'right' } as any;
        ws.getCell(row, 3).alignment = { horizontal: 'right' } as any;
        ws.getCell(row, 4).alignment = { horizontal: 'right' } as any;
        row++;
      });

      // Totals row
      ws.getCell(row, 1).value = 'TOTAL';
      ws.getCell(row, 2).value = { formula: `SUM(B6:B${row - 1})` } as any;
      ws.getCell(row, 4).value = { formula: `SUM(D6:D${row - 1})` } as any;
      ws.getCell(row, 4).numFmt = '$#,##0.00';
      ws.getCell(row, 1).font = { bold: true } as any;
      applyTableBorders(ws, 5, row, 1, 4);
      row += 2;

      if (s.deliverables.length) {
        ws.getCell(row++, 1).value = 'Deliverables:';
        s.deliverables.forEach((d) => {
          ws.getCell(row++, 1).value = `• ${d}`;
        });
        row++;
      }
      if (s.assumptions.length) {
        ws.getCell(row++, 1).value = 'Assumptions:';
        s.assumptions.forEach((a) => {
          ws.getCell(row++, 1).value = `• ${a}`;
        });
      }
    });

    // Remove any non client-facing sheets (keep only SOW_Summary and ScopeN)
    const allowedNames = new Set<string>(['SOW_Summary', ...scopes.map((_, i) => `Scope${i + 1}`)]);
    // Make a copy of current worksheet names to iterate safely
    const existingNames = wb.worksheets.map((w) => w.name);
    for (const name of existingNames) {
      if (!allowedNames.has(name)) {
        const ws = wb.getWorksheet(name);
        if (ws) wb.removeWorksheet(ws.id as any);
      }
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const filename = `${(sow.clientName || 'Client').toString().replace(/[^a-z0-9]/gi, '_')}_Statement_of_Work.xlsx`;

    return new NextResponse(arrayBuffer as unknown as BodyInit, {
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

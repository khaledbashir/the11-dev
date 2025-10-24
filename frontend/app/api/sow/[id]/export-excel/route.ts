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

function extractGlobalDiscount(doc: any): number {
  try {
    const nodes: TipTapNode[] = Array.isArray(doc?.content) ? doc.content : [];
    for (const node of nodes) {
      if (node?.type === 'editablePricingTable' && typeof node?.attrs?.discount === 'number') {
        const pct = Number(node.attrs.discount) || 0;
        if (pct >= 0 && pct <= 100) return pct;
      }
      if (Array.isArray(node?.content)) {
        const nestedDoc = { content: node.content } as any;
        const nested = extractGlobalDiscount(nestedDoc);
        if (typeof nested === 'number' && nested >= 0) return nested;
      }
    }
  } catch {}
  return 0;
}

function findOverviewHeaderRow(ws: ExcelJS.Worksheet): { row: number; col: number } | null {
  const expected = new Set([
    'PROJECT DATES', 'TOTAL HOURS', 'AVG. HOURLY RATE', 'DISCOUNT', 'MONTH COST', 'DISCOUNT COST', 'TOTAL COST',
  ]);
  const maxRows = Math.min(ws.rowCount || 50, 50);
  const maxCols = Math.min(ws.columnCount || 12, 12);
  for (let r = 1; r <= maxRows; r++) {
    const values: string[] = [];
    for (let c = 1; c <= maxCols; c++) {
      const v = ws.getCell(r, c).value;
      const s = (typeof v === 'string' ? v : (v as any)?.toString?.() || '').trim().toUpperCase();
      values.push(s);
    }
    const match = Array.from(expected).filter(h => values.includes(h)).length;
    if (match >= 4) {
      // Find the column of 'PROJECT DATES' (usually B)
      const col = Math.max(1, values.indexOf('PROJECT DATES'));
      return { row: r, col };
    }
  }
  return null;
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
  const discountPct = extractGlobalDiscount(content);
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

  // Summary Sheet (reuse if exists in template)
  const summary = wb.getWorksheet('SOW_Summary') || wb.addWorksheet('SOW_Summary');
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
      const name = `Scope${i + 1}`;
      const ws = wb.getWorksheet(name) || wb.addWorksheet(name);
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

    // Fill Scope & Pricing Overview if present (align with template layout)
    const overviewWs = wb.getWorksheet('Scope & Pricing Overview');
    if (overviewWs) {
      const anchor = findOverviewHeaderRow(overviewWs);
      const headerRow = anchor?.row ?? 5;
      const startRow = headerRow + 1;
      // Columns by observation: A (scope name), B Project Dates, C Total Hours, D Avg Rate, E Discount, F Month Cost, G Discount Cost, H Total Cost
      let writeRow = startRow;
      // Optional cleanup of a small block beneath header
      for (let r = 0; r < 20; r++) {
        const row = overviewWs.getRow(startRow + r);
        // Clear only the data columns we intend to write (A, C, D, E, G, H)
        [1, 3, 4, 5, 7, 8].forEach((c) => (row.getCell(c).value = null));
      }

      scopes.forEach((s) => {
        const totalHours = s.roles.reduce((acc, x) => acc + x.hours, 0);
        const subtotal = s.roles.reduce((acc, x) => acc + x.total, 0);
        // A: Scope Title
        overviewWs.getCell(writeRow, 1).value = s.title;
        // C: Total Hours
        overviewWs.getCell(writeRow, 3).value = totalHours;
        // H: Total Cost (ex. GST) — keep as pre-discount so Avg Rate remains stable
        overviewWs.getCell(writeRow, 8).value = subtotal;
        overviewWs.getCell(writeRow, 8).numFmt = '$#,##0.00';
        // D: Avg Hourly Rate = H/C
        overviewWs.getCell(writeRow, 4).value = { formula: `H${writeRow}/C${writeRow}` } as any;
        // E: Discount % (from editor global discount)
        overviewWs.getCell(writeRow, 5).value = discountPct;
        // G: Discount Cost = H * (E%)
        overviewWs.getCell(writeRow, 7).value = { formula: `H${writeRow}*(E${writeRow}/100)` } as any;
        overviewWs.getCell(writeRow, 7).numFmt = '$#,##0.00';
        // Align numeric columns
        [3, 4, 7, 8].forEach((c) => (overviewWs.getCell(writeRow, c).alignment = { horizontal: 'right' } as any));
        writeRow++;
      });
    }

    // Pricing_Editable sheet (flat, finance-friendly, easy to modify)
    const pricingWsName = 'Pricing_Editable';
    const pricing = wb.getWorksheet(pricingWsName) || wb.addWorksheet(pricingWsName);
    pricing.columns = [
      { width: 36 }, // Scope
      { width: 36 }, // Role
      { width: 12 }, // Hours
      { width: 16 }, // Hourly Rate (AUD)
      { width: 16 }, // Cost (AUD)
      { width: 2 },  // Spacer
      { width: 18 }, // Label/Param Key
      { width: 14 }, // Param Value
    ];
    // Headers
    pricing.getRow(1).values = ['Scope', 'Role', 'Hours', 'Hourly Rate (AUD)', 'Cost (AUD)', '', 'Parameters', 'Value'];
    for (let c = 1; c <= 5; c++) {
      const cell = pricing.getCell(1, c);
      cell.font = { bold: true } as any;
      cell.alignment = { horizontal: 'center' } as any;
    }
    pricing.getCell(1, 7).font = { bold: true } as any;

    // Parameter defaults (editable by AMs)
    pricing.getCell(2, 7).value = 'Discount %';
    pricing.getCell(2, 8).value = 0; // default 0%
    pricing.getCell(3, 7).value = 'Round to Nearest';
    pricing.getCell(3, 8).value = 5000; // default 5000

    // Populate rows
    let prow = 2;
    scopes.forEach((s) => {
      s.roles.forEach((rItem) => {
        pricing.getCell(prow, 1).value = s.title;
        pricing.getCell(prow, 2).value = rItem.role;
        pricing.getCell(prow, 3).value = rItem.hours;
        pricing.getCell(prow, 4).value = rItem.rate;
        pricing.getCell(prow, 5).value = { formula: `C${prow}*D${prow}` } as any;
        pricing.getCell(prow, 4).numFmt = '$#,##0.00';
        pricing.getCell(prow, 5).numFmt = '$#,##0.00';
        pricing.getCell(prow, 3).alignment = { horizontal: 'right' } as any;
        pricing.getCell(prow, 4).alignment = { horizontal: 'right' } as any;
        pricing.getCell(prow, 5).alignment = { horizontal: 'right' } as any;
        prow++;
      });
    });

    const firstDataRow = 2;
    const lastDataRow = Math.max(firstDataRow, prow - 1);

    // Totals block (to the right, under parameters)
    let tr = 6;
    pricing.getCell(tr, 7).value = 'Subtotal (ex. GST)';
    pricing.getCell(tr, 8).value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` } as any;
    pricing.getCell(tr, 8).numFmt = '$#,##0.00';
    tr++;
    pricing.getCell(tr, 7).value = 'Discount Amount';
    pricing.getCell(tr, 8).value = { formula: `H${tr - 1} * (H2/100)` } as any; // Subtotal * (Discount%/100)
    pricing.getCell(tr, 8).numFmt = '$#,##0.00';
    tr++;
    pricing.getCell(tr, 7).value = 'Grand Total (ex. GST)';
    pricing.getCell(tr, 8).value = { formula: `H${tr - 2} - H${tr - 1}` } as any;
    pricing.getCell(tr, 8).numFmt = '$#,##0.00';
    tr++;
    pricing.getCell(tr, 7).value = 'GST (10%)';
    pricing.getCell(tr, 8).value = { formula: `H${tr - 1}*0.10` } as any;
    pricing.getCell(tr, 8).numFmt = '$#,##0.00';
    tr++;
    pricing.getCell(tr, 7).value = 'Total (inc. GST)';
    pricing.getCell(tr, 8).value = { formula: `H${tr - 1}+H${tr - 2}` } as any; // GST + Grand Total ex GST
    pricing.getCell(tr, 8).numFmt = '$#,##0.00';
    tr++;
    pricing.getCell(tr, 7).value = 'Rounded Total (inc. GST)';
    // =ROUND(TotalIncGST / RoundTo, 0) * RoundTo
    pricing.getCell(tr, 8).value = { formula: `ROUND(H${tr - 1}/H3,0)*H3` } as any;
    pricing.getCell(tr, 8).numFmt = '$#,##0.00';

    // Thin borders for header row
    for (let c = 1; c <= 5; c++) {
      const cell = pricing.getCell(1, c);
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
      } as any;
    }
    // Optional borders for data area
    for (let r = firstDataRow; r <= lastDataRow; r++) {
      for (let c = 1; c <= 5; c++) {
        const cell = pricing.getCell(r, c);
        cell.border = { left: { style: 'thin' }, right: { style: 'thin' } } as any;
      }
    }

    // Attempt to populate existing "Scope & Pricing Overview" sheet in template if present
    const overviewSheet = wb.getWorksheet('Scope & Pricing Overview');
    if (overviewSheet) {
      try {
        // Find header row by scanning for known column headers
        const expectedHeaders = new Set([
          'PROJECT DATES', 'TOTAL HOURS', 'AVG. HOURLY RATE', 'DISCOUNT', 'MONTH COST', 'DISCOUNT COST', 'TOTAL COST'
        ]);
        const maxRowsToScan = Math.min(50, overviewSheet.rowCount + 5);
        let headerRow = -1;
        let headerMap: Record<string, number> = {};
        for (let rr = 1; rr <= maxRowsToScan && headerRow === -1; rr++) {
          const row = overviewSheet.getRow(rr);
          const values = row.values as any[];
          const upper = values.map(v => typeof v === 'string' ? v.trim().toUpperCase() : String(v ?? '').trim().toUpperCase());
          const matchCount = Array.from(expectedHeaders).filter(h => upper.includes(h)).length;
          if (matchCount >= 3) {
            headerRow = rr;
            // Build a header map for this row
            upper.forEach((val, idx) => {
              if (expectedHeaders.has(val)) headerMap[val] = idx;
            });
          }
        }

        if (headerRow !== -1) {
          // Write one row per scope beneath the header
          scopes.forEach((s, i) => {
            const rowIdx = headerRow + 1 + i;
            const totalHours = s.roles.reduce((acc, x) => acc + x.hours, 0);
            const subtotal = s.roles.reduce((acc, x) => acc + x.total, 0);
            const avgRate = totalHours > 0 ? subtotal / totalHours : 0;
            // Optional defaults
            const projectDates = 'TBC';
            const discountPct = 0;
            const discountCost = 0;
            const monthCost = subtotal; // For one-off scopes, treat as subtotal
            const totalCost = subtotal; // Keep ex. GST as default to avoid double-taxing

            // If there's a first descriptive column before headers, write title in first col
            // We will place title in column A regardless, it won't hurt
            overviewSheet.getCell(rowIdx, 1).value = s.title;
            if (headerMap['PROJECT DATES']) overviewSheet.getCell(rowIdx, headerMap['PROJECT DATES']).value = projectDates;
            if (headerMap['TOTAL HOURS']) overviewSheet.getCell(rowIdx, headerMap['TOTAL HOURS']).value = totalHours;
            if (headerMap['AVG. HOURLY RATE']) {
              overviewSheet.getCell(rowIdx, headerMap['AVG. HOURLY RATE']).value = avgRate;
              overviewSheet.getCell(rowIdx, headerMap['AVG. HOURLY RATE']).numFmt = '$#,##0.00';
            }
            if (headerMap['DISCOUNT']) overviewSheet.getCell(rowIdx, headerMap['DISCOUNT']).value = discountPct;
            if (headerMap['MONTH COST']) {
              overviewSheet.getCell(rowIdx, headerMap['MONTH COST']).value = monthCost;
              overviewSheet.getCell(rowIdx, headerMap['MONTH COST']).numFmt = '$#,##0.00';
            }
            if (headerMap['DISCOUNT COST']) {
              overviewSheet.getCell(rowIdx, headerMap['DISCOUNT COST']).value = discountCost;
              overviewSheet.getCell(rowIdx, headerMap['DISCOUNT COST']).numFmt = '$#,##0.00';
            }
            if (headerMap['TOTAL COST']) {
              overviewSheet.getCell(rowIdx, headerMap['TOTAL COST']).value = totalCost;
              overviewSheet.getCell(rowIdx, headerMap['TOTAL COST']).numFmt = '$#,##0.00';
            }
          });
        }
      } catch (e) {
        // Non-blocking: if unable to write into the overview sheet, proceed with other sheets
        console.warn('[Export Excel] Could not populate Scope & Pricing Overview:', e);
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

// Export utilities for SOW documents
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { ROLES } from '@/lib/rateCard';

export interface PricingRow {
  role: string;
  hours: number;
  rate: number;
  total: number;
}

export interface SOWData {
  title: string;
  client?: string;
  overview?: string;
  deliverables?: string[];
  pricingRows: PricingRow[];
  discount?: { type: 'percentage' | 'fixed'; value: number };
  showGST?: boolean;
  assumptions?: string[];
  timeline?: string;
}

// Architect JSON shapes (for Excel engine v2)
export interface ScopeRole {
  role: string;
  hours: number;
}

export interface ScopeItem {
  name: string;
  overview?: string;
  roles: ScopeRole[];
  deliverables?: string[];
  assumptions?: string[];
}

export interface ArchitectSOW {
  title: string;
  overview?: string;
  outcomes?: string[];
  assumptions?: string[];
  scopeItems: ScopeItem[];
}

/**
 * Extract pricing data from Novel editor content
 * Supports both TipTap tables AND markdown text format
 */
export function extractPricingFromContent(content: any): PricingRow[] {
  const rows: PricingRow[] = [];
  
  if (!content || !content.content) return rows;

  // First, try to extract from TipTap tables (including editablePricingTable)
  const findTables = (nodes: any[]): void => {
    nodes.forEach((node: any) => {
      // Handle editablePricingTable custom node
      if (node.type === 'editablePricingTable' && node.attrs?.rows) {
        const rows_data = node.attrs.rows;
        if (Array.isArray(rows_data)) {
          rows_data.forEach((row: any) => {
            const hours = Number(row.hours) || 0;
            const rate = Number(row.rate) || 0;
            const total = hours * rate; // Always recalculate total
            const role = String(row.role || '').trim();
            
            // Skip header/total rows and invalid data
            if (role && !role.toLowerCase().includes('total') && 
                !role.toLowerCase().includes('role') &&
                hours > 0 && rate > 0) {
              rows.push({ role, hours, rate, total: isNaN(total) ? 0 : total });
            }
          });
        }
      }
      
      // Handle standard table nodes
      if (node.type === 'table' && node.content) {
        // Skip header row, process data rows
        const dataRows = node.content.slice(1);
        
        dataRows.forEach((row: any) => {
          if (row.type === 'tableRow' && row.content && row.content.length >= 4) {
            const cells = row.content;
            const role = cells[0]?.content?.[0]?.content?.[0]?.text || '';
            const hoursText = cells[1]?.content?.[0]?.content?.[0]?.text || '0';
            const hours = parseFloat(hoursText) || 0;
            const rateText = cells[2]?.content?.[0]?.content?.[0]?.text || '';
            const rate = parseFloat(rateText.replace(/[$,\s]/g, '')) || 0;
            
            // Calculate total from hours × rate (more reliable than parsing)
            const total = hours * rate;
            
            // Skip header/total rows and invalid data
            if (role && !role.toLowerCase().includes('total') && 
                !role.toLowerCase().includes('role') &&
                hours > 0 && rate > 0) {
              rows.push({ role, hours, rate, total: isNaN(total) ? 0 : total });
            }
          }
        });
      }
      
      if (node.content) {
        findTables(node.content);
      }
    });
  };

  findTables(content.content);
  
  // If no tables found, try to parse from markdown text (fallback for AI-generated content)
  if (rows.length === 0) {
    const extractText = (nodes: any[]): string => {
      let text = '';
      nodes.forEach((node: any) => {
        if (node.type === 'text' && node.text) {
          text += node.text + '\n';
        }
        if (node.content) {
          text += extractText(node.content);
        }
      });
      return text;
    };
    
    const fullText = extractText(content.content);
    
    // Match pricing lines in format: "| Role | Hours | $Rate | $Total |"
    // Also match: "- **Role**: Hours × $Rate = $Total"
    // Also match: "Role: Hours hours × $Rate/hour = $Total"
    const pricingPatterns = [
      /\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*(?:hours?)?\s*\|\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/hour)?\s*\|\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
      /[-*]\s*\*\*([^*:]+)\*\*:?\s*(\d+(?:\.\d+)?)\s*(?:hours?)?\s*[×x]\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/hour)?\s*=\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
      /([^:\n]+):\s*(\d+(?:\.\d+)?)\s*hours?\s*[×x]\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/hour)?\s*=\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    ];
    
    pricingPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        const role = match[1].trim();
        const hours = parseFloat(match[2]);
        const rate = parseFloat(match[3]);
        const total = parseFloat(match[4].replace(/,/g, ''));
        
        // Skip header rows and invalid data
        if (role && !role.toLowerCase().includes('role') && 
            !role.toLowerCase().includes('total') &&
            hours > 0 && rate > 0) {
          rows.push({ role, hours, rate, total });
        }
      }
    });
  }
  
  return rows;
}

/**
 * Extract pricing data from HTML by stripping tags and applying the same text regexes
 */
export function extractPricingFromHTML(html: string): PricingRow[] {
  if (!html) return [];
  const text = html.replace(/<[^>]*>/g, ' ');
  const rows: PricingRow[] = [];

    const pricingPatterns = [
    /\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*(?:hours?)?\s*\|\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/hour)?\s*\|\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    /[-*]\s*\*\*([^*:]+)\*\*:?:?\s*(\d+(?:\.\d+)?)\s*(?:hours?)?\s*[×x]\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/hour)?\s*=\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    /([^:\n]+):\s*(\d+(?:\.\d+)?)\s*hours?\s*[×x]\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/hour)?\s*=\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
      /([^:\n]+?)\s*[—–-]\s*(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:at|@)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/h(?:our)?)?\s*=\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    /([^:\n]+?)\s*[—–-]\s*(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:at|@)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:\/h(?:our)?)?\s*=\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
  ];

  pricingPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const role = match[1].trim();
      const hours = parseFloat(match[2]);
      const rate = parseFloat(match[3]);
      const total = parseFloat(match[4].replace(/,/g, ''));
      if (
        role &&
        !role.toLowerCase().includes('role') &&
        !role.toLowerCase().includes('total') &&
        hours > 0 &&
        rate > 0
      ) {
        rows.push({ role, hours, rate, total });
      }
    }
  });

  return rows;
}

/**
 * Calculate totals with optional discount
 */
export function calculateTotals(rows: PricingRow[], discount?: { type: 'percentage' | 'fixed'; value: number }) {
  const subtotal = rows.reduce((sum, row) => sum + row.total, 0);
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
  
  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = subtotal * (discount.value / 100);
    } else {
      discountAmount = discount.value;
    }
  }
  
  const grandTotal = subtotal - discountAmount;
  
  return {
    subtotal,
    totalHours,
    discountAmount,
    grandTotal,
    gstAmount: grandTotal * 0.1, // 10% GST
  };
}

/**
 * Export pricing table to CSV
 */
export function exportToCSV(sowData: SOWData, filename: string = 'sow-pricing.csv') {
  const { pricingRows, discount } = sowData;
  const totals = calculateTotals(pricingRows, discount);
  
  // Create data array for CSV
  const data: any[] = [
    ['Social Garden - Scope of Work Pricing'],
    [''],
    ['Role', 'Hours', 'Rate (AUD)', 'Total (AUD)'],
  ];
  
  pricingRows.forEach(row => {
    data.push([
      row.role,
      row.hours,
      `$${row.rate}`,
      `$${row.total.toFixed(2)} +GST`
    ]);
  });
  
  data.push(['']);
  data.push(['Total Hours', totals.totalHours, '', '']);
  data.push(['Sub-Total', '', '', `$${totals.subtotal.toFixed(2)} +GST`]);
  
  if (discount && totals.discountAmount > 0) {
    const discountLabel = discount.type === 'percentage' 
      ? `Discount (${discount.value}%)` 
      : 'Discount';
    data.push([discountLabel, '', '', `-$${totals.discountAmount.toFixed(2)}`]);
  }
  
  data.push(['Grand Total', '', '', `$${totals.grandTotal.toFixed(2)} +GST`]);
  data.push(['GST (10%)', '', '', `$${totals.gstAmount.toFixed(2)}`]);
  data.push(['Total Inc. GST', '', '', `$${(totals.grandTotal + totals.gstAmount).toFixed(2)}`]);
  
  // Convert to CSV string
  const csvContent = data.map(row => row.join(',')).join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/**
 * Export pricing table to Excel using Social Garden template format
 */
export async function exportToExcel(
  sowData: SOWData | ArchitectSOW,
  filename?: string
) {
  // If Architect JSON shape is provided (scopeItems), use the modular engine
  if ((sowData as ArchitectSOW)?.scopeItems) {
    return exportArchitectExcel(sowData as ArchitectSOW, filename);
  }

  // Fallback to legacy pricing-table export using the static template
  const { pricingRows, discount, title, client, deliverables, assumptions } = sowData as SOWData;
  const totals = calculateTotals(pricingRows, discount);

  // Load the Excel template from public folder, with robust fallback if not found (404)
  let workbook = new ExcelJS.Workbook();
  let overviewSheet: ExcelJS.Worksheet | undefined;
  let pricingSheet: ExcelJS.Worksheet | undefined;

  try {
    const templatePath = encodeURI('/templates/Social_Garden_SOW_Template.xlsx');
    const res = await fetch(templatePath);
    if (!res.ok) throw new Error(`Template fetch failed with status ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);

    // Try to access well-known sheets, with graceful fallbacks
    overviewSheet = workbook.getWorksheet('Overview') || workbook.getWorksheet(1);
    pricingSheet =
      workbook.getWorksheet('Pricing') ||
      workbook.getWorksheet('Pricing Breakdown') ||
      workbook.getWorksheet(2) ||
      workbook.worksheets[workbook.worksheets.length - 1];
  } catch (e) {
    console.warn('[Excel Export] Template not available, generating workbook from scratch. Reason:', e);
    workbook = new ExcelJS.Workbook();
    overviewSheet = workbook.addWorksheet('Overview');
    pricingSheet = workbook.addWorksheet('Pricing');
  }

  // Populate overview data (best-effort due to unknown template positions)
  if (overviewSheet) {
    try {
      // Common placements
      // A1: Title, A3: Client, A5: Date, A7: Grand Total
      overviewSheet.getCell('A1').value = title || '[PROJECT NAME]';
      overviewSheet.getCell('A3').value = 'Client Name';
      overviewSheet.getCell('B3').value = client || '';
      overviewSheet.getCell('A5').value = 'Created Date';
      overviewSheet.getCell('B5').value = new Date().toLocaleDateString('en-AU');
      overviewSheet.getCell('A7').value = 'Grand Total (ex. GST)';
      overviewSheet.getCell('B7').value = totals.subtotal;
    } catch (e) {
      console.warn('Overview sheet population warning:', e);
    }
  }

  // Find header row in pricing sheet by scanning for expected headers
  const findHeaderRow = (): number => {
    const headers = ['ITEMS', 'ROLE', 'HOURS', 'HOURLY RATE', 'TOTAL COST'];
    for (let r = 1; r <= Math.min(50, pricingSheet!.rowCount + 5); r++) {
      const vals: any = pricingSheet!.getRow(r).values as any;
      const arr: any[] = Array.isArray(vals) ? vals : (vals == null ? [] : [vals]);
      const rowValues = arr.map((v: any) =>
        typeof v === 'string' ? v.trim().toUpperCase() : String(v ?? '').trim().toUpperCase()
      );
      const matchCount = headers.filter(h => rowValues.includes(h)).length;
      if (matchCount >= 3) return r; // heuristic
    }
    return 2; // default header row
  };

  // If no headers exist (scratch workbook), write headers now
  if (!pricingSheet!.rowCount || pricingSheet!.rowCount < 1) {
    pricingSheet!.getRow(1).values = ['Items', 'Role', 'Hours', 'Hourly Rate', 'Total Cost'];
  }

  const headerRowIdx = findHeaderRow();
  let writeRow = headerRowIdx + 1;

  // Clear any existing data rows under header (basic cleanup up to 1000 rows)
  for (let r = writeRow; r <= writeRow + 1000; r++) {
    const vals: any = pricingSheet!.getRow(writeRow).values as any;
    const arr: any[] = Array.isArray(vals) ? vals : (vals == null ? [] : [vals]);
    const hasAny = arr.some((v: any) => v != null && v !== '');
    if (!hasAny) break;
    pricingSheet!.spliceRows(writeRow, 1);
  }

  // Write pricing rows
  for (const row of pricingRows) {
    const excelRow = pricingSheet!.getRow(writeRow++);
    // Assume columns: A: ITEMS, B: ROLE, C: HOURS, D: HOURLY RATE, E: TOTAL COST +GST
    excelRow.getCell(1).value = '';
    excelRow.getCell(2).value = row.role;
    excelRow.getCell(3).value = row.hours;
    excelRow.getCell(4).value = row.rate;
    excelRow.getCell(5).value = row.total;
    excelRow.commit();
  }

  // Totals row
  const totalsRow = pricingSheet!.getRow(writeRow++);
  totalsRow.getCell(1).value = 'TOTAL';
  totalsRow.getCell(2).value = totals.totalHours; // total hours
  totalsRow.getCell(3).value = Math.round((totals.subtotal / Math.max(1, totals.totalHours)) * 100) / 100; // avg rate
  totalsRow.getCell(5).value = totals.subtotal; // subtotal (ex. GST)
  totalsRow.commit();

  // Optional sections: deliverables and assumptions (append beneath)
  if (deliverables && deliverables.length > 0) {
    writeRow += 1;
    pricingSheet!.getCell(`A${writeRow++}`).value = 'Deliverables:';
    for (const d of deliverables) {
      pricingSheet!.getCell(`A${writeRow++}`).value = `• ${d}`;
    }
  }
  if (assumptions && assumptions.length > 0) {
    writeRow += 1;
    pricingSheet!.getCell(`A${writeRow++}`).value = 'Assumptions:';
    for (const a of assumptions) {
      pricingSheet!.getCell(`A${writeRow++}`).value = `• ${a}`;
    }
  }

  // Prepare filename
  const safeClient = (client || '').replace(/[^a-z0-9]/gi, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const outName = filename || (safeClient ? `${safeClient}-SOW-${dateStr}.xlsx` : `SOW-${dateStr}.xlsx`);

  // Download
  const outBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = outName;
  link.click();
}

// Excel Engine v2: Build multi-sheet workbook from Architect JSON
async function exportArchitectExcel(data: ArchitectSOW, filename?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Social Garden SOW Engine';
  workbook.created = new Date();

  // Helper to create safe sheet names
  const sheetName = (base: string) => base.replace(/[^A-Za-z0-9_]/g, '').slice(0, 28);

  // Create sheets in order: Pricing, Scope1..N, SOW_Summary
  const pricingSheet = workbook.addWorksheet('Pricing');

  const scopeSheets = data.scopeItems.map((s, i) => {
    const name = `Scope${i + 1}`;
    return {
      meta: s,
      sheet: workbook.addWorksheet(sheetName(name)),
      name,
    };
  });

  const summarySheet = workbook.addWorksheet('SOW_Summary');

  // Build Scope sheets with VLOOKUP to Pricing
  for (const { meta, sheet } of scopeSheets) {
    // Headers
    sheet.getCell('A1').value = meta.name;
    if (meta.overview) sheet.getCell('A2').value = meta.overview;
    let rowIdx = 4;
    sheet.getRow(rowIdx).values = ['Role', 'Hours', 'Rate (AUD)', 'Total (AUD)'];
    sheet.getRow(rowIdx).font = { bold: true };
    rowIdx++;

    for (const r of meta.roles) {
      const row = sheet.getRow(rowIdx);
      row.getCell(1).value = r.role;
      row.getCell(2).value = r.hours;
      // VLOOKUP to Pricing sheet for rate
      const rateCell = sheet.getCell(rowIdx, 3);
      rateCell.value = {
        formula: `IFERROR(VLOOKUP(A${rowIdx}, Pricing!$A:$B, 2, FALSE), 0)`,
      } as any;
      // Total = Hours * Rate
      sheet.getCell(rowIdx, 4).value = { formula: `B${rowIdx}*C${rowIdx}` } as any;
      rowIdx++;
    }

    // Totals row
    const totalRow = sheet.getRow(rowIdx);
    totalRow.getCell(1).value = 'TOTAL';
    totalRow.getCell(2).value = { formula: `SUM(B5:B${rowIdx - 1})` } as any;
    totalRow.getCell(4).value = { formula: `SUM(D5:D${rowIdx - 1})` } as any;
    totalRow.font = { bold: true };

    // Optional: deliverables and assumptions
    let write = rowIdx + 2;
    if (meta.deliverables && meta.deliverables.length) {
      sheet.getCell(`A${write++}`).value = 'Deliverables:';
      for (const d of meta.deliverables) sheet.getCell(`A${write++}`).value = `• ${d}`;
    }
    if (meta.assumptions && meta.assumptions.length) {
      write += 1;
      sheet.getCell(`A${write++}`).value = 'Assumptions:';
      for (const a of meta.assumptions) sheet.getCell(`A${write++}`).value = `• ${a}`;
    }

    // Column widths
    sheet.columns = [
      { width: 40 },
      { width: 12 },
      { width: 14 },
      { width: 16 },
    ];
  }

  // Build Pricing sheet with Master Rate Card and SUMIF aggregation
  // Combine master roles with any extra roles found in scopes
  const masterRoleMap = new Map<string, number>();
  ROLES.forEach(r => masterRoleMap.set(r.name, Number(r.rate) || 0));
  const extraRoles = Array.from(new Set(
    data.scopeItems.flatMap(s => s.roles.map(r => r.role.trim()))
  )).filter(name => !masterRoleMap.has(name));
  extraRoles.forEach(name => masterRoleMap.set(name, 0));

  const pricingRoles = Array.from(masterRoleMap.keys());

  pricingSheet.getRow(1).values = ['Role', 'Hourly Rate (AUD)', 'Total Hours', 'Cost (AUD)'];
  pricingSheet.getRow(1).font = { bold: true };

  let rIdx = 2;
  for (const role of pricingRoles) {
    pricingSheet.getCell(rIdx, 1).value = role;
    // Pre-populate with master rate (0 if not found in rate card)
    pricingSheet.getCell(rIdx, 2).value = masterRoleMap.get(role) ?? 0;

    // SUMIF across each Scope sheet for hours
    const sumifParts = scopeSheets.map(({ name }) => `SUMIF(${name}!$A:$A, Pricing!A${rIdx}, ${name}!$B:$B)`);
    pricingSheet.getCell(rIdx, 3).value = { formula: `SUM(${sumifParts.join(',')})` } as any;
    // Cost = Hours * Rate
    pricingSheet.getCell(rIdx, 4).value = { formula: `C${rIdx}*B${rIdx}` } as any;
    rIdx++;
  }

  // Pricing totals
  pricingSheet.getCell(rIdx, 1).value = 'TOTALS';
  pricingSheet.getCell(rIdx, 1).font = { bold: true };
  pricingSheet.getCell(rIdx, 3).value = { formula: `SUM(C2:C${rIdx - 1})` } as any;
  pricingSheet.getCell(rIdx, 4).value = { formula: `SUM(D2:D${rIdx - 1})` } as any;
  pricingSheet.columns = [
    { width: 40 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
  ];

  // Build SOW Summary sheet
  summarySheet.getCell('A1').value = data.title || 'Scope of Work Summary';
  summarySheet.getCell('A1').font = { bold: true, size: 14 };
  if (data.overview) {
    summarySheet.getCell('A2').value = data.overview;
  }

  let sRow = 4;
  summarySheet.getRow(sRow).values = ['Scope', 'Total Hours', 'Subtotal (ex. GST)', 'GST (10%)', 'Total (inc. GST)'];
  summarySheet.getRow(sRow).font = { bold: true };
  sRow++;

  scopeSheets.forEach(({ name, meta }, idx) => {
    const sheet = workbook.getWorksheet(name)!;
    // Find total row: we set totals at last data row + 1. Data starts at row 5 and ends at 5 + roles.length - 1
    const totalRowIndex = 5 + (meta.roles?.length || 0);
    summarySheet.getCell(sRow, 1).value = meta.name;
    // Hours = Scope sheet SUM column B (already totals in B total row)
    summarySheet.getCell(sRow, 2).value = { formula: `${name}!B${totalRowIndex}` } as any;
    // Subtotal = Scope sheet total cost cell (column D total row)
    summarySheet.getCell(sRow, 3).value = { formula: `${name}!D${totalRowIndex}` } as any;
    // GST and Inc GST
    summarySheet.getCell(sRow, 4).value = { formula: `C${sRow}*0.1` } as any;
    summarySheet.getCell(sRow, 5).value = { formula: `C${sRow}+D${sRow}` } as any;
    sRow++;
  });

  // Summary totals
  summarySheet.getCell(sRow, 1).value = 'TOTALS';
  summarySheet.getCell(sRow, 1).font = { bold: true };
  summarySheet.getCell(sRow, 2).value = { formula: `SUM(B5:B${sRow - 1})` } as any;
  summarySheet.getCell(sRow, 3).value = { formula: `SUM(C5:C${sRow - 1})` } as any;
  summarySheet.getCell(sRow, 4).value = { formula: `SUM(D5:D${sRow - 1})` } as any;
  summarySheet.getCell(sRow, 5).value = { formula: `SUM(E5:E${sRow - 1})` } as any;

  // Outcomes and assumptions
  let textRow = sRow + 2;
  if (data.outcomes?.length) {
    summarySheet.getCell(`A${textRow++}`).value = 'Desired Outcomes:';
    for (const o of data.outcomes) summarySheet.getCell(`A${textRow++}`).value = `• ${o}`;
  }
  if (data.assumptions?.length) {
    textRow += 1;
    summarySheet.getCell(`A${textRow++}`).value = 'Global Assumptions:';
    for (const a of data.assumptions) summarySheet.getCell(`A${textRow++}`).value = `• ${a}`;
  }

  summarySheet.columns = [
    { width: 40 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
  ];

  // --- Final workbook sanitization ---
  // Only keep SOW_Summary and Scope sheets visible. Hide Pricing and any other helper sheets.
  workbook.worksheets.forEach((ws) => {
    const name = ws.name || '';
    const isScope = /^Scope\d+$/i.test(name);
    const isSummary = name === 'SOW_Summary';
    if (!isScope && !isSummary) {
      ws.state = 'hidden';
    }
  });

  // Filename and download
  const dateStr = new Date().toISOString().split('T')[0];
  const outName = filename || `SOW-${dateStr}.xlsx`;
  const outBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = outName;
  link.click();
}

/**
 * Generate PDF from HTML content
 */
export async function exportToPDF(
  element: HTMLElement,
  filename: string = 'sow-document.pdf',
  options?: {
    showLogo?: boolean;
    logoUrl?: string;
    title?: string;
  }
) {
  try {
    // Create canvas from HTML element
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    // Calculate dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;
    const width = pdfWidth - 20; // 10mm margins
    const height = width / ratio;
    
    // Add logo if provided
    if (options?.showLogo && options?.logoUrl) {
      try {
        pdf.addImage(options.logoUrl, 'PNG', 10, 10, 40, 15);
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }
    
    // Add title if provided
    if (options?.title) {
      pdf.setFontSize(16);
      pdf.setTextColor(44, 130, 61); // Social Garden green
      pdf.text(options.title, 10, options?.showLogo ? 35 : 20);
    }
    
    // Add content
    const yOffset = options?.title ? (options?.showLogo ? 45 : 30) : (options?.showLogo ? 30 : 10);
    let remainingHeight = height;
    let yPosition = yOffset;
    
    // Add pages as needed
    while (remainingHeight > 0) {
      pdf.addImage(
        imgData,
        'PNG',
        10,
        yPosition,
        width,
        Math.min(remainingHeight, pdfHeight - yPosition - 10)
      );
      
      remainingHeight -= (pdfHeight - yPosition - 10);
      
      if (remainingHeight > 0) {
        pdf.addPage();
        yPosition = 10;
      }
    }
    
    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, showGST: boolean = true): string {
  const formatted = `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return showGST ? `${formatted} +GST` : formatted;
}

/**
 * Parse markdown SOW content and extract structured data
 */
export function parseSOWMarkdown(markdown: string): Partial<SOWData> {
  const lines = markdown.split('\n');
  const data: Partial<SOWData> = {
    pricingRows: [],
    deliverables: [],
    assumptions: [],
  };
  
  // Extract title (first H1)
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    data.title = titleMatch[1];
  }
  
  // Extract client name
  const clientMatch = markdown.match(/\*\*Client:\*\*\s+(.+)$/m);
  if (clientMatch) {
    data.client = clientMatch[1];
  }
  
  // Extract overview
  const overviewMatch = markdown.match(/##\s+Overview\s+(.+?)(?=##|$)/s);
  if (overviewMatch) {
    data.overview = overviewMatch[1].trim();
  }
  
  // Extract deliverables
  const deliverablesMatch = markdown.match(/##\s+What does the scope include\?\s+(.+?)(?=##|$)/s);
  if (deliverablesMatch) {
    const deliverableLines = deliverablesMatch[1].trim().split('\n');
    data.deliverables = deliverableLines
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('+'))
      .map(line => line.replace(/^[•\-+]\s*/, '').trim());
  }
  
  // Extract discount info
  const discountMatch = markdown.match(/Discount\s+\((\d+)%\):\s*-?\$?([\d,]+\.?\d*)/i);
  if (discountMatch) {
    data.discount = {
      type: 'percentage',
      value: parseFloat(discountMatch[1]),
    };
  }
  
  return data;
}

/**
 * Clean SOW content by removing non-client-facing elements
 */
import { PLACEHOLDER_SANITIZATION_ENABLED, PLACEHOLDER_BRANDS } from './policy';

export function cleanSOWContent(content: string): string {
  // Remove any internal comments, thinking tags, tool calls, etc.
  let out = content
    // Remove <AI_THINK> tags
    .replace(/<AI_THINK>[\s\S]*?<\/AI_THINK>/gi, '')
    // Remove <thinking> tags (additional variant)
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // Remove <think> tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    // Remove any orphaned think tags
    .replace(/<\/?think>/gi, '')
    // Remove <tool_call> tags
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    // Remove HTML comments
    .replace(/<!-- .*? -->/gi, '')
    // Remove any remaining XML-style tags that might be internal
    .replace(/<\/?[A-Z_]+>/gi, '')
    // 🚨 CRITICAL: Remove internal PART headers (non-client-facing structure markers)
    .replace(/^##\s*PART\s*\d+:\s*REASONING\s+SUMMARY[\s\S]*?(?=^##\s*PART\s*\d+:|^#{1,6}\s+[^#]|\*\*PROJECT)/mi, '')
    .replace(/^##\s*PART\s*\d+:\s*THE\s+FINAL\s+SCOPE\s+OF\s+WORK\s*$/mi, '')
    // Remove any standalone "## PART 1:" or "## PART 2:" headers
    .replace(/^##\s*PART\s*\d+:.*$/gmi, '')
    .trim();

  // Optional: sanitize placeholder client brands in narrative when no explicit client is set
  if (PLACEHOLDER_SANITIZATION_ENABLED) {
    // Heuristic: replace common placeholders with 'Client' (case-insensitive), only when standalone words
    for (const p of PLACEHOLDER_BRANDS) {
      const pattern = new RegExp(`\\b${p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      out = out.replace(pattern, 'Client');
    }
  }

  return out;
}

/**
 * Extract the modular Architect SOW JSON from an AI response.
 * Looks for a ```json ... ``` code block containing a shape with scopeItems[].
 * Returns a normalized ArchitectSOW or null if not found/invalid.
 */
export function extractSOWStructuredJson(text: string): ArchitectSOW | null {
  if (!text) return null;

  // Prefer fenced JSON blocks first
  const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;

  const tryParse = (raw: string): ArchitectSOW | null => {
    try {
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.scopeItems)) return null;

      // Normalize minimal fields
      const title = typeof obj.title === 'string' && obj.title.trim().length > 0
        ? obj.title.trim()
        : 'Statement of Work';
      const overview = typeof obj.overview === 'string' ? obj.overview : undefined;
      const outcomes = Array.isArray(obj.outcomes) ? obj.outcomes.filter(Boolean) : undefined;
      const assumptions = Array.isArray(obj.assumptions) ? obj.assumptions.filter(Boolean) : undefined;

      const scopeItems: ScopeItem[] = obj.scopeItems.map((s: any) => {
        const name = typeof s?.name === 'string' && s.name
          ? s.name
          : (typeof s?.phaseName === 'string' && s.phaseName ? s.phaseName : 'Scope Item');
        const rolesArr: ScopeRole[] = Array.isArray(s?.roles)
          ? s.roles
              .map((r: any) => ({
                role: String(r?.role || '').trim(),
                hours: Number(r?.hours) || 0,
              }))
              .filter((r: ScopeRole) => r.role && r.hours >= 0)
          : [];
        const deliverables = Array.isArray(s?.deliverables) ? s.deliverables.filter(Boolean) : undefined;
        const sAssumptions = Array.isArray(s?.assumptions) ? s.assumptions.filter(Boolean) : undefined;
        const overview = typeof s?.overview === 'string' && s.overview
          ? s.overview
          : (typeof s?.description === 'string' ? s.description : undefined);
        return {
          name,
          overview,
          roles: rolesArr,
          deliverables,
          assumptions: sAssumptions,
        } as ScopeItem;
      });

      if (!scopeItems.length) return null;

      return {
        title,
        overview,
        outcomes,
        assumptions,
        scopeItems,
      } as ArchitectSOW;
    } catch (e) {
      return null;
    }
  };

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const raw = match[1];
    const parsed = tryParse(raw);
    if (parsed) return parsed;
  }

  // Fallback: try to locate a JSON object in the text containing "scopeItems"
  const scopeIdx = text.indexOf('scopeItems');
  if (scopeIdx !== -1) {
    // Heuristic: take the largest {...} block that contains scopeItems
    const firstBrace = text.lastIndexOf('{', scopeIdx);
    const lastBrace = text.indexOf('}', scopeIdx);
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      const parsed = tryParse(candidate);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Convert TipTap JSON content to HTML
 * Used for embedding SOWs into AnythingLLM workspaces
 */
export function tiptapToHTML(content: any): string {
  if (!content || !content.content) return '';
  
  const processNode = (node: any): string => {
    if (!node) return '';
    
    let html = '';
    
    switch (node.type) {
      case 'paragraph':
        html += '<p>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</p>';
        break;
        
      case 'heading':
        const level = node.attrs?.level || 1;
        html += `<h${level}>`;
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += `</h${level}>`;
        break;
        
      case 'bulletList':
        html += '<ul>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</ul>';
        break;
        
      case 'orderedList':
        html += '<ol>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</ol>';
        break;
        
      case 'listItem':
        html += '<li>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</li>';
        break;
        
      case 'text':
        let text = node.text || '';
        if (node.marks) {
          for (const mark of node.marks) {
            if (mark.type === 'bold') text = `<strong>${text}</strong>`;
            if (mark.type === 'italic') text = `<em>${text}</em>`;
            if (mark.type === 'code') text = `<code>${text}</code>`;
          }
        }
        html += text;
        break;
        
      case 'hardBreak':
        html += '<br>';
        break;
        
      case 'horizontalRule':
        html += '<hr>';
        break;
        
      case 'codeBlock':
        html += '<pre><code>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</code></pre>';
        break;
        
      case 'table':
        html += '<table>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</table>';
        break;
        
      case 'tableRow':
        html += '<tr>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</tr>';
        break;
        
      case 'tableCell':
        html += '<td>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</td>';
        break;
        
      case 'tableHeader':
        html += '<th>';
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
        html += '</th>';
        break;
        
      case 'editablePricingTable':
        // Custom pricing table - convert to HTML table
        html += '<div class="pricing-table"><p><em>[Pricing Table]</em></p></div>';
        break;
        
      default:
        // Unknown node type - try to process content anyway
        if (node.content) {
          html += node.content.map(processNode).join('');
        }
    }
    
    return html;
  };
  
  return content.content.map(processNode).join('');
}

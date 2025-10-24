// Export utilities for SOW documents
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';

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
export async function exportToExcel(sowData: SOWData, filename?: string) {
  const { pricingRows, discount, title, client, deliverables, assumptions } = sowData;
  const totals = calculateTotals(pricingRows, discount);

  // Load the Excel template from public folder
  const res = await fetch('/templates/Social_Garden_SOW_Template.xlsx');
  if (!res.ok) throw new Error('Failed to load Excel template');
  const arrayBuffer = await res.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Try to access well-known sheets, with graceful fallbacks
  const overviewSheet =
    workbook.getWorksheet('Overview') || workbook.getWorksheet(1);
  const pricingSheet =
    workbook.getWorksheet('Pricing') ||
    workbook.getWorksheet('Pricing Breakdown') ||
    workbook.getWorksheet(2) ||
    workbook.worksheets[workbook.worksheets.length - 1];

  // Populate overview data (best-effort due to unknown template positions)
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

  // Find header row in pricing sheet by scanning for expected headers
  const findHeaderRow = (): number => {
    const headers = ['ITEMS', 'ROLE', 'HOURS', 'HOURLY RATE', 'TOTAL COST'];
    for (let r = 1; r <= Math.min(50, pricingSheet.rowCount + 5); r++) {
      const rowValues = pricingSheet.getRow(r).values
        .map((v: any) => (typeof v === 'string' ? v.trim().toUpperCase() : String(v || '').trim().toUpperCase()));
      const matchCount = headers.filter(h => rowValues.includes(h)).length;
      if (matchCount >= 3) return r; // heuristic
    }
    return 2; // default header row
  };

  const headerRowIdx = findHeaderRow();
  let writeRow = headerRowIdx + 1;

  // Clear any existing data rows under header (basic cleanup up to 1000 rows)
  for (let r = writeRow; r <= writeRow + 1000; r++) {
    const row = pricingSheet.getRow(r);
    if (!row || row.every((c: any) => !c || c.value == null)) break;
    pricingSheet.spliceRows(writeRow, 1);
  }

  // Write pricing rows
  for (const row of pricingRows) {
    const excelRow = pricingSheet.getRow(writeRow++);
    // Assume columns: A: ITEMS, B: ROLE, C: HOURS, D: HOURLY RATE, E: TOTAL COST +GST
    excelRow.getCell(1).value = '';
    excelRow.getCell(2).value = row.role;
    excelRow.getCell(3).value = row.hours;
    excelRow.getCell(4).value = row.rate;
    excelRow.getCell(5).value = row.total;
    excelRow.commit();
  }

  // Totals row
  const totalsRow = pricingSheet.getRow(writeRow++);
  totalsRow.getCell(1).value = 'TOTAL';
  totalsRow.getCell(2).value = totals.totalHours; // total hours
  totalsRow.getCell(3).value = Math.round((totals.subtotal / Math.max(1, totals.totalHours)) * 100) / 100; // avg rate
  totalsRow.getCell(5).value = totals.subtotal; // subtotal (ex. GST)
  totalsRow.commit();

  // Optional sections: deliverables and assumptions (append beneath)
  if (deliverables && deliverables.length > 0) {
    writeRow += 1;
    pricingSheet.getCell(`A${writeRow++}`).value = 'Deliverables:';
    for (const d of deliverables) {
      pricingSheet.getCell(`A${writeRow++}`).value = `• ${d}`;
    }
  }
  if (assumptions && assumptions.length > 0) {
    writeRow += 1;
    pricingSheet.getCell(`A${writeRow++}`).value = 'Assumptions:';
    for (const a of assumptions) {
      pricingSheet.getCell(`A${writeRow++}`).value = `• ${a}`;
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
export function cleanSOWContent(content: string): string {
  // Remove any internal comments, thinking tags, tool calls, etc.
  return content
    // Remove <AI_THINK> tags
    .replace(/<AI_THINK>[\s\S]*?<\/AI_THINK>/gi, '')
    // Remove <think> tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    // Remove <tool_call> tags
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    // Remove HTML comments
    .replace(/<!-- .*? -->/gi, '')
    // Remove any remaining XML-style tags that might be internal
    .replace(/<\/?[A-Z_]+>/gi, '')
    .trim();
}

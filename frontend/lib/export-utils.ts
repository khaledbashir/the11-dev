// Export utilities for SOW documents
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

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
 */
export function extractPricingFromContent(content: any): PricingRow[] {
  const rows: PricingRow[] = [];
  
  if (!content || !content.content) return rows;

  const findTables = (nodes: any[]): void => {
    nodes.forEach((node: any) => {
      if (node.type === 'table' && node.content) {
        // Skip header row, process data rows
        const dataRows = node.content.slice(1);
        
        dataRows.forEach((row: any) => {
          if (row.type === 'tableRow' && row.content && row.content.length >= 4) {
            const cells = row.content;
            const role = cells[0]?.content?.[0]?.content?.[0]?.text || '';
            const hours = parseFloat(cells[1]?.content?.[0]?.content?.[0]?.text || '0');
            const rateText = cells[2]?.content?.[0]?.content?.[0]?.text || '';
            const rate = parseFloat(rateText.replace(/[$,]/g, ''));
            const totalText = cells[3]?.content?.[0]?.content?.[0]?.text || '';
            const total = parseFloat(totalText.replace(/[$,+GST]/g, ''));
            
            if (role && !role.includes('Total') && !role.includes('Role')) {
              rows.push({ role, hours, rate, total });
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
export function exportToExcel(sowData: SOWData, filename: string = 'sow-pricing.xlsx') {
  const { pricingRows, discount, title, deliverables, assumptions } = sowData;
  const totals = calculateTotals(pricingRows, discount);
  
  // Create worksheet data matching Social Garden template
  const wsData: any[] = [
    [title || '[PROJECT NAME]'], // Row 1: Project title
    ['ITEMS', 'ROLE', 'HOURS', 'HOURLY RATE', 'TOTAL COST +GST'], // Row 2: Headers
  ];
  
  // Add deliverables header if provided
  if (deliverables && deliverables.length > 0) {
    wsData.push([`[  DELIVERABLES:\n${deliverables.map(d => '+ ' + d).join('\n')}  ]`, '', '', '', '']);
  }
  
  // Add pricing rows
  pricingRows.forEach(row => {
    wsData.push([
      '', // Empty ITEMS column
      row.role,
      row.hours,
      row.rate,
      row.total
    ]);
  });
  
  // Add total row
  wsData.push([
    'TOTAL',
    totals.totalHours,
    Math.round(totals.subtotal / totals.totalHours * 100) / 100, // Avg hourly rate
    '',
    totals.subtotal
  ]);
  
  // Add empty rows
  wsData.push(['']);
  wsData.push(['Scope & Price Overview']);
  wsData.push(['']);
  wsData.push(['ESTIMATED TOTAL HOURS', '', 'TOTAL COST']);
  wsData.push([title || '[PROJECT NAME]', totals.totalHours, totals.subtotal]);
  wsData.push(['']);
  
  // Add assumptions if provided
  if (assumptions && assumptions.length > 0) {
    wsData.push(['']);
    wsData.push(['Deliverable Assumptions:']);
    assumptions.forEach(assumption => {
      wsData.push([assumption]);
    });
  }
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths to match template
  ws['!cols'] = [
    { wch: 45 },  // ITEMS
    { wch: 35 },  // ROLE
    { wch: 12 },  // HOURS
    { wch: 15 },  // HOURLY RATE
    { wch: 20 },  // TOTAL COST
  ];
  
  // Add styling to match template (bold headers)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = 0; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 1, c: C }); // Row 2 (headers)
    if (ws[cellAddress]) {
      ws[cellAddress].s = { font: { bold: true } };
    }
  }
  
  XLSX.utils.book_append_sheet(wb, ws, title ? title.substring(0, 30) : 'SOW Pricing');
  XLSX.writeFile(wb, filename);
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

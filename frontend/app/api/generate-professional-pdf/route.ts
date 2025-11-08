import { NextRequest, NextResponse } from 'next/server';

// Helper function to convert SOW data to HTML
function convertSOWDataToHTML(sowData: any): string {
  const { projectTitle = 'Untitled Project', clientName = 'Client', scopes = [] } = sowData;
  
  let html = `
    <div class="sow-document">
      <h1>${projectTitle}</h1>
      <p><strong>Client:</strong> ${clientName}</p>
  `;
  
  // Add scopes
  scopes.forEach((scope: any, index: number) => {
    html += `
      <h2>Scope ${index + 1}: ${scope.title || 'Untitled Scope'}</h2>
      <p>${scope.description || ''}</p>
    `;
    
    // Add items if they exist
    if (scope.items && scope.items.length > 0) {
      html += '<ul>';
      scope.items.forEach((item: any) => {
        html += `<li>${item.title || item.description || ''}</li>`;
      });
      html += '</ul>';
    }
    
    // Add pricing table if exists
    if (scope.pricing && scope.pricing.length > 0) {
      html += `
        <table border="1" cellpadding="5" cellspacing="0">
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      scope.pricing.forEach((row: any) => {
        const total = (row.hours || 0) * (row.rate || 0);
        html += `
          <tr>
            <td>${row.role || ''}</td>
            <td>${row.description || ''}</td>
            <td>${row.hours || 0}</td>
            <td>$${row.rate || 0}</td>
            <td>$${total.toFixed(2)}</td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
    }
  });
  
  html += '</div>';
  return html;
}

async function handleProfessionalPDFGeneration(body: any) {
  const pdfServiceUrl = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://localhost:8000';
  
  try {
    // Convert SOW data to HTML
    const htmlContent = convertSOWDataToHTML(body);
    const filename = body.projectTitle || 'Statement-of-Work';
    
    // Send HTML to backend PDF service
    const response = await fetch(`${pdfServiceUrl}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html_content: htmlContent,
        filename: filename
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [PDF Service] Error response:', error);
      return NextResponse.json({ error: `PDF service error: ${error}` }, { status: response.status });
    }
    
    const pdfBlob = await response.blob();
    console.log('✅ [PDF Service] Professional PDF generated successfully');
    
    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${body.projectTitle || 'document'}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('❌ [PDF Service Proxy] Error forwarding request:', error.message);
    return NextResponse.json({ error: 'Failed to connect to PDF service' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  console.log('🔍 [POST /api/generate-professional-pdf] Request received');
  try {
    const body = await req.json();
    console.log('📄 [POST /api/generate-professional-pdf] Request body:', body);
    return handleProfessionalPDFGeneration(body);
  } catch (error: any) {
    console.error('❌ [POST /api/generate-professional-pdf] Error:', error.message, error.cause);
    return NextResponse.json(
      { error: 'Failed to process PDF request', details: error.message },
      { status: 500 }
    );
  }
}
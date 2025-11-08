import { NextRequest, NextResponse } from 'next/server';

async function handleProfessionalPDFGeneration(body: any) {
  const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${pdfServiceUrl}/generate-professional-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
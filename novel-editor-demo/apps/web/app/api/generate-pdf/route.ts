import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Use Docker service name for internal communication
    const pdfServiceUrl = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://pdf-service:8000';
    
    // Forward request to PDF service
    const response = await fetch(`${pdfServiceUrl}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `PDF service error: ${error}` },
        { status: response.status }
      );
    }

    // Get PDF blob and return it
    const pdfBlob = await response.blob();
    
    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${body.filename || 'document'}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

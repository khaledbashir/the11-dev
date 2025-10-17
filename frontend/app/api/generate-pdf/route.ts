import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Use environment variable with fallback to localhost for local dev
    const pdfServiceUrl = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://localhost:8000';
    
    
    // Forward request to PDF service with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(`${pdfServiceUrl}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        console.error(' PDF service error:', error);
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
    } catch (fetchError: any) {
      clearTimeout(timeout);
      console.error(' Fetch error:', fetchError.message);
      throw fetchError;
    }
  } catch (error: any) {
    console.error(' PDF generation error:', error.message, error.cause);
    return NextResponse.json(
      { error: `fetch failed: ${error.message}` },
      { status: 500 }
    );
  }
}

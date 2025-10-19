import { NextRequest, NextResponse } from 'next/server';

// Support both GET and POST methods
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sowId = searchParams.get('sowId');
  
  if (!sowId) {
    return NextResponse.json({ error: 'sowId is required' }, { status: 400 });
  }

  // Call POST handler with sowId in body
  return handlePDFGeneration({ sowId });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handlePDFGeneration(body);
  } catch (error: any) {
    console.error('❌ PDF generation error:', error.message, error.cause);
    return NextResponse.json(
      { error: `fetch failed: ${error.message}` },
      { status: 500 }
    );
  }
}

async function handlePDFGeneration(body: any) {
  try {
    // Use environment variable with fallback to localhost for local dev
    const pdfServiceUrl = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://localhost:8000';
    
    
    // Forward request to PDF service with timeout (increased to 60s for large documents)
    const controller = new AbortController();
    const timeoutMs = 60000; // 60 second timeout (increased from 30s)
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
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
        console.error('❌ PDF service error:', error);
        return NextResponse.json(
          { 
            error: `PDF service error: ${error}`,
            status: response.status,
            serviceUrl: pdfServiceUrl,
            timestamp: new Date().toISOString()
          },
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
      console.error('❌ Fetch error:', fetchError.message);
      
      // Provide detailed error information for debugging
      const errorDetails = {
        message: fetchError.message,
        name: fetchError.name,
        isTimeout: fetchError.name === 'AbortError',
        timeoutMs: timeoutMs,
        serviceUrl: pdfServiceUrl,
        timestamp: new Date().toISOString()
      };
      
      if (fetchError.name === 'AbortError') {
        console.error('❌ PDF generation timeout after', timeoutMs / 1000, 'seconds');
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('❌ PDF generation error:', error.message, error.cause);
    return NextResponse.json(
      { 
        error: `fetch failed: ${error.message}`,
        details: {
          message: error.message,
          name: error.name,
          cause: error.cause?.toString(),
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

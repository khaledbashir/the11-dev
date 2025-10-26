import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace');

  if (!workspace) {
    return NextResponse.json({ error: 'workspace query param is required' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_ANYTHINGLLM_URL || process.env.ANYTHINGLLM_URL;
  const apiKey = process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY || process.env.ANYTHINGLLM_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: 'AnythingLLM configuration missing on server' }, { status: 500 });
  }

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/workspace/${encodeURIComponent(workspace)}/threads`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      // Next.js fetch options can include next: { revalidate: 0 } if needed
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: 'Failed to fetch threads', status: response.status, body: text }, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Attempt to parse as text then JSON parse as a last resort
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ error: 'Invalid content-type from AnythingLLM threads endpoint' }, { status: 502 });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to proxy threads request', details: err?.message || String(err) }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

// Small helper: fetch with timeout and limited retries (idempotent GET)
async function fetchWithTimeoutRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
  retries = 2,
  backoffMs = 400
) {
  const { timeoutMs = 5000, ...opts } = options;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      // Retry on typical transient upstream failures
      if ([502, 503, 504, 429].includes(res.status) && attempt < retries) {
        clearTimeout(t);
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      clearTimeout(t);
      return res;
    } catch (err: any) {
      clearTimeout(t);
      // Retry on network/abort errors
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace');

  if (!workspace) {
    return NextResponse.json({ error: 'workspace query param is required' }, { status: 400 });
  }

  // Prefer secure server-side env vars; avoid relying on NEXT_PUBLIC values here
  const baseUrl = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL;
  const apiKey = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: 'AnythingLLM configuration missing on server' }, { status: 500 });
  }

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/workspace/${encodeURIComponent(workspace)}/threads`;
    const response = await fetchWithTimeoutRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      // Ensure no caching and full SSR execution
      cache: 'no-store',
      next: { revalidate: 0 },
      timeoutMs: 7000,
    }, 2, 500);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        { 
          error: 'Failed to fetch threads from AnythingLLM', 
          upstreamStatus: response.status, 
          workspace,
          upstreamUrl: url,
          bodyPreview: text?.slice(0, 500) || ''
        }, 
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Attempt to parse as text then JSON parse as a last resort
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ 
          error: 'Invalid content-type from AnythingLLM threads endpoint',
          receivedContentType: contentType,
          workspace,
          upstreamUrl: url,
          bodyPreview: text?.slice(0, 500) || ''
        }, { status: 502 });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Failed to proxy threads request', 
      details: err?.message || String(err),
      workspace
    }, { status: 502 });
  }
}

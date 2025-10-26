import { NextRequest, NextResponse } from 'next/server';

// Secure server-side proxy for AnythingLLM thread operations
// Supports:
// - POST   /api/anythingllm/thread           -> create thread (body: { workspace, name? })
// - GET    /api/anythingllm/thread?workspace=...&thread=...    -> get thread chats
// - DELETE /api/anythingllm/thread?workspace=...&thread=...    -> delete thread

function getEnv() {
  const baseUrl = process.env.ANYTHINGLLM_URL || process.env.NEXT_PUBLIC_ANYTHINGLLM_URL || '';
  const apiKey = process.env.ANYTHINGLLM_API_KEY || process.env.NEXT_PUBLIC_ANYTHINGLLM_API_KEY || '';
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

function authHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey } = getEnv();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'AnythingLLM not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const workspace = (body?.workspace || '').toString();
    const name = body?.name ? String(body.name) : undefined;
    if (!workspace) {
      return NextResponse.json({ error: 'Missing required field: workspace' }, { status: 400 });
    }

    const url = `${baseUrl}/api/v1/workspace/${encodeURIComponent(workspace)}/thread/new`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(apiKey),
      },
      body: JSON.stringify({ name: name || `New Chat - ${new Date().toLocaleTimeString()}` }),
    });

    const contentType = upstream.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json') ? await upstream.json() : await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to create thread', details: responseBody }, { status: upstream.status });
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Thread creation error', details: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { baseUrl, apiKey } = getEnv();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'AnythingLLM not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const workspace = (searchParams.get('workspace') || '').toString();
    const thread = (searchParams.get('thread') || '').toString();
    if (!workspace || !thread) {
      return NextResponse.json({ error: 'Missing query params: workspace and thread are required' }, { status: 400 });
    }

    const url = `${baseUrl}/api/v1/workspace/${encodeURIComponent(workspace)}/thread/${encodeURIComponent(thread)}/chats`;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: authHeaders(apiKey),
      // No cache to ensure live history
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json') ? await upstream.json() : await upstream.text();
    if (!upstream.ok || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Failed to load thread chats', details: responseBody }, { status: upstream.status || 502 });
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Thread history error', details: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { baseUrl, apiKey } = getEnv();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'AnythingLLM not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const workspace = (searchParams.get('workspace') || '').toString();
    const thread = (searchParams.get('thread') || '').toString();
    if (!workspace || !thread) {
      return NextResponse.json({ error: 'Missing query params: workspace and thread are required' }, { status: 400 });
    }

    const url = `${baseUrl}/api/v1/workspace/${encodeURIComponent(workspace)}/thread/${encodeURIComponent(thread)}`;
    const upstream = await fetch(url, {
      method: 'DELETE',
      headers: authHeaders(apiKey),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json({ error: 'Failed to delete thread', details: text }, { status: upstream.status });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Thread deletion error', details: err?.message || String(err) }, { status: 500 });
  }
}

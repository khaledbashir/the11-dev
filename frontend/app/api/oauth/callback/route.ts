import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Exchange code for token via backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to exchange code for token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return token to client
    return NextResponse.json({
      access_token: data.token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Extract returnUrl from state (format: "state_value|returnUrl")
    let returnUrl = '/';
    if (state && state.includes('|')) {
      const [, encodedReturnUrl] = state.split('|');
      try {
        returnUrl = decodeURIComponent(encodedReturnUrl);
      } catch {
        returnUrl = '/';
      }
    }

    // Exchange code for token via backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
      return NextResponse.redirect(
        new URL(`/?oauth_error=${encodeURIComponent(error.error || 'OAuth failed')}`, baseUrl)
      );
    }

    const data = await response.json();

    // Redirect back to original page with token in URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const redirectUrl = new URL(returnUrl, baseUrl);
    redirectUrl.searchParams.set('oauth_token', data.token);
    redirectUrl.searchParams.set('oauth_expires', data.expires_in || '3600');

    const responseObj = NextResponse.redirect(redirectUrl);
    
    // Also set secure HTTP-only cookie for token
    responseObj.cookies.set({
      name: 'oauth_access_token',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.expires_in || 3600,
    });

    return responseObj;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    return NextResponse.redirect(
      new URL(`/?oauth_error=${encodeURIComponent(errorMessage)}`, baseUrl)
    );
  }
}

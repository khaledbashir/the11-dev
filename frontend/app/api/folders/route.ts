import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/folders`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const folders = await response.json();
    return NextResponse.json(folders);
  } catch (error) {
    console.error('❌ Failed to fetch folders:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch folders', 
      details: String(error) 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, workspaceSlug, workspaceId, embedId } = body;
    
    console.log('📝 Creating folder with data:', { 
      name, 
      workspaceSlug, 
      workspaceId, 
      embedId, 
    });
    
    const response = await fetch(`${BACKEND_URL}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        workspace_slug: workspaceSlug,
        workspace_id: workspaceId,
        embed_id: embedId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || 'Failed to create folder');
    }

    const folderData = await response.json();
    return NextResponse.json(folderData, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create folder:', error);
    return NextResponse.json({ 
      error: 'Failed to create folder', 
      details: String(error)
    }, { status: 500 });
  }
}

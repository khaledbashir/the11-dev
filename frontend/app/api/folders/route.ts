import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const folders = await query('SELECT id, name, workspace_slug, workspace_id, embed_id, created_at, updated_at FROM folders ORDER BY created_at DESC');
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
    
    console.log('�� Creating folder with data:', { 
      name, 
      workspaceSlug, 
      workspaceId, 
      embedId, 
    });
    
    const folderId = crypto.randomUUID();
    const finalEmbedId = typeof embedId === 'number' ? embedId : (embedId ? parseInt(embedId, 10) : null);
    
    await query(
      'INSERT INTO folders (id, name, workspace_slug, workspace_id, embed_id) VALUES (?, ?, ?, ?, ?)',
      [folderId, name, workspaceSlug || null, workspaceId || null, finalEmbedId]
    );
    
    return NextResponse.json({ 
      id: folderId, 
      name, 
      workspaceSlug,
      workspaceId,
      embedId
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create folder:', error);
    return NextResponse.json({ 
      error: 'Failed to create folder', 
      details: String(error)
    }, { status: 500 });
  }
}

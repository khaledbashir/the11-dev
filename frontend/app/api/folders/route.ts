import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const folders = await query('SELECT id, name, workspace_slug, workspace_id, embed_id, created_at, updated_at FROM folders ORDER BY created_at DESC');
    return NextResponse.json(folders);
  } catch (error) {
    console.error('❌ Failed to fetch folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, workspaceSlug, workspaceId, embedId } = body;
    
    console.log('📝 Creating folder with data:', { name, workspaceSlug, workspaceId, embedId, embedIdType: typeof embedId });
    
    // Generate UUID for folder id
    const folderId = crypto.randomUUID();
    
    await query(
      'INSERT INTO folders (id, name, workspace_slug, workspace_id, embed_id) VALUES (?, ?, ?, ?, ?)',
      [folderId, name, workspaceSlug || null, workspaceId || null, embedId || null]
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
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const folders = await query('SELECT * FROM folders ORDER BY created_at DESC');
    return NextResponse.json(folders);
  } catch (error) {
    console.error(' Failed to fetch folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    
    // Generate UUID for folder id
    const folderId = crypto.randomUUID();
    
    await query(
      'INSERT INTO folders (id, name) VALUES (?, ?)',
      [folderId, name]
    );
    
    return NextResponse.json({ id: folderId, name }, { status: 201 });
  } catch (error) {
    console.error(' Failed to create folder:', error);
    return NextResponse.json({ error: 'Failed to create folder', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

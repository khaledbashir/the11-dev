import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const folders = await query('SELECT * FROM folders ORDER BY created_at DESC');
    return NextResponse.json(folders);
  } catch (error) {
    console.error('❌ Failed to fetch folders:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    
    await query(
      'INSERT INTO folders (name, description, created_at) VALUES (?, ?, NOW())',
      [name, description || null]
    );
    
    return NextResponse.json({ name, description }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create folder:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}

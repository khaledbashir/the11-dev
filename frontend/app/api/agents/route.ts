import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const agents = await query('SELECT * FROM agents ORDER BY name ASC');
    return NextResponse.json(agents);
  } catch (error) {
    console.error('❌ Failed to fetch agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

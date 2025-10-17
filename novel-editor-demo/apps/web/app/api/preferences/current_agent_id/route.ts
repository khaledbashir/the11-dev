import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Return default agent ID
    return NextResponse.json({ current_agent_id: 'architect' });
  } catch (error) {
    console.error('❌ Failed to fetch preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { current_agent_id } = await request.json();
    
    // Store preference (in-memory for now)
    return NextResponse.json({ current_agent_id }, { status: 200 });
  } catch (error) {
    console.error('❌ Failed to save preferences:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}

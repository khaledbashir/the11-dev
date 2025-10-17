import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    const messages = await query(
      'SELECT * FROM agent_messages WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50',
      [agentId]
    );
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('❌ Failed to fetch agent messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const { message, role = 'user' } = await request.json();
    
    await query(
      'INSERT INTO agent_messages (agent_id, message, role, created_at) VALUES (?, ?, ?, NOW())',
      [agentId, message, role]
    );
    
    return NextResponse.json({ message, role }, { status: 201 });
  } catch (error) {
    console.error('❌ Failed to create agent message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}

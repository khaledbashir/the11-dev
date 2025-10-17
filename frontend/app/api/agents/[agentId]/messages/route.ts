import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    const messages = await query(
      'SELECT * FROM chat_messages WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50',
      [agentId]
    );
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error(' Failed to fetch agent messages:', error);
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
    
    // chat_messages table uses 'content' not 'message', and 'timestamp' (bigint) not created_at for ordering
    await query(
      'INSERT INTO chat_messages (agent_id, content, role, timestamp, created_at) VALUES (?, ?, ?, ?, NOW())',
      [agentId, message || '', role, Date.now()]
    );
    
    return NextResponse.json({ message, role }, { status: 201 });
  } catch (error) {
    console.error(' Failed to create agent message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}

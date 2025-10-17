import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agent = await query(
      'SELECT * FROM agents WHERE id = ? LIMIT 1',
      [params.agentId]
    );

    if (!agent || agent.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent[0]);
  } catch (error) {
    console.error('Failed to fetch agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const body = await request.json();
    const { name, systemPrompt, model } = body;

    await query(
      'UPDATE agents SET name = ?, systemPrompt = ?, model = ? WHERE id = ?',
      [name || 'Agent', systemPrompt || '', model || 'gpt-4', params.agentId]
    );

    const updated = await query(
      'SELECT * FROM agents WHERE id = ? LIMIT 1',
      [params.agentId]
    );

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Failed to update agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    await query('DELETE FROM agents WHERE id = ?', [params.agentId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}

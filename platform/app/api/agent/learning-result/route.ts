import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Server-to-server: the voice/video Career Buddy posts a session summary.
export async function POST(req: Request) {
  const secret = req.headers.get('x-agent-secret');
  if (!secret || secret !== process.env.AGENT_SHARED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const employeeId: string | undefined = body?.employeeId;
  if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });

  const admin = createAdminClient();
  const channel = body?.channel === 'video' ? 'video' : 'voice';
  const summary = typeof body?.summary === 'string' ? body.summary : null;

  const { data: conv } = await admin
    .from('buddy_conversations')
    .insert({ employee_id: employeeId, channel, summary })
    .select('id')
    .single();

  if (conv && summary) {
    await admin.from('buddy_messages').insert({
      conversation_id: conv.id,
      role: 'assistant',
      content: summary,
    });
  }

  return NextResponse.json({ ok: true });
}

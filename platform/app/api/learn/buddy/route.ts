import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { careerBuddyReply } from '@/lib/ai/learning';
import { buildBuddyContext } from '@/lib/learning/context';

export const dynamic = 'force-dynamic';

// Text Career Buddy. Persists the conversation and returns a grounded reply.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question: string = body?.message?.toString().trim();
  let conversationId: string | undefined = body?.conversationId;
  if (!question) return NextResponse.json({ error: 'message required' }, { status: 400 });

  // Find or create the conversation (RLS scopes to the employee).
  if (!conversationId) {
    const { data: conv } = await supabase
      .from('buddy_conversations')
      .insert({ employee_id: user.id, channel: 'text' })
      .select('id')
      .single();
    conversationId = conv?.id;
  }

  // Recent history for context.
  const { data: history } = await supabase
    .from('buddy_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(12);

  const ctx = await buildBuddyContext(user.id);
  const reply = await careerBuddyReply(
    ctx,
    (history ?? []) as { role: 'user' | 'assistant'; content: string }[],
    question,
  );

  // Persist both turns.
  await supabase.from('buddy_messages').insert([
    { conversation_id: conversationId, role: 'user', content: question },
    { conversation_id: conversationId, role: 'assistant', content: reply },
  ]);

  return NextResponse.json({ conversationId, reply });
}

import { NextResponse } from 'next/server';
import { buildBuddyContext } from '@/lib/learning/context';

export const dynamic = 'force-dynamic';

// Server-to-server: the voice/video Career Buddy agent fetches employee context.
export async function GET(req: Request) {
  const secret = req.headers.get('x-agent-secret');
  if (!secret || secret !== process.env.AGENT_SHARED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const employeeId = new URL(req.url).searchParams.get('employeeId');
  if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });

  const ctx = await buildBuddyContext(employeeId);
  return NextResponse.json(ctx);
}

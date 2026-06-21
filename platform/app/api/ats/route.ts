import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAtsScreening } from '@/lib/ats-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Re-run ATS screening for an application. Caller must be HR (or own the application).
export async function POST(req: Request) {
  const { applicationId } = await req.json().catch(() => ({ applicationId: null }));
  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS ensures the user can only see applications they own or (if HR) any.
  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .single();
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const result = await runAtsScreening(applicationId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

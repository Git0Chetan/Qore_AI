import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Server-to-server: the voice agent fetches JD + candidate context for an
// application. Authenticated with the shared agent secret (the agent runs
// server-side, so it can safely hold this).
export async function GET(req: Request) {
  const secret = req.headers.get('x-agent-secret');
  if (!secret || secret !== process.env.AGENT_SHARED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const applicationId = new URL(req.url).searchParams.get('applicationId');
  if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: app } = await admin
    .from('applications')
    .select('id, job_id, candidate_id')
    .eq('id', applicationId)
    .single();
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ data: job }, { data: profile }] = await Promise.all([
    admin
      .from('jobs')
      .select('title, description, requirements, responsibilities, skills_required, experience_required')
      .eq('id', app.job_id)
      .single(),
    admin.from('profiles').select('name').eq('id', app.candidate_id).single(),
  ]);

  return NextResponse.json({
    applicationId,
    candidateName: profile?.name ?? 'the candidate',
    jobTitle: job?.title ?? 'the role',
    jobDescription: [job?.description, job?.requirements, job?.responsibilities].filter(Boolean).join('\n'),
    skills: job?.skills_required ?? [],
    experienceRequired: job?.experience_required ?? null,
  });
}

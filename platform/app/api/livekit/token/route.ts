import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_INTERVIEW_ATTEMPTS = Number(process.env.INTERVIEW_MAX_ATTEMPTS ?? 2);

// Issues a LiveKit token for a proctored assessment — ONLY to the candidate who
// owns the application, and only while it is in the assessment stage. This is the
// secured replacement for agent-starter-react's dev-only token route.
export async function POST(req: Request) {
  const { applicationId, mode } = await req.json().catch(() => ({ applicationId: null, mode: 'assessment' }));
  const isInterview = mode === 'interview';
  const isBuddy = mode === 'buddy';

  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Career Buddy: a personal room keyed to the employee (no application needed).
  if (isBuddy) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['internal_employee', 'hr_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Not available for this role' }, { status: 403 });
    }
    const roomName = `buddy_${user.id}`;
    const at = new AccessToken(key, secret, {
      identity: user.id,
      name: user.email ?? 'employee',
      ttl: '2h',
      metadata: JSON.stringify({ employeeId: user.id }),
    });
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canPublishData: true, canSubscribe: true });
    return NextResponse.json(
      { serverUrl: url, roomName, participantToken: await at.toJwt() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  // RLS lets the candidate read only their own application.
  const { data: app } = await supabase
    .from('applications')
    .select('id, job_id, candidate_id, status, interview_attempts')
    .eq('id', applicationId)
    .single();
  if (!app || app.candidate_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Assessment requires the assessment stage; the AI interview unlocks after passing.
  const allowed = isInterview ? app.status === 'assessment_passed' : app.status === 'assessment_assigned';
  if (!allowed) {
    return NextResponse.json({ error: 'Not available for this application stage' }, { status: 403 });
  }

  // Cap how many times the AI interview can be taken.
  if (isInterview && (app.interview_attempts ?? 0) >= MAX_INTERVIEW_ATTEMPTS) {
    return NextResponse.json(
      { error: `No interview attempts remaining (max ${MAX_INTERVIEW_ATTEMPTS}).` },
      { status: 403 },
    );
  }

  // Count this attempt (service role; the candidate must not control the counter).
  if (isInterview) {
    const admin = createAdminClient();
    const attempt = (app.interview_attempts ?? 0) + 1;
    await admin.from('applications').update({ interview_attempts: attempt }).eq('id', applicationId);
    await admin.from('application_events').insert({
      application_id: applicationId,
      type: 'interview_started',
      message: `AI interview started (attempt ${attempt} of ${MAX_INTERVIEW_ATTEMPTS}).`,
    });
  }

  const roomName = `${isInterview ? 'interview' : 'assessment'}_${applicationId}`;
  const at = new AccessToken(key, secret, {
    identity: user.id,
    name: user.email ?? 'candidate',
    ttl: '2h',
    metadata: JSON.stringify({ applicationId, jobId: app.job_id }),
  });
  at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canPublishData: true, canSubscribe: true });

  return NextResponse.json(
    { serverUrl: url, roomName, participantToken: await at.toJwt() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

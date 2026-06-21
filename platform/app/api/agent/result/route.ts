import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Server-to-server: the voice agent reports proctoring + interview results.
// Updates the application's assessment row (or creates one) and logs an event.
export async function POST(req: Request) {
  const secret = req.headers.get('x-agent-secret');
  if (!secret || secret !== process.env.AGENT_SHARED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  const admin = createAdminClient();
  const applicationId = body.applicationId as string;

  const fields = {
    behavioral_score: intOrNull(body.interview_score ?? body.behavioral),
    technical_score: intOrNull(body.technical),
    proctoring_integrity_score: intOrNull(body.proctoring_integrity),
    violations: Array.isArray(body.violations) ? body.violations : null,
    recording_url: typeof body.recording_url === 'string' ? body.recording_url : null,
    ai_feedback: typeof body.ai_feedback === 'string' ? body.ai_feedback : null,
  };

  // Update the latest assessment row if present, else insert one.
  const { data: existing } = await admin
    .from('assessments')
    .select('id')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin.from('assessments').update(fields).eq('id', existing.id);
  } else {
    await admin.from('assessments').insert({ application_id: applicationId, ...fields });
  }

  await admin.from('application_events').insert({
    application_id: applicationId,
    type: 'proctoring_recorded',
    message: `Proctoring${fields.proctoring_integrity_score != null ? ` (integrity ${fields.proctoring_integrity_score}/100)` : ''}` +
      `${Array.isArray(fields.violations) ? `, ${fields.violations.length} violation(s)` : ''}` +
      `${fields.behavioral_score != null ? `; interview ${fields.behavioral_score}/100` : ''}.`,
    metadata: fields as Record<string, unknown>,
  });

  // Interview completed -> generate and apply the post-call decision.
  const isInterviewResult = body.interview_score != null || body.recommend != null;
  if (isInterviewResult) {
    const overall = intOrNull(body.interview_score);
    const recommend =
      typeof body.recommend === 'boolean'
        ? body.recommend
        : overall != null
          ? overall >= Number(process.env.INTERVIEW_PASS_SCORE ?? 60)
          : false;
    const newStatus = recommend ? 'hr_review' : 'rejected';

    // Only advance from the post-assessment stage (don't clobber later HR actions).
    const { data: appRow } = await admin
      .from('applications')
      .select('candidate_id, status, job_id')
      .eq('id', applicationId)
      .single();

    if (appRow && appRow.status === 'assessment_passed') {
      await admin.from('applications').update({ status: newStatus }).eq('id', applicationId);
    }

    await admin.from('application_events').insert({
      application_id: applicationId,
      type: 'interview_decision',
      message: recommend
        ? `AI interview decision: Recommended for HR review${overall != null ? ` (${overall}/100)` : ''}.`
        : `AI interview decision: Not recommended${overall != null ? ` (${overall}/100)` : ''}.`,
      metadata: { recommend, overall, feedback: fields.ai_feedback },
    });

    // Notify the candidate of the outcome.
    if (appRow?.candidate_id) {
      const { data: job } = await admin.from('jobs').select('title').eq('id', appRow.job_id).single();
      const { data: profile } = await admin.from('profiles').select('email').eq('id', appRow.candidate_id).single();
      if (profile?.email) {
        await notify({
          to: profile.email,
          subject: recommend ? `Interview cleared — ${job?.title ?? 'your application'}` : `Interview update — ${job?.title ?? 'your application'}`,
          body: recommend
            ? `Great news! You cleared the AI interview${job?.title ? ` for ${job.title}` : ''}. Our HR team will review your profile and reach out with next steps.`
            : `Thank you for completing the AI interview${job?.title ? ` for ${job.title}` : ''}. After review, we won't be moving forward at this time.`,
        });
      }
    }

    return NextResponse.json({ ok: true, decision: recommend ? 'recommended' : 'not_recommended', status: newStatus });
  }

  return NextResponse.json({ ok: true });
}

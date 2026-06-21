import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAssessmentToken } from '@/lib/assessment-token';
import { corsJson, corsPreflight } from '@/lib/cors';
import { notify, NOTIFY_TEMPLATES } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight();
}

function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Receives assessment results from the quiz app and finalizes the application.
// NOTE: score integrity is bound to the application via the signed token, but the
// scores themselves come from the client — server-authoritative grading is Phase 2.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.token) return corsJson({ error: 'token required' }, 400);

  const payload = verifyAssessmentToken(body.token);
  if (!payload) return corsJson({ error: 'Invalid or expired token' }, 401);

  const admin = createAdminClient();
  const { data: job } = await admin
    .from('jobs')
    .select('title, test_threshold')
    .eq('id', payload.jobId)
    .single();
  if (!job) return corsJson({ error: 'Job not found' }, 404);

  const overall = intOrNull(body.overall) ?? 0;
  const passed = overall >= job.test_threshold;
  const status = passed ? 'assessment_passed' : 'assessment_failed';

  await admin.from('assessments').insert({
    application_id: payload.applicationId,
    technical_score: intOrNull(body.technical),
    behavioral_score: intOrNull(body.behavioral),
    coding_score: intOrNull(body.coding),
    aptitude_score: intOrNull(body.aptitude),
    proctoring_integrity_score: intOrNull(body.proctoring_integrity),
    overall_score: overall,
    violations: Array.isArray(body.violations) ? body.violations : null,
    recording_url: typeof body.recording_url === 'string' ? body.recording_url : null,
    ai_feedback: typeof body.ai_feedback === 'string' ? body.ai_feedback : null,
  });

  await admin.from('applications').update({ assessment_score: overall, status }).eq('id', payload.applicationId);

  await admin.from('application_events').insert({
    application_id: payload.applicationId,
    type: passed ? 'assessment_passed' : 'assessment_failed',
    message: passed
      ? `Assessment passed (${overall}/100 ≥ ${job.test_threshold}).`
      : `Assessment not cleared (${overall}/100 < ${job.test_threshold}).`,
    metadata: { overall, threshold: job.test_threshold },
  });

  const { data: appRow } = await admin
    .from('applications')
    .select('candidate_id')
    .eq('id', payload.applicationId)
    .single();
  if (appRow) {
    const { data: profile } = await admin.from('profiles').select('email').eq('id', appRow.candidate_id).single();
    if (profile?.email) {
      const tpl = passed
        ? NOTIFY_TEMPLATES.assessment_passed(job.title)
        : NOTIFY_TEMPLATES.assessment_failed(job.title);
      await notify({ to: profile.email, ...tpl });
    }
  }

  return corsJson({ ok: true, passed, status, overall });
}

import { createAdminClient } from '@/lib/supabase/admin';
import { extractResumeText, parseResume, scoreAts } from '@/lib/ai/ats';
import { notify, NOTIFY_TEMPLATES } from '@/lib/notify';
import type { Application, Job } from '@/lib/types';

// Runs AI screening for one application: parse resume -> ATS score vs JD ->
// threshold gate -> status update + events + notification. Trusted (service role).
// Safe to call from a server action or an API route.
export async function runAtsScreening(applicationId: string) {
  const admin = createAdminClient();

  const { data: appData, error: appErr } = await admin
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();
  if (appErr || !appData) throw new Error(appErr?.message || 'Application not found');
  const application = appData as Application;

  const { data: jobData, error: jobErr } = await admin
    .from('jobs')
    .select('*')
    .eq('id', application.job_id)
    .single();
  if (jobErr || !jobData) throw new Error(jobErr?.message || 'Job not found');
  const job = jobData as Job;

  // Pull the resume bytes from storage.
  let resumeText = '';
  if (application.resume_url) {
    const { data: file } = await admin.storage.from('resumes').download(application.resume_url);
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      resumeText = await extractResumeText(buffer, application.resume_url);
    }
  }

  const parsed = await parseResume(resumeText);
  const { ats_score, breakdown, reasoning } = await scoreAts(resumeText, parsed, job);

  const passed = ats_score >= job.ats_threshold;
  const status = passed ? 'assessment_assigned' : 'ats_rejected';

  await admin
    .from('applications')
    .update({
      parsed,
      ats_score,
      ats_breakdown: breakdown,
      ats_reasoning: reasoning,
      status,
    })
    .eq('id', applicationId);

  await admin.from('application_events').insert([
    {
      application_id: applicationId,
      type: passed ? 'ats_passed' : 'ats_failed',
      message: passed
        ? `ATS screening passed (${ats_score}/100 ≥ ${job.ats_threshold}).`
        : `Rejected — ATS criteria not met (${ats_score}/100 < ${job.ats_threshold}).`,
      metadata: { ats_score, breakdown },
    },
    ...(passed
      ? [{ application_id: applicationId, type: 'assessment_assigned', message: 'Assessment assigned.' }]
      : []),
  ]);

  // Notify the candidate.
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', application.candidate_id)
    .single();
  if (profile?.email) {
    const tpl = passed ? NOTIFY_TEMPLATES.ats_passed(job.title) : NOTIFY_TEMPLATES.ats_failed(job.title);
    await notify({ to: profile.email, ...tpl });
  }

  return { ats_score, breakdown, reasoning, passed, status };
}

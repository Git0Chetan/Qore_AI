'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { runAtsScreening } from '@/lib/ats-run';
import { notify, NOTIFY_TEMPLATES } from '@/lib/notify';
import { signAssessmentToken } from '@/lib/assessment-token';

const ALLOWED = ['.pdf', '.doc', '.docx'];

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
}

export async function applyToJob(formData: FormData) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const jobId = str(formData.get('job_id'));
  if (!jobId) throw new Error('Missing job');

  const supabase = await createClient();

  // Already applied? Send them to their existing application.
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', jobId)
    .eq('candidate_id', profile.id)
    .maybeSingle();
  if (existing) redirect(`/candidate/applications/${existing.id}`);

  // Resume upload.
  const file = formData.get('resume') as File | null;
  if (!file || file.size === 0) throw new Error('Resume is required');
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED.includes(ext)) throw new Error('Resume must be PDF, DOC, or DOCX');

  const path = `${profile.id}/${jobId}-${Date.now()}${ext}`;
  const { error: upErr } = await supabase.storage
    .from('resumes')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) throw new Error(`Resume upload failed: ${upErr.message}`);

  const skills = (str(formData.get('skills')) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: inserted, error: insErr } = await supabase
    .from('applications')
    .insert({
      job_id: jobId,
      candidate_id: profile.id,
      resume_url: path,
      current_company: str(formData.get('current_company')),
      current_role: str(formData.get('current_role')),
      experience: str(formData.get('experience')),
      notice_period: str(formData.get('notice_period')),
      expected_salary: str(formData.get('expected_salary')),
      skills,
      linkedin: str(formData.get('linkedin')),
      portfolio: str(formData.get('portfolio')),
      status: 'applied',
    })
    .select('id')
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message || 'Could not create application');

  const appId = inserted.id as string;

  await supabase.from('application_events').insert({
    application_id: appId,
    type: 'applied',
    message: 'Application submitted.',
  });

  // Confirmation email.
  const { data: job } = await supabase.from('jobs').select('title').eq('id', jobId).single();
  if (profile.email && job) {
    await notify({ to: profile.email, ...NOTIFY_TEMPLATES.application_submitted(job.title) });
  }

  // Run AI screening synchronously (parse + ATS + threshold gate).
  try {
    await runAtsScreening(appId);
  } catch (err) {
    console.error('[applyToJob] ATS screening failed', err);
  }

  revalidatePath('/candidate');
  redirect(`/candidate/applications/${appId}`);
}

// Mock identity verification, then hand off to the proctored assessment (quiz app).
export async function startAssessment(formData: FormData) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const applicationId = str(formData.get('application_id'));
  if (!applicationId) throw new Error('Missing application');

  const supabase = await createClient();
  const { data: app } = await supabase
    .from('applications')
    .select('id, job_id, candidate_id, status')
    .eq('id', applicationId)
    .single();
  if (!app || app.candidate_id !== profile.id) throw new Error('Not authorized');
  if (app.status !== 'assessment_assigned') redirect(`/candidate/applications/${applicationId}`);

  // Mock identity verification (face + Aadhaar). Real UIDAI/biometrics = Phase 2.
  await supabase.from('profiles').update({ aadhaar_verified: true }).eq('id', profile.id);
  await supabase.from('application_events').insert({
    application_id: applicationId,
    type: 'identity_verified',
    message: 'Identity verified (face + Aadhaar). Assessment started.',
  });

  const token = signAssessmentToken(applicationId, app.job_id);
  const quizUrl = process.env.NEXT_PUBLIC_QUIZ_URL || 'http://localhost:3001';
  const platform = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
  redirect(`${quizUrl}?token=${encodeURIComponent(token)}&platform=${encodeURIComponent(platform)}`);
}

// Candidate accepts or declines a released offer.
export async function respondToOffer(formData: FormData) {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  const offerId = str(formData.get('offer_id'));
  const applicationId = str(formData.get('application_id'));
  const decision = str(formData.get('decision')); // 'accepted' | 'declined'
  if (!offerId || !applicationId || !decision) throw new Error('Missing fields');

  const supabase = await createClient();
  // RLS: candidate can update offers on their own application.
  await supabase.from('offers').update({ status: decision }).eq('id', offerId);

  const accepted = decision === 'accepted';
  await supabase
    .from('applications')
    .update({ status: accepted ? 'hired' : 'rejected' })
    .eq('id', applicationId)
    .eq('candidate_id', profile.id);

  await supabase.from('application_events').insert({
    application_id: applicationId,
    type: accepted ? 'offer_accepted' : 'offer_declined',
    message: accepted ? 'Candidate accepted the offer.' : 'Candidate declined the offer.',
  });

  revalidatePath(`/candidate/applications/${applicationId}`);
  redirect(`/candidate/applications/${applicationId}`);
}

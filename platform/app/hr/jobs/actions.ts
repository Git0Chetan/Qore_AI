'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { slugify } from '@/lib/utils';
import { writeAudit } from '@/lib/audit';
import { notify, NOTIFY_TEMPLATES } from '@/lib/notify';
import type { JobStatus, JobVisibility, Profile } from '@/lib/types';

// Loads the application's job title + candidate email for notifications.
async function applicationContext(supabase: Awaited<ReturnType<typeof createClient>>, applicationId: string) {
  const { data: app } = await supabase
    .from('applications')
    .select('id, job_id, candidate_id')
    .eq('id', applicationId)
    .single();
  if (!app) return null;
  const [{ data: job }, { data: profile }] = await Promise.all([
    supabase.from('jobs').select('title').eq('id', app.job_id).single(),
    supabase.from('profiles').select('email').eq('id', app.candidate_id).single(),
  ]);
  return { app, jobTitle: job?.title ?? 'the role', email: profile?.email ?? null };
}

async function requireHr(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || (profile.role !== 'hr_admin' && profile.role !== 'super_admin')) {
    throw new Error('Not authorized');
  }
  return profile;
}

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
}

export async function createJob(formData: FormData) {
  const profile = await getProfile();
  if (!profile || (profile.role !== 'hr_admin' && profile.role !== 'super_admin')) {
    throw new Error('Not authorized');
  }

  const supabase = await createClient();

  // Ensure the HR user belongs to an organization (create one on first job).
  let orgId = profile.org_id;
  if (!orgId) {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: `${profile.name || 'My'} Organization` })
      .select('id')
      .single();
    if (orgErr) throw new Error(orgErr.message);
    orgId = org.id;
    await supabase.from('profiles').update({ org_id: orgId }).eq('id', profile.id);
  }

  const title = str(formData.get('title')) ?? 'Untitled role';
  const skills = (str(formData.get('skills_required')) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase.from('jobs').insert({
    org_id: orgId,
    title,
    department: str(formData.get('department')),
    location: str(formData.get('location')),
    employment_type: str(formData.get('employment_type')),
    experience_required: str(formData.get('experience_required')),
    skills_required: skills,
    salary_min: num(formData.get('salary_min')),
    salary_max: num(formData.get('salary_max')),
    description: str(formData.get('description')),
    responsibilities: str(formData.get('responsibilities')),
    requirements: str(formData.get('requirements')),
    ats_threshold: num(formData.get('ats_threshold')) ?? 60,
    test_threshold: num(formData.get('test_threshold')) ?? 60,
    hiring_manager: str(formData.get('hiring_manager')),
    openings: num(formData.get('openings')) ?? 1,
    deadline: str(formData.get('deadline')),
    visibility: (str(formData.get('visibility')) as JobVisibility) ?? 'external',
    status: (str(formData.get('status')) as JobStatus) ?? 'active',
    public_slug: slugify(title, randomUUID().slice(0, 6)),
    created_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/hr');
  redirect('/hr');
}

// HR pipeline actions: change stage / reject / add a comment.
export async function updateApplicationStatus(formData: FormData) {
  const profile = await getProfile();
  if (!profile || (profile.role !== 'hr_admin' && profile.role !== 'super_admin')) {
    throw new Error('Not authorized');
  }
  const applicationId = str(formData.get('application_id'));
  const status = str(formData.get('status'));
  if (!applicationId || !status) throw new Error('Missing fields');

  const supabase = await createClient();
  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId);
  if (error) throw new Error(error.message);

  await supabase.from('application_events').insert({
    application_id: applicationId,
    type: 'stage_change',
    message: `HR moved candidate to "${status}".`,
  });

  revalidatePath('/hr');
  revalidatePath(`/hr/jobs`);
}

export async function scheduleInterview(formData: FormData) {
  const profile = await requireHr();
  const applicationId = str(formData.get('application_id'));
  const scheduledAt = str(formData.get('scheduled_at'));
  if (!applicationId || !scheduledAt) throw new Error('Missing fields');
  const mode = str(formData.get('mode')) ?? 'video';
  const location = str(formData.get('location'));
  const notes = str(formData.get('notes'));

  const supabase = await createClient();
  await supabase.from('interviews').insert({
    application_id: applicationId,
    scheduled_at: new Date(scheduledAt).toISOString(),
    mode,
    location,
    notes,
    created_by: profile.id,
  });
  await supabase.from('applications').update({ status: 'interview' }).eq('id', applicationId);

  const when = new Date(scheduledAt).toLocaleString('en-IN');
  await supabase.from('application_events').insert({
    application_id: applicationId,
    type: 'interview_scheduled',
    message: `Interview scheduled for ${when} (${mode}).`,
    metadata: { scheduledAt, mode, location },
  });

  const ctx = await applicationContext(supabase, applicationId);
  if (ctx?.email) {
    await notify({ to: ctx.email, ...NOTIFY_TEMPLATES.interview_scheduled(ctx.jobTitle, when, mode, location ?? '') });
  }
  await writeAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    action: 'interview_scheduled',
    targetType: 'application',
    targetId: applicationId,
    detail: { scheduledAt, mode },
  });

  revalidatePath('/hr');
}

export async function releaseOffer(formData: FormData) {
  const profile = await requireHr();
  const applicationId = str(formData.get('application_id'));
  if (!applicationId) throw new Error('Missing application');
  const salary = str(formData.get('salary'));
  const joiningDate = str(formData.get('joining_date'));
  const notes = str(formData.get('notes'));

  const supabase = await createClient();
  await supabase.from('offers').insert({
    application_id: applicationId,
    salary,
    joining_date: joiningDate,
    notes,
    created_by: profile.id,
  });
  await supabase.from('applications').update({ status: 'offer' }).eq('id', applicationId);

  await supabase.from('application_events').insert({
    application_id: applicationId,
    type: 'offer_released',
    message: `Offer released${salary ? ` (${salary})` : ''}.`,
    metadata: { salary, joiningDate },
  });

  const ctx = await applicationContext(supabase, applicationId);
  if (ctx?.email) {
    await notify({ to: ctx.email, ...NOTIFY_TEMPLATES.offer_released(ctx.jobTitle) });
  }
  await writeAudit({
    orgId: profile.org_id,
    actorId: profile.id,
    action: 'offer_released',
    targetType: 'application',
    targetId: applicationId,
    detail: { salary, joiningDate },
  });

  revalidatePath('/hr');
}

export async function addComment(formData: FormData) {
  const profile = await getProfile();
  if (!profile || (profile.role !== 'hr_admin' && profile.role !== 'super_admin')) {
    throw new Error('Not authorized');
  }
  const applicationId = str(formData.get('application_id'));
  const comment = str(formData.get('comment'));
  if (!applicationId || !comment) return;

  const supabase = await createClient();
  await supabase.from('application_events').insert({
    application_id: applicationId,
    type: 'comment',
    message: comment,
  });
  revalidatePath('/hr');
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { runSkillAnalysis } from '@/lib/learning/run';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import type { PathItemStatus, TrainingRequestType } from '@/lib/types';

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
}

export async function analyzeMySkills(formData: FormData) {
  const profile = await getProfile();
  if (!profile) throw new Error('Not authorized');
  const targetRoleId = str(formData.get('target_role_id')) ?? undefined;
  await runSkillAnalysis(profile.id, targetRoleId);
  revalidatePath('/learn');
  revalidatePath('/learn/path');
}

export async function updatePathItem(formData: FormData) {
  const profile = await getProfile();
  if (!profile) throw new Error('Not authorized');
  const itemId = str(formData.get('item_id'));
  const status = str(formData.get('status')) as PathItemStatus | null;
  if (!itemId || !status) throw new Error('Missing fields');

  const supabase = await createClient();
  // RLS ensures the item belongs to the employee's path.
  await supabase.from('path_items').update({ status }).eq('id', itemId);
  revalidatePath('/learn/path');
  revalidatePath('/learn');
}

// Log learning hours by completing/enrolling a recommended course.
export async function completeCourse(formData: FormData) {
  const profile = await getProfile();
  if (!profile) throw new Error('Not authorized');
  const title = str(formData.get('title'));
  const url = str(formData.get('url'));
  const provider = (str(formData.get('provider')) ?? 'lms') as string;
  const hours = Number(str(formData.get('hours')) ?? '1') || 1;
  if (!title) return;

  const supabase = await createClient();
  // Create a lightweight course row (HR-curated catalog also lives here), then enroll+complete.
  const { data: course } = await supabase
    .from('courses')
    .insert({ provider, title, url, skills: [], org_id: profile.org_id })
    .select('id')
    .single();
  if (course) {
    await supabase.from('enrollments').insert({
      employee_id: profile.id,
      course_id: course.id,
      status: 'completed',
      progress_pct: 100,
      hours_spent: hours,
      completed_at: new Date().toISOString(),
    });
  }
  revalidatePath('/learn');
}

export async function submitTrainingRequest(formData: FormData) {
  const profile = await getProfile();
  if (!profile) throw new Error('Not authorized');
  const type = (str(formData.get('type')) ?? 'training') as TrainingRequestType;
  const title = str(formData.get('title'));
  const justification = str(formData.get('justification'));
  const cost = str(formData.get('cost'));
  if (!title) throw new Error('Title required');

  const supabase = await createClient();
  await supabase.from('training_requests').insert({
    employee_id: profile.id,
    type,
    title,
    justification,
    cost,
  });
  revalidatePath('/learn/requests');
}

// HR/manager approves or rejects a nomination.
export async function decideTrainingRequest(formData: FormData) {
  const profile = await getProfile();
  if (!profile || (profile.role !== 'hr_admin' && profile.role !== 'super_admin')) {
    throw new Error('Not authorized');
  }
  const requestId = str(formData.get('request_id'));
  const decision = str(formData.get('decision')); // approved | rejected
  if (!requestId || !decision) throw new Error('Missing fields');

  const supabase = await createClient();
  const { data: req } = await supabase
    .from('training_requests')
    .update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', requestId)
    .select('employee_id, title')
    .single();

  if (req) {
    const { data: emp } = await supabase.from('profiles').select('email').eq('id', req.employee_id).single();
    if (emp?.email) {
      await notify({
        to: emp.email,
        subject: `Training request ${decision} — ${req.title}`,
        body: `Your request "${req.title}" was ${decision} by ${profile.name || 'your manager'}.`,
      });
    }
    await writeAudit({
      orgId: profile.org_id,
      actorId: profile.id,
      action: `training_${decision}`,
      targetType: 'training_request',
      targetId: requestId,
    });
  }
  revalidatePath('/learn/team');
}

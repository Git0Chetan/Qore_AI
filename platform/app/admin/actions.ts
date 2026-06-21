'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import type { OrgSettings, UserRole } from '@/lib/types';

const ROLES: UserRole[] = ['super_admin', 'hr_admin', 'internal_employee', 'external_candidate'];

async function requireSuperAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== 'super_admin') throw new Error('Not authorized');
  return profile;
}

export async function updateUserRole(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = (formData.get('user_id') ?? '').toString();
  const role = (formData.get('role') ?? '').toString() as UserRole;
  if (!userId || !ROLES.includes(role)) throw new Error('Invalid input');
  if (userId === admin.id) throw new Error('You cannot change your own role');

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);

  await writeAudit({
    orgId: admin.org_id,
    actorId: admin.id,
    action: 'role_changed',
    targetType: 'profile',
    targetId: userId,
    detail: { role },
  });
  revalidatePath('/admin/users');
}

export async function updateOrgSettings(formData: FormData) {
  const admin = await requireSuperAdmin();
  if (!admin.org_id) throw new Error('No organization to configure');

  const num = (k: string) => {
    const v = formData.get(k);
    const n = v == null || v === '' ? null : Number(v);
    return Number.isFinite(n) ? (n as number) : undefined;
  };
  const bool = (k: string) => formData.get(k) === 'on';

  const settings: OrgSettings = {
    default_ats_threshold: num('default_ats_threshold'),
    default_test_threshold: num('default_test_threshold'),
    notify_application_submitted: bool('notify_application_submitted'),
    notify_ats: bool('notify_ats'),
    notify_assessment: bool('notify_assessment'),
    notify_interview: bool('notify_interview'),
    notify_offer: bool('notify_offer'),
  };

  const supabase = await createClient();
  const { error } = await supabase.from('organizations').update({ settings }).eq('id', admin.org_id);
  if (error) throw new Error(error.message);

  await writeAudit({
    orgId: admin.org_id,
    actorId: admin.id,
    action: 'settings_updated',
    targetType: 'organization',
    targetId: admin.org_id,
    detail: settings as Record<string, unknown>,
  });
  revalidatePath('/admin/settings');
}

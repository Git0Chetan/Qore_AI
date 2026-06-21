import { createAdminClient } from '@/lib/supabase/admin';
import type { BuddyContext } from '@/lib/ai/learning';

// Assembles the grounded context the Career Buddy uses (text, voice, or video).
export async function buildBuddyContext(employeeId: string): Promise<BuddyContext & { name: string }> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('name, role')
    .eq('id', employeeId)
    .single();

  const { data: report } = await admin
    .from('skill_gap_reports')
    .select('readiness_score, gaps, target_role_id')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let targetRole = 'Senior role';
  if (report?.target_role_id) {
    const { data: role } = await admin
      .from('career_roles')
      .select('title, level')
      .eq('id', report.target_role_id)
      .single();
    if (role) targetRole = `${role.title}${role.level ? ` (${role.level})` : ''}`;
  }

  const { data: path } = await admin
    .from('learning_paths')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let pathItems: { title: string; status: string }[] = [];
  if (path) {
    const { data: items } = await admin
      .from('path_items')
      .select('title, status')
      .eq('path_id', path.id)
      .order('ord', { ascending: true });
    pathItems = (items ?? []) as { title: string; status: string }[];
  }

  const { data: jobs } = await admin
    .from('jobs')
    .select('title')
    .eq('status', 'active')
    .limit(8);

  return {
    name: profile?.name ?? 'there',
    currentRole: profile?.role ?? 'internal_employee',
    aspiration: targetRole,
    targetRole,
    readinessScore: report?.readiness_score ?? null,
    gaps: Array.isArray(report?.gaps) ? report!.gaps : [],
    pathItems,
    openRoles: (jobs ?? []).map((j: { title: string }) => j.title),
  };
}

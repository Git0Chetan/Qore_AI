import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeSkillGap, generateLearningPath } from '@/lib/ai/learning';
import type { CareerRole } from '@/lib/types';

// Runs AI skill-gap analysis for an employee against a target role, then writes a
// skill_gap_report + a fresh active learning_path with path_items. Trusted (service role).
export async function runSkillAnalysis(employeeId: string, targetRoleId?: string) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('name, role, org_id')
    .eq('id', employeeId)
    .single();

  // Target role: explicit, else the first defined career role.
  let role: CareerRole | null = null;
  if (targetRoleId) {
    const { data } = await admin.from('career_roles').select('*').eq('id', targetRoleId).single();
    role = (data as CareerRole) ?? null;
  }
  if (!role) {
    const { data } = await admin
      .from('career_roles')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    role = (data as CareerRole) ?? null;
  }
  if (!role) throw new Error('No career roles defined. Seed career_roles first.');

  // Required competencies for the target role.
  const { data: rcRows } = await admin
    .from('role_competencies')
    .select('required_level, competencies(name)')
    .eq('role_id', role.id);
  const requiredCompetencies = (rcRows ?? []).map(
    (r: { required_level: number; competencies: { name: string } | { name: string }[] | null }) => ({
      name: Array.isArray(r.competencies) ? r.competencies[0]?.name : r.competencies?.name ?? '',
      required_level: r.required_level,
    }),
  );

  // Known skills.
  const { data: esRows } = await admin
    .from('employee_skills')
    .select('level, competencies(name)')
    .eq('employee_id', employeeId);
  const knownSkills = (esRows ?? []).map(
    (r: { level: number; competencies: { name: string } | { name: string }[] | null }) => ({
      name: Array.isArray(r.competencies) ? r.competencies[0]?.name : r.competencies?.name ?? '',
      level: r.level,
    }),
  );

  // Resume skills + assessment scores from any applications this user made.
  const { data: apps } = await admin
    .from('applications')
    .select('id, parsed')
    .eq('candidate_id', employeeId);
  const resumeSkills = Array.from(
    new Set(
      (apps ?? []).flatMap((a: { parsed: { skills?: string[] } | null }) => a.parsed?.skills ?? []),
    ),
  );
  const appIds = (apps ?? []).map((a: { id: string }) => a.id);
  const assessmentScores: { label: string; score: number }[] = [];
  if (appIds.length) {
    const { data: assess } = await admin
      .from('assessments')
      .select('overall_score, technical_score')
      .in('application_id', appIds);
    for (const a of assess ?? []) {
      if (a.overall_score != null) assessmentScores.push({ label: 'Assessment', score: a.overall_score });
      if (a.technical_score != null) assessmentScores.push({ label: 'Technical', score: a.technical_score });
    }
  }

  const report = await analyzeSkillGap({
    name: profile?.name ?? 'Employee',
    currentRole: profile?.role ?? 'internal_employee',
    aspiration: role.title,
    targetRole: role,
    requiredCompetencies,
    knownSkills,
    resumeSkills,
    assessmentScores,
  });

  await admin.from('skill_gap_reports').insert({
    employee_id: employeeId,
    target_role_id: role.id,
    readiness_score: report.readiness_score,
    gaps: report.gaps,
    reasoning: report.reasoning,
  });

  // Build a fresh path (retire previous active ones).
  await admin
    .from('learning_paths')
    .update({ status: 'completed' })
    .eq('employee_id', employeeId)
    .eq('status', 'active');

  const items = await generateLearningPath(report.gaps, role);
  const { data: path } = await admin
    .from('learning_paths')
    .insert({
      employee_id: employeeId,
      target_role_id: role.id,
      title: `Path to ${role.title}`,
      status: 'active',
    })
    .select('id')
    .single();

  if (path && items.length) {
    // Map competency name -> id for linking path items.
    const { data: comps } = await admin.from('competencies').select('id, name');
    const compByName = new Map((comps ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]));
    await admin.from('path_items').insert(
      items.map((it, i) => ({
        path_id: path.id,
        ord: i,
        title: it.title,
        competency_id: compByName.get((it.competency ?? '').toLowerCase()) ?? null,
        status: 'not_started',
      })),
    );
  }

  return { readiness_score: report.readiness_score, pathId: path?.id ?? null };
}

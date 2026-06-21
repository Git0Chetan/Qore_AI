import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { analyzeMySkills } from '@/app/learn/actions';
import { Button, Card, PageShell, Select } from '@/components/ui';
import type { CareerRole, Certification, Enrollment, LearningPath, PathItem, SkillGapReport } from '@/lib/types';

export const dynamic = 'force-dynamic';

function ReadinessRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke="url(#grad)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} transform="rotate(-90 70 70)"
      />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <text x="70" y="66" textAnchor="middle" fontSize="30" fontWeight="800" fill="#e6edf6">{score}</text>
      <text x="70" y="88" textAnchor="middle" fontSize="11" fill="#94a3b8">READINESS</text>
    </svg>
  );
}

export default async function LearnDashboard() {
  const supabase = await createClient();
  const profile = await getProfile();

  const [{ data: reportRow }, { data: roles }] = await Promise.all([
    supabase.from('skill_gap_reports').select('*').eq('employee_id', profile!.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('career_roles').select('*').order('created_at', { ascending: true }),
  ]);
  const report = reportRow as SkillGapReport | null;
  const careerRoles = (roles ?? []) as CareerRole[];

  const { data: pathRow } = await supabase.from('learning_paths').select('*')
    .eq('employee_id', profile!.id).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const path = pathRow as LearningPath | null;

  let items: PathItem[] = [];
  if (path) {
    const { data } = await supabase.from('path_items').select('*').eq('path_id', path.id).order('ord');
    items = (data ?? []) as PathItem[];
  }
  const done = items.filter((i) => i.status === 'completed').length;

  const { data: enr } = await supabase.from('enrollments').select('*').eq('employee_id', profile!.id);
  const enrollments = (enr ?? []) as Enrollment[];
  const hours = Math.round(enrollments.reduce((s, e) => s + Number(e.hours_spent), 0) * 10) / 10;
  const completedCourses = enrollments.filter((e) => e.status === 'completed').length;

  const { data: certs } = await supabase.from('certifications').select('*').eq('employee_id', profile!.id);
  const certifications = (certs ?? []) as Certification[];

  const targetRole = careerRoles.find((r) => r.id === report?.target_role_id);

  return (
    <PageShell
      title={`Hi ${profile?.name?.split(' ')[0] || 'there'} 👋`}
      subtitle="Your personalized learning & career growth hub."
      action={
        <Link href="/learn/buddy"><Button>💬 Ask Career Buddy</Button></Link>
      }
    >
      {!report ? (
        careerRoles.length === 0 ? (
          <Card>
            <h3 style={{ marginTop: 0 }}>Career framework not set up yet</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              No career roles or competencies have been defined for your organization. Ask your HR/admin
              to set up the competency framework (or run <code>seed_learning.sql</code>) — then you can run
              your skill analysis.
            </p>
          </Card>
        ) : (
          <Card>
            <h3 style={{ marginTop: 0 }}>Let&apos;s map your growth</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Run an AI skill-gap analysis against a target role to get your readiness score and a personalized learning path.
            </p>
            <form action={analyzeMySkills} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select name="target_role_id" defaultValue={careerRoles[0]?.id} style={{ width: 280 }}>
                {careerRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}{r.level ? ` (${r.level})` : ''}</option>
                ))}
              </Select>
              <Button type="submit">Analyze my skills</Button>
            </form>
          </Card>
        )
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Top row: readiness + path progress + stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ReadinessRing score={report.readiness_score} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Target role</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{targetRole?.title ?? '—'}</div>
                  {targetRole?.level && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{targetRole.level}</div>}
                  <form action={analyzeMySkills} style={{ marginTop: 10 }}>
                    <input type="hidden" name="target_role_id" value={report.target_role_id ?? ''} />
                    <Button type="submit" variant="secondary" style={{ fontSize: 13, padding: '6px 12px' }}>↻ Re-analyze</Button>
                  </form>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Active learning path</h3>
                <Link href="/learn/path" className="ui-link" style={{ fontSize: 13 }}>Open path →</Link>
              </div>
              {path ? (
                <>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{path.title}</div>
                  <div style={{ background: 'rgba(148,163,184,0.12)', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${items.length ? (done / items.length) * 100 : 0}%`, height: '100%', background: 'var(--grad)', borderRadius: 9999 }} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{done} of {items.length} steps completed</div>
                </>
              ) : (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>No active path yet.</p>
              )}
              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                <div><div style={{ fontSize: 22, fontWeight: 800 }}>{hours}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Learning hrs</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 800 }}>{completedCourses}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Courses done</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 800 }}>{certifications.length}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Certifications</div></div>
              </div>
            </Card>
          </div>

          {/* Skill gaps */}
          <Card>
            <h3 style={{ marginTop: 0 }}>Skill gaps</h3>
            {report.reasoning && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{report.reasoning}</p>}
            {(report.gaps ?? []).length === 0 ? (
              <p style={{ color: 'var(--success)' }}>No major gaps — you&apos;re on track! 🎉</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {(report.gaps ?? []).map((g) => (
                  <div key={g.competency}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{g.competency}</span>
                      <span style={{ color: 'var(--text-muted)' }}>level {g.current} / {g.required}</span>
                    </div>
                    <div style={{ background: 'rgba(148,163,184,0.12)', borderRadius: 9999, height: 8, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${(g.required / 5) * 100}%`, height: '100%', background: 'rgba(248,113,113,0.25)', position: 'absolute' }} />
                      <div style={{ width: `${(g.current / 5) * 100}%`, height: '100%', background: 'var(--grad)', borderRadius: 9999, position: 'absolute' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </PageShell>
  );
}

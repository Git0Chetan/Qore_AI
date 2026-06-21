import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { decideTrainingRequest } from '@/app/learn/actions';
import { Button, Card, PageShell } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Profile, SkillGapReport, TrainingRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

function gapColor(gap: number): string {
  if (gap <= 0) return 'rgba(52,211,153,0.30)'; // on track
  if (gap === 1) return 'rgba(251,191,36,0.30)';
  if (gap === 2) return 'rgba(248,113,113,0.30)';
  return 'rgba(248,113,113,0.55)';
}

export default async function TeamPage() {
  await requireRole(['hr_admin', 'super_admin']);
  const supabase = await createClient();

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('role', 'internal_employee');
  const employees = (profs ?? []) as Profile[];

  const { data: reps } = await supabase
    .from('skill_gap_reports')
    .select('employee_id, readiness_score, gaps, created_at')
    .order('created_at', { ascending: false });
  // Latest report per employee.
  const latest = new Map<string, SkillGapReport>();
  for (const r of (reps ?? []) as SkillGapReport[]) {
    if (!latest.has(r.employee_id)) latest.set(r.employee_id, r);
  }

  // Competency columns = most common gap competencies across the team.
  const freq = new Map<string, number>();
  for (const r of latest.values()) {
    for (const g of r.gaps ?? []) freq.set(g.competency, (freq.get(g.competency) ?? 0) + 1);
  }
  const columns = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);

  const { data: trs } = await supabase
    .from('training_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  const pending = (trs ?? []) as TrainingRequest[];
  const nameById = new Map(employees.map((e) => [e.id, e.name ?? e.email ?? '—']));

  const highPotential = employees
    .map((e) => ({ e, score: latest.get(e.id)?.readiness_score ?? null }))
    .filter((x) => (x.score ?? 0) >= 75)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <PageShell title="Team learning" subtitle="Skill gaps, readiness, and training approvals across your team.">
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Readiness + high potential */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <Card>
            <h3 style={{ marginTop: 0 }}>Promotion readiness</h3>
            {employees.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No internal employees yet.</p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {employees.map((e) => {
                const score = latest.get(e.id)?.readiness_score ?? 0;
                return (
                  <div key={e.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{e.name ?? e.email}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{latest.get(e.id) ? `${score}%` : 'no report'}</span>
                    </div>
                    <div style={{ background: 'rgba(148,163,184,0.12)', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, height: '100%', background: 'var(--grad)', borderRadius: 9999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>High-potential ⭐</h3>
            {highPotential.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No one at 75%+ readiness yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {highPotential.map(({ e, score }) => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>{e.name ?? e.email}</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>{score}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Skill heatmap */}
        <Card>
          <h3 style={{ marginTop: 0 }}>Skill gap heatmap</h3>
          {columns.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No gap data yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-muted)', fontWeight: 600 }}>Employee</th>
                    {columns.map((c) => (
                      <th key={c} style={{ padding: 8, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    const gaps = new Map((latest.get(e.id)?.gaps ?? []).map((g) => [g.competency, g.required - g.current]));
                    return (
                      <tr key={e.id}>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{e.name ?? e.email}</td>
                        {columns.map((c) => {
                          const gap = gaps.get(c);
                          return (
                            <td key={c} style={{ padding: 6, textAlign: 'center' }}>
                              <div style={{
                                width: 34, height: 24, margin: '0 auto', borderRadius: 6,
                                background: gap == null ? 'rgba(148,163,184,0.10)' : gapColor(gap),
                                color: 'var(--text)', fontSize: 12, lineHeight: '24px',
                              }}>{gap == null ? '·' : gap > 0 ? `-${gap}` : '✓'}</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pending nominations */}
        <Card>
          <h3 style={{ marginTop: 0 }}>Pending training nominations</h3>
          {pending.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No pending requests.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pending.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.title} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>· {nameById.get(r.employee_id)}</span></div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.type}{r.cost ? ` · ${r.cost}` : ''} · {formatDate(r.created_at)}</div>
                    {r.justification && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{r.justification}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <form action={decideTrainingRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <Button type="submit" style={{ fontSize: 13, padding: '6px 12px' }}>Approve</Button>
                    </form>
                    <form action={decideTrainingRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <Button type="submit" variant="danger" style={{ fontSize: 13, padding: '6px 12px' }}>Reject</Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

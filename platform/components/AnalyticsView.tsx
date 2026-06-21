import { Card } from '@/components/ui';
import type { Metrics } from '@/lib/analytics';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card hover>
      <div className="grad-text" style={{ fontSize: 32, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </Card>
  );
}

function Bar({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{value}{suffix}</span>
      </div>
      <div style={{ background: 'rgba(148,163,184,0.12)', borderRadius: 9999, height: 8, overflow: 'hidden' }}>
        <div
          style={{
            width: `${w}%`,
            height: '100%',
            background: 'var(--grad)',
            borderRadius: 9999,
            boxShadow: '0 0 12px rgba(34,211,238,0.5)',
          }}
        />
      </div>
    </div>
  );
}

export function AnalyticsView({ m }: { m: Metrics }) {
  const funnelMax = Math.max(1, ...m.funnel.map((f) => f.count));
  const distMax = Math.max(1, ...m.atsDistribution.map((d) => d.count));
  const gapMax = Math.max(1, ...m.skillGap.map((s) => s.count));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <Stat label="Total jobs" value={m.totalJobs} />
        <Stat label="Active jobs" value={m.activeJobs} />
        <Stat label="Applications" value={m.totalApplications} />
        <Stat label="Hired" value={m.hired} />
        <Stat label="Assessment success" value={`${m.assessmentSuccessRate}%`} />
        <Stat label="Avg ATS score" value={m.atsAverage} />
        <Stat label="Avg time-to-hire" value={m.avgTimeToHireDays != null ? `${m.avgTimeToHireDays}d` : '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Hiring funnel</h3>
          {m.funnel.map((f) => (
            <Bar key={f.label} label={f.label} value={f.count} max={funnelMax} />
          ))}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Conversion rates</h3>
          {m.conversion.map((c) => (
            <Bar key={c.label} label={c.label} value={c.rate} max={100} suffix="%" />
          ))}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>ATS score distribution</h3>
          {m.atsDistribution.map((d) => (
            <Bar key={d.bucket} label={d.bucket} value={d.count} max={distMax} />
          ))}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Skill gaps (rejected candidates)</h3>
          {m.skillGap.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No data yet.</p>
          ) : (
            m.skillGap.map((s) => <Bar key={s.skill} label={s.skill} value={s.count} max={gapMax} />)
          )}
        </Card>
      </div>
    </div>
  );
}

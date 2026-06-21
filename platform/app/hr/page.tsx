import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, PageShell } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Application, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  );
}

export default async function HrDashboard() {
  const supabase = await createClient();
  const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
  const { data: apps } = await supabase.from('applications').select('id, job_id, status, ats_score');

  const jobList = (jobs ?? []) as Job[];
  const appList = (apps ?? []) as Pick<Application, 'id' | 'job_id' | 'status' | 'ats_score'>[];

  const byJob = (jobId: string) => appList.filter((a) => a.job_id === jobId);

  return (
    <PageShell
      title="Recruitment dashboard"
      subtitle="Jobs, applications, and pipeline at a glance."
      action={
        <Link href="/hr/jobs/new">
          <Button>+ Post a job</Button>
        </Link>
      }
    >
      {jobList.length === 0 && (
        <Card>
          <p style={{ margin: 0, color: '#64748b' }}>
            No jobs yet. <Link href="/hr/jobs/new" className="ui-link">Post your first job</Link>.
          </p>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {jobList.map((job) => {
          const a = byJob(job.id);
          const qualified = a.filter((x) =>
            ['assessment_assigned', 'assessment_passed', 'hr_review', 'interview', 'offer', 'hired'].includes(x.status),
          ).length;
          const rejected = a.filter((x) => x.status === 'ats_rejected' || x.status === 'rejected' || x.status === 'assessment_failed').length;
          const hired = a.filter((x) => x.status === 'hired').length;

          return (
            <Card key={job.id} hover>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>{job.title}</h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 9999,
                        background: job.status === 'active' ? 'var(--success-bg)' : 'rgba(148,163,184,0.12)',
                        color: job.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${job.status === 'active' ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
                      }}
                    >
                      {job.status} · {job.visibility}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                    {job.department || '—'} · {job.location || '—'} · created {formatDate(job.created_at)}
                  </p>
                  {job.visibility === 'external' && job.public_slug && (
                    <p style={{ margin: '6px 0 0', fontSize: 12 }}>
                      Public URL: <Link href={`/jobs/${job.public_slug}`} className="ui-link">/jobs/{job.public_slug}</Link>
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <Metric label="Applicants" value={a.length} />
                  <Metric label="Qualified" value={qualified} />
                  <Metric label="Rejected" value={rejected} />
                  <Metric label="Hired" value={hired} />
                  <Link href={`/hr/jobs/${job.id}`}>
                    <Button variant="secondary">View pipeline</Button>
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}

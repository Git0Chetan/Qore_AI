import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { Card, PageShell } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PublicJobs() {
  const supabase = await createClient();
  const profile = await getProfile();

  // RLS returns active external jobs to everyone; active internal jobs to signed-in users.
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  const jobs = (data ?? []) as Job[];

  return (
    <PageShell
      title="Open roles"
      subtitle="Browse and apply to open positions."
      action={
        profile ? (
          <Link href="/candidate" className="ui-link">My dashboard →</Link>
        ) : (
          <Link href="/login" className="ui-link">Log in</Link>
        )
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {jobs.length === 0 && (
          <Card>
            <p style={{ margin: 0, color: '#64748b' }}>No open roles right now. Check back soon.</p>
          </Card>
        )}
        {jobs.map((job) => (
          <Link key={job.id} href={`/jobs/${job.public_slug}`}>
            <Card hover>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{job.title}</h3>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                    {job.department || '—'} · {job.location || '—'} · {job.employment_type || '—'}
                    {job.visibility === 'internal' && ' · Internal'}
                  </p>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
                  {(job.salary_min || job.salary_max) && (
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                      ₹{job.salary_min ?? '—'}–{job.salary_max ?? '—'}
                    </div>
                  )}
                  <div>Apply by {formatDate(job.deadline)}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

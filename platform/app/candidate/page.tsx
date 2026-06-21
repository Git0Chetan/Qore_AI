import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { Button, Card, PageShell, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Application, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CandidateDashboard() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: appsData } = await supabase
    .from('applications')
    .select('*')
    .eq('candidate_id', profile!.id)
    .order('created_at', { ascending: false });
  const apps = (appsData ?? []) as Application[];

  // Job titles for the applied list.
  const jobIds = apps.map((a) => a.job_id);
  const { data: jobsData } = jobIds.length
    ? await supabase.from('jobs').select('id, title').in('id', jobIds)
    : { data: [] };
  const jobTitle = new Map((jobsData as Pick<Job, 'id' | 'title'>[] | null ?? []).map((j) => [j.id, j.title]));

  // A few open roles to surface.
  const { data: openData } = await supabase
    .from('jobs')
    .select('id, title, public_slug, department, location')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5);
  const openJobs = (openData ?? []) as Pick<Job, 'id' | 'title' | 'public_slug' | 'department' | 'location'>[];

  return (
    <PageShell title={`Welcome, ${profile?.name || 'candidate'}`} subtitle="Track your applications and discover roles.">
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Applied jobs</h2>
      {apps.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: '#64748b' }}>
            You haven&apos;t applied to anything yet. <Link href="/jobs" className="ui-link">Browse jobs →</Link>
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {apps.map((a) => (
            <Card key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{jobTitle.get(a.job_id) || 'Job'}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Applied {formatDate(a.created_at)}</p>
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{a.ats_score ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>ATS</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{a.assessment_score ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Assessment</div>
                  </div>
                  <StatusBadge status={a.status} />
                  <Link href={`/candidate/applications/${a.id}`}>
                    <Button variant="secondary">View</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28 }}>Open roles</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {openJobs.map((j) => (
          <Link key={j.id} href={`/jobs/${j.public_slug}`}>
            <Card hover>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{j.title}</strong>
                <span style={{ fontSize: 13, color: '#64748b' }}>{j.department || '—'} · {j.location || '—'}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

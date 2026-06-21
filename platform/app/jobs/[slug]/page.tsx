import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { applyToJob } from '@/app/candidate/actions';
import { Button, Card, Field, Input, PageShell } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

export default async function JobDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: jobData } = await supabase.from('jobs').select('*').eq('public_slug', slug).single();
  if (!jobData) notFound();
  const job = jobData as Job;

  const profile = await getProfile();
  const isCandidate = profile?.role === 'external_candidate' || profile?.role === 'internal_employee';

  let alreadyApplied: string | null = null;
  if (profile) {
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', job.id)
      .eq('candidate_id', profile.id)
      .maybeSingle();
    alreadyApplied = existing?.id ?? null;
  }

  return (
    <PageShell title={job.title} subtitle={`${job.department || '—'} · ${job.location || '—'} · ${job.employment_type || '—'}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 20, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'flex', gap: 16, color: '#64748b', fontSize: 13, flexWrap: 'wrap' }}>
            <span>Experience: <b>{job.experience_required || '—'}</b></span>
            <span>Openings: <b>{job.openings}</b></span>
            <span>Apply by: <b>{formatDate(job.deadline)}</b></span>
          </div>
          {job.skills_required.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {job.skills_required.map((s) => (
                <span key={s} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 9999, border: '1px solid rgba(34,211,238,0.25)' }}>
                  {s}
                </span>
              ))}
            </div>
          )}
          <Section title="About the role" body={job.description} />
          <Section title="Responsibilities" body={job.responsibilities} />
          <Section title="Requirements" body={job.requirements} />
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Apply</h3>

          {!profile && (
            <p style={{ color: '#64748b', fontSize: 14 }}>
              <Link href={`/login?next=/jobs/${slug}`} className="ui-link">Log in</Link> or{' '}
              <Link href="/register" className="ui-link">create an account</Link> to apply.
            </p>
          )}

          {profile && !isCandidate && (
            <p style={{ color: '#64748b', fontSize: 14 }}>Sign in with a candidate account to apply.</p>
          )}

          {alreadyApplied && (
            <p style={{ fontSize: 14 }}>
              You&apos;ve already applied.{' '}
              <Link href={`/candidate/applications/${alreadyApplied}`} className="ui-link">
                View status →
              </Link>
            </p>
          )}

          {isCandidate && !alreadyApplied && (
            <form action={applyToJob}>
              <input type="hidden" name="job_id" value={job.id} />
              <Field label="Resume" hint="PDF, DOC, or DOCX">
                <Input type="file" name="resume" accept=".pdf,.doc,.docx" required />
              </Field>
              <Field label="Current company">
                <Input name="current_company" />
              </Field>
              <Field label="Current role">
                <Input name="current_role" />
              </Field>
              <Field label="Experience">
                <Input name="experience" placeholder="e.g. 4 years" />
              </Field>
              <Field label="Notice period">
                <Input name="notice_period" placeholder="e.g. 30 days" />
              </Field>
              <Field label="Expected salary">
                <Input name="expected_salary" />
              </Field>
              <Field label="Skills" hint="Comma-separated">
                <Input name="skills" placeholder="React, Node.js" />
              </Field>
              <Field label="LinkedIn">
                <Input name="linkedin" />
              </Field>
              <Field label="Portfolio / GitHub">
                <Input name="portfolio" />
              </Field>
              <Button type="submit" style={{ width: '100%' }}>
                Submit application
              </Button>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                Your resume is screened by AI immediately after submission.
              </p>
            </form>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, Input, PageShell, Select, StatusBadge, Textarea } from '@/components/ui';
import { formatDate, maskAadhaar } from '@/lib/utils';
import { STATUS_LABELS } from '@/lib/types';
import type { Application, ApplicationStatus, Interview, Job, Offer, Profile } from '@/lib/types';
import { addComment, releaseOffer, scheduleInterview, updateApplicationStatus } from '@/app/hr/jobs/actions';

export const dynamic = 'force-dynamic';

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

export default async function JobPipeline({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
  if (!jobData) notFound();
  const job = jobData as Job;

  const { data: appsData } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', id)
    .order('ats_score', { ascending: false, nullsFirst: false });
  const apps = (appsData ?? []) as Application[];

  // Candidate profiles + assessments + recent events.
  const candidateIds = apps.map((a) => a.candidate_id);
  const appIds = apps.map((a) => a.id);
  const { data: profilesData } = candidateIds.length
    ? await supabase.from('profiles').select('*').in('id', candidateIds)
    : { data: [] };
  const profiles = new Map((profilesData as Profile[] | null ?? []).map((p) => [p.id, p]));

  const { data: assessData } = appIds.length
    ? await supabase.from('assessments').select('*').in('application_id', appIds)
    : { data: [] };
  const assessByApp = new Map((assessData ?? []).map((x: { application_id: string }) => [x.application_id, x]));

  const { data: interviewData } = appIds.length
    ? await supabase.from('interviews').select('*').in('application_id', appIds).order('scheduled_at', { ascending: false })
    : { data: [] };
  const interviewByApp = new Map<string, Interview>();
  for (const iv of (interviewData ?? []) as Interview[]) {
    if (!interviewByApp.has(iv.application_id)) interviewByApp.set(iv.application_id, iv);
  }

  const { data: offerData } = appIds.length
    ? await supabase.from('offers').select('*').in('application_id', appIds).order('created_at', { ascending: false })
    : { data: [] };
  const offerByApp = new Map<string, Offer>();
  for (const ofr of (offerData ?? []) as Offer[]) {
    if (!offerByApp.has(ofr.application_id)) offerByApp.set(ofr.application_id, ofr);
  }

  // Signed URLs for resumes.
  const resumeUrls = new Map<string, string>();
  for (const a of apps) {
    if (a.resume_url) {
      const { data } = await supabase.storage.from('resumes').createSignedUrl(a.resume_url, 3600);
      if (data?.signedUrl) resumeUrls.set(a.id, data.signedUrl);
    }
  }

  return (
    <PageShell
      title={job.title}
      subtitle={`${apps.length} applicant(s) · ATS threshold ${job.ats_threshold} · Test threshold ${job.test_threshold}`}
      action={
        <Link href="/hr">
          <Button variant="secondary">← Back</Button>
        </Link>
      }
    >
      {apps.length === 0 && (
        <Card>
          <p style={{ margin: 0, color: '#64748b' }}>No applications yet.</p>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {apps.map((a) => {
          const p = profiles.get(a.candidate_id);
          const assess = assessByApp.get(a.id) as { overall_score?: number; proctoring_integrity_score?: number; violations?: unknown } | undefined;
          const atsPass = a.ats_score != null && a.ats_score >= job.ats_threshold;

          return (
            <Card key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 220 }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{p?.name || 'Candidate'}</h3>
                  <p style={{ margin: '2px 0', fontSize: 13, color: '#64748b' }}>{p?.email}</p>
                  <p style={{ margin: '2px 0', fontSize: 13, color: '#64748b' }}>
                    Aadhaar: {maskAadhaar(p?.aadhaar ?? null)}
                  </p>
                  <p style={{ margin: '2px 0', fontSize: 13, color: '#64748b' }}>Applied {formatDate(a.created_at)}</p>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={a.status} />
                  </div>
                  {resumeUrls.get(a.id) && (
                    <p style={{ marginTop: 8 }}>
                      <a href={resumeUrls.get(a.id)} target="_blank" rel="noreferrer" className="ui-link" style={{ fontSize: 13 }}>
                        ↓ Download resume
                      </a>
                    </p>
                  )}
                </div>

                {/* ATS */}
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>ATS analysis</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: atsPass ? 'var(--success)' : 'var(--danger)' }}>
                    {a.ats_score ?? '—'}{a.ats_score != null && '/100'}
                  </div>
                  {a.ats_breakdown && (
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                      {Object.entries(a.ats_breakdown).map(([k, v]) => (
                        <span key={k} style={{ marginRight: 10 }}>{k}: <b>{v as number}</b></span>
                      ))}
                    </div>
                  )}
                  {a.ats_reasoning && (
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{a.ats_reasoning}</p>
                  )}
                </div>

                {/* Assessment */}
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Assessment</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>
                    {a.assessment_score ?? assess?.overall_score ?? '—'}
                    {(a.assessment_score ?? assess?.overall_score) != null && '/100'}
                  </div>
                  {assess?.proctoring_integrity_score != null && (
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                      Integrity: {assess.proctoring_integrity_score}/100
                    </p>
                  )}
                  {Array.isArray(assess?.violations) && assess!.violations.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', margin: '2px 0 0' }}>
                      {assess!.violations.length} violation(s)
                    </p>
                  )}
                </div>
              </div>

              {/* HR actions */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <form action={updateApplicationStatus} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <Select name="status" defaultValue={a.status} style={{ width: 200 }}>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </Select>
                  <Button type="submit" variant="secondary">Move stage</Button>
                </form>
                <form action={updateApplicationStatus}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <Button type="submit" variant="danger">Reject</Button>
                </form>
                <form action={addComment} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <Textarea name="comment" placeholder="Add a comment…" rows={1} style={{ minHeight: 38, flex: 1 }} />
                  <Button type="submit" variant="secondary">Comment</Button>
                </form>
              </div>

              {/* Interview + offer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Schedule interview</div>
                  {interviewByApp.get(a.id) && (
                    <p style={{ fontSize: 12, color: 'var(--accent)', margin: '0 0 6px' }}>
                      Current: {new Date(interviewByApp.get(a.id)!.scheduled_at).toLocaleString('en-IN')} · {interviewByApp.get(a.id)!.mode}
                    </p>
                  )}
                  <form action={scheduleInterview} style={{ display: 'grid', gap: 8 }}>
                    <input type="hidden" name="application_id" value={a.id} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input type="datetime-local" name="scheduled_at" required style={{ flex: 1 }} />
                      <Select name="mode" defaultValue="video" style={{ width: 110 }}>
                        <option value="video">Video</option>
                        <option value="phone">Phone</option>
                        <option value="onsite">Onsite</option>
                      </Select>
                    </div>
                    <Input name="location" placeholder="Meeting link or address" />
                    <Button type="submit" variant="secondary">Schedule</Button>
                  </form>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Release offer</div>
                  {offerByApp.get(a.id) && (
                    <p style={{ fontSize: 12, color: 'var(--success)', margin: '0 0 6px' }}>
                      Current: {offerByApp.get(a.id)!.salary || '—'} · status {offerByApp.get(a.id)!.status}
                    </p>
                  )}
                  <form action={releaseOffer} style={{ display: 'grid', gap: 8 }}>
                    <input type="hidden" name="application_id" value={a.id} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input name="salary" placeholder="Salary (₹/yr)" style={{ flex: 1 }} />
                      <Input type="date" name="joining_date" style={{ width: 150 }} />
                    </div>
                    <Input name="notes" placeholder="Notes (optional)" />
                    <Button type="submit">Release offer</Button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}

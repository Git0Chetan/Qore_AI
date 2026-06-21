import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, PageShell, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { respondToOffer } from '@/app/candidate/actions';
import type { Application, ApplicationEvent, Interview, Job, Offer } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: appData } = await supabase.from('applications').select('*').eq('id', id).single();
  if (!appData) notFound();
  const app = appData as Application;

  const { data: jobData } = await supabase.from('jobs').select('*').eq('id', app.job_id).single();
  const job = jobData as Job | null;

  const { data: eventsData } = await supabase
    .from('application_events')
    .select('*')
    .eq('application_id', id)
    .order('created_at', { ascending: true });
  const events = (eventsData ?? []) as ApplicationEvent[];

  const { data: interviewData } = await supabase
    .from('interviews')
    .select('*')
    .eq('application_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(1);
  const interview = (interviewData?.[0] ?? null) as Interview | null;

  const { data: offerData } = await supabase
    .from('offers')
    .select('*')
    .eq('application_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
  const offer = (offerData?.[0] ?? null) as Offer | null;

  const canTakeAssessment = app.status === 'assessment_assigned';
  const maxInterviewAttempts = Number(process.env.INTERVIEW_MAX_ATTEMPTS ?? 2);
  const interviewAttemptsLeft = Math.max(0, maxInterviewAttempts - (app.interview_attempts ?? 0));

  return (
    <PageShell
      title={job?.title || 'Application'}
      subtitle={`Applied ${formatDate(app.created_at)}`}
      action={<Link href="/candidate"><Button variant="secondary">← Dashboard</Button></Link>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
        {/* Left: status + scores + assessment CTA */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Current status</div>
                <div style={{ marginTop: 6 }}>
                  <StatusBadge status={app.status} />
                </div>
              </div>
              {canTakeAssessment && (
                <Link href={`/candidate/applications/${id}/assessment`}>
                  <Button>Start assessment →</Button>
                </Link>
              )}
            </div>
            {app.status === 'assessment_passed' && (
              <div style={{ marginTop: 14 }}>
                <p style={{ color: 'var(--success)', fontWeight: 600, marginTop: 0 }}>
                  🎉 Congratulations! You passed the assessment. You can now take the AI voice interview.
                </p>
                {interviewAttemptsLeft > 0 ? (
                  <>
                    <Link href={`/candidate/applications/${id}/interview`}>
                      <Button>Start AI interview →</Button>
                    </Link>
                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                      {interviewAttemptsLeft} of {maxInterviewAttempts} attempt(s) remaining.
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 600 }}>
                    You have used all {maxInterviewAttempts} interview attempt(s). Our team will review your results.
                  </p>
                )}
              </div>
            )}
            {(app.status === 'ats_rejected' || app.status === 'assessment_failed' || app.status === 'rejected') && (
              <p style={{ marginTop: 14, color: 'var(--danger)', fontWeight: 600 }}>
                Thank you for your interest. Your application did not advance to the next round.
              </p>
            )}
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>AI resume screening</h3>
            {app.ats_score == null ? (
              <p style={{ color: '#64748b' }}>Screening in progress…</p>
            ) : (
              <>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{app.ats_score}/100</div>
                {app.ats_breakdown && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    {Object.entries(app.ats_breakdown).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 12, background: 'rgba(148,163,184,0.1)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 9999 }}>
                        {k}: <b style={{ color: 'var(--text)' }}>{v as number}</b>
                      </span>
                    ))}
                  </div>
                )}
                {app.ats_reasoning && <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>{app.ats_reasoning}</p>}
              </>
            )}
          </Card>

          {app.assessment_score != null && (
            <Card>
              <h3 style={{ marginTop: 0 }}>Assessment</h3>
              <div style={{ fontSize: 36, fontWeight: 900 }}>{app.assessment_score}/100</div>
            </Card>
          )}

          {interview && (
            <Card>
              <h3 style={{ marginTop: 0 }}>Interview</h3>
              <p style={{ margin: 0, fontWeight: 700 }}>{new Date(interview.scheduled_at).toLocaleString('en-IN')}</p>
              <p style={{ margin: '4px 0', color: '#64748b', fontSize: 14 }}>Mode: {interview.mode}</p>
              {interview.location && (
                <p style={{ margin: 0, fontSize: 14 }}>
                  Details: <span style={{ color: 'var(--accent)' }}>{interview.location}</span>
                </p>
              )}
            </Card>
          )}

          {offer && (
            <Card>
              <h3 style={{ marginTop: 0 }}>Offer</h3>
              <p style={{ margin: 0 }}>Salary: <b>{offer.salary || '—'}</b></p>
              <p style={{ margin: '4px 0' }}>Joining date: <b>{formatDate(offer.joining_date)}</b></p>
              {offer.notes && <p style={{ margin: '4px 0', color: '#64748b', fontSize: 14 }}>{offer.notes}</p>}
              <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#64748b' }}>Status: {offer.status}</p>
              {offer.status === 'released' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <form action={respondToOffer}>
                    <input type="hidden" name="offer_id" value={offer.id} />
                    <input type="hidden" name="application_id" value={id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <Button type="submit">Accept offer</Button>
                  </form>
                  <form action={respondToOffer}>
                    <input type="hidden" name="offer_id" value={offer.id} />
                    <input type="hidden" name="application_id" value={id} />
                    <input type="hidden" name="decision" value="declined" />
                    <Button type="submit" variant="danger">Decline</Button>
                  </form>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: timeline */}
        <Card>
          <h3 style={{ marginTop: 0 }}>Status timeline</h3>
          <div style={{ display: 'grid', gap: 0 }}>
            {events.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>No activity yet.</p>}
            {events.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 11, height: 11, borderRadius: 9999, background: 'var(--accent)', marginTop: 4, boxShadow: '0 0 10px rgba(34,211,238,0.6)' }} />
                  {i < events.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 24 }} />}
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.message || e.type}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(e.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

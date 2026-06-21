import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { submitTrainingRequest } from '@/app/learn/actions';
import { Button, Card, Field, Input, PageShell, Select, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { TrainingRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pending: { bg: 'rgba(251,191,36,0.14)', fg: '#fbbf24' },
  approved: { bg: 'rgba(52,211,153,0.14)', fg: '#34d399' },
  rejected: { bg: 'rgba(248,113,113,0.14)', fg: '#f87171' },
};

export default async function RequestsPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data } = await supabase
    .from('training_requests')
    .select('*')
    .eq('employee_id', profile!.id)
    .order('created_at', { ascending: false });
  const requests = (data ?? []) as TrainingRequest[];

  return (
    <PageShell title="Training nominations" subtitle="Request trainings, certifications, workshops, or conferences.">
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>New request</h3>
          <form action={submitTrainingRequest}>
            <Field label="Type">
              <Select name="type" defaultValue="training">
                <option value="training">Training</option>
                <option value="certification">Certification</option>
                <option value="workshop">Workshop</option>
                <option value="conference">Conference</option>
              </Select>
            </Field>
            <Field label="Title">
              <Input name="title" placeholder="e.g. AWS Solutions Architect" required />
            </Field>
            <Field label="Justification">
              <Textarea name="justification" rows={3} placeholder="How this helps your role / growth" />
            </Field>
            <Field label="Estimated cost (optional)">
              <Input name="cost" placeholder="e.g. ₹15,000" />
            </Field>
            <Button type="submit" style={{ width: '100%' }}>Submit request</Button>
          </form>
        </Card>

        <div style={{ display: 'grid', gap: 12 }}>
          {requests.length === 0 && (
            <Card><p style={{ margin: 0, color: 'var(--text-muted)' }}>No requests yet.</p></Card>
          )}
          {requests.map((r) => {
            const c = STATUS_COLOR[r.status] ?? STATUS_COLOR.pending;
            return (
              <Card key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {r.type} · {formatDate(r.created_at)}{r.cost ? ` · ${r.cost}` : ''}
                    </div>
                    {r.justification && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>{r.justification}</p>}
                  </div>
                  <span style={{ alignSelf: 'flex-start', padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>
                    {r.status}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}

import { createClient } from '@/lib/supabase/server';
import { computeMetrics } from '@/lib/analytics';
import { AnalyticsView } from '@/components/AnalyticsView';
import { PageShell } from '@/components/ui';
import type { Application, ApplicationEvent, Job } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HrAnalytics() {
  const supabase = await createClient();
  const [{ data: jobs }, { data: apps }, { data: events }] = await Promise.all([
    supabase.from('jobs').select('*'),
    supabase.from('applications').select('*'),
    supabase.from('application_events').select('*'),
  ]);

  const metrics = computeMetrics(
    (jobs ?? []) as Job[],
    (apps ?? []) as Application[],
    (events ?? []) as ApplicationEvent[],
  );

  return (
    <PageShell title="Reporting & analytics" subtitle="Hiring funnel, conversion, and AI screening metrics.">
      <AnalyticsView m={metrics} />
    </PageShell>
  );
}

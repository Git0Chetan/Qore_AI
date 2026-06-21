import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { startAssessment } from '@/app/candidate/actions';
import { Card, PageShell } from '@/components/ui';
import { IdentityCheck } from '@/components/IdentityCheck';
import type { Application } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AssessmentLaunch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: appData } = await supabase.from('applications').select('*').eq('id', id).single();
  if (!appData) notFound();
  const app = appData as Application;

  if (app.candidate_id !== profile?.id) redirect('/candidate');
  if (app.status !== 'assessment_assigned') redirect(`/candidate/applications/${id}`);

  return (
    <PageShell title="Identity verification" subtitle="Confirm your identity to start the proctored assessment.">
      <div style={{ maxWidth: 520 }}>
        <Card>
          <IdentityCheck applicationId={id} action={startAssessment} />
        </Card>
      </div>
    </PageShell>
  );
}

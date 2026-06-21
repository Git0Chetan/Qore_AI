import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { updateOrgSettings } from '@/app/admin/actions';
import { Button, Card, Field, Input, PageShell } from '@/components/ui';
import type { OrgSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, fontSize: 14 }}>
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

export default async function AdminSettings() {
  const supabase = await createClient();
  const me = await getProfile();

  let settings: OrgSettings = {};
  let orgName = '—';
  if (me?.org_id) {
    const { data } = await supabase.from('organizations').select('name, settings').eq('id', me.org_id).single();
    settings = (data?.settings as OrgSettings) ?? {};
    orgName = data?.name ?? '—';
  }

  return (
    <PageShell title="Organization settings" subtitle={orgName}>
      <div style={{ maxWidth: 560 }}>
        <Card>
          {!me?.org_id ? (
            <p style={{ color: '#64748b', margin: 0 }}>
              No organization yet. Have an HR user post a job first — that creates the organization.
            </p>
          ) : (
            <form action={updateOrgSettings}>
              <h3 style={{ marginTop: 0 }}>Default thresholds</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Default ATS threshold" hint="Suggested for new jobs">
                  <Input type="number" name="default_ats_threshold" min={0} max={100} defaultValue={settings.default_ats_threshold ?? 60} />
                </Field>
                <Field label="Default test threshold">
                  <Input type="number" name="default_test_threshold" min={0} max={100} defaultValue={settings.default_test_threshold ?? 60} />
                </Field>
              </div>

              <h3>Notification events</h3>
              <Toggle name="notify_application_submitted" label="Application submitted" checked={settings.notify_application_submitted ?? true} />
              <Toggle name="notify_ats" label="ATS passed / failed" checked={settings.notify_ats ?? true} />
              <Toggle name="notify_assessment" label="Assessment passed / failed" checked={settings.notify_assessment ?? true} />
              <Toggle name="notify_interview" label="Interview scheduled" checked={settings.notify_interview ?? true} />
              <Toggle name="notify_offer" label="Offer released" checked={settings.notify_offer ?? true} />

              <Button type="submit" style={{ marginTop: 12 }}>Save settings</Button>
            </form>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

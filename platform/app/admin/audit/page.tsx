import { createClient } from '@/lib/supabase/server';
import { Card, PageShell } from '@/components/ui';
import type { AuditLog } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminAudit() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  const logs = (data ?? []) as AuditLog[];

  return (
    <PageShell title="Audit log" subtitle="Recent administrative and pipeline actions.">
      <Card>
        {logs.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No audit entries yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 0 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{l.action}</span>
                  {l.target_type && <span style={{ color: '#64748b' }}> · {l.target_type}</span>}
                  {l.detail && (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{JSON.stringify(l.detail)}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {new Date(l.created_at).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
}

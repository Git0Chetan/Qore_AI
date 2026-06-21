import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { updateUserRole } from '@/app/admin/actions';
import { Button, Card, PageShell, Select } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Profile, UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hr_admin', label: 'HR / Admin' },
  { value: 'internal_employee', label: 'Internal Employee' },
  { value: 'external_candidate', label: 'External Candidate' },
];

export default async function AdminUsers() {
  const supabase = await createClient();
  const me = await getProfile();
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  const users = (data ?? []) as Profile[];

  return (
    <PageShell title="Users" subtitle="Manage roles for everyone in the platform.">
      <div style={{ display: 'grid', gap: 12 }}>
        {users.map((u) => (
          <Card key={u.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{u.name || '—'}</strong>
                <span style={{ color: '#64748b', fontSize: 13 }}> · {u.email}</span>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Joined {formatDate(u.created_at)}</div>
              </div>
              {u.id === me?.id ? (
                <span style={{ fontSize: 13, color: '#64748b' }}>You ({u.role})</span>
              ) : (
                <form action={updateUserRole} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <Select name="role" defaultValue={u.role} style={{ width: 200 }}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </Select>
                  <Button type="submit" variant="secondary">Update</Button>
                </form>
              )}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

import { requireRole } from '@/lib/auth';
import { TopNav } from '@/components/TopNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['super_admin']);
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav
        profile={profile}
        links={[
          { href: '/admin', label: 'Overview' },
          { href: '/admin/users', label: 'Users' },
          { href: '/admin/settings', label: 'Org settings' },
          { href: '/admin/audit', label: 'Audit log' },
        ]}
      />
      {children}
    </div>
  );
}

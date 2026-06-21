import { requireRole } from '@/lib/auth';
import { TopNav } from '@/components/TopNav';

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['hr_admin', 'super_admin']);
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav
        profile={profile}
        links={[
          { href: '/hr', label: 'Dashboard' },
          { href: '/hr/jobs/new', label: 'Post a job' },
          { href: '/hr/analytics', label: 'Analytics' },
          { href: '/learn/team', label: 'Learning' },
        ]}
      />
      {children}
    </div>
  );
}

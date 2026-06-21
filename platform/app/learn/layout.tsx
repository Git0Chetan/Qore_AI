import { requireRole } from '@/lib/auth';
import { TopNav } from '@/components/TopNav';

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['internal_employee', 'hr_admin', 'super_admin']);
  const isManager = profile.role === 'hr_admin' || profile.role === 'super_admin';

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav
        profile={profile}
        links={[
          { href: '/learn', label: 'My Learning' },
          { href: '/learn/path', label: 'Learning Path' },
          { href: '/learn/buddy', label: 'Career Buddy' },
          { href: '/learn/parser', label: 'Doc Parser' },
          { href: '/learn/requests', label: 'Nominations' },
          ...(isManager ? [{ href: '/learn/team', label: 'Team' }] : []),
          { href: isManager ? '/hr' : '/candidate', label: isManager ? '← Hiring' : '← Jobs' },
        ]}
      />
      {children}
    </div>
  );
}

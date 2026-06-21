import { requireRole } from '@/lib/auth';
import { TopNav } from '@/components/TopNav';

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['external_candidate', 'internal_employee']);
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav
        profile={profile}
        links={[
          { href: '/candidate', label: 'Dashboard' },
          { href: '/jobs', label: 'Browse jobs' },
          ...(profile.role === 'internal_employee'
            ? [{ href: '/learn', label: 'Learning' }]
            : []),
        ]}
      />
      {children}
    </div>
  );
}

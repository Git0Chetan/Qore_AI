import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile, homePathForRole } from '@/lib/auth';
import { Button } from '@/components/ui';

export default async function Home() {
  const profile = await getProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="ui-fade-in" style={{ maxWidth: 560, textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 9999,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            fontSize: 13,
            color: 'var(--text-muted)',
            marginBottom: 28,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--accent)' }} />
          AI-powered recruitment
        </span>

        <h1 style={{ fontSize: 56, fontWeight: 800, margin: 0, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
          Hire smarter with <span className="grad-text">Qore AI</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 18, marginTop: 18, lineHeight: 1.6 }}>
          Post jobs, screen resumes with AI, and run proctored assessments and voice
          interviews — all in one place.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <Link href="/login">
            <Button>Log in</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary">Create account</Button>
          </Link>
          <Link href="/jobs">
            <Button variant="secondary">Browse jobs</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

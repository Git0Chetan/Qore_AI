import Link from 'next/link';
import type { Profile } from '@/lib/types';

type NavLink = { href: string; label: string };

export function TopNav({ profile, links }: { profile: Profile; links: NavLink[] }) {
  const initial = (profile.name || profile.email || '?').charAt(0).toUpperCase();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(7, 11, 20, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          maxWidth: 1140,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 17 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'var(--grad)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#051018',
              fontWeight: 900,
            }}
          >
            Q
          </span>
          <span className="grad-text">Qore AI</span>
        </Link>

        <nav style={{ display: 'flex', gap: 6, flex: 1 }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 8,
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{profile.name || profile.email}</span>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--accent)',
          }}
        >
          {initial}
        </span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="ui-btn ui-btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

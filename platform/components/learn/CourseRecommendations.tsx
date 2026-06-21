'use client';

import { useState } from 'react';
import type { Course } from '@/lib/types';

const PROVIDER_LABEL: Record<string, string> = {
  youtube: '▶ YouTube',
  linkedin: 'in LinkedIn',
  percipio: 'Percipio',
  lms: 'Internal LMS',
};

// Lazy-loads cross-provider learning recommendations for a skill/topic.
export function CourseRecommendations({ query }: { query: string }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/learn/recommend?competency=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCourses(Array.isArray(data?.courses) ? data.courses : []);
    } catch {
      setCourses([]);
    }
    setLoading(false);
  };

  if (courses === null) {
    return (
      <button
        onClick={load}
        disabled={loading}
        className="ui-link"
        style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {loading ? 'Finding resources…' : '✨ Recommend resources'}
      </button>
    );
  }

  if (courses.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>No resources found.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      {courses.map((c) => (
        <a
          key={c.id}
          href={c.url ?? '#'}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--text)' }}>{c.title}</span>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{PROVIDER_LABEL[c.provider] ?? c.provider}</span>
        </a>
      ))}
    </div>
  );
}

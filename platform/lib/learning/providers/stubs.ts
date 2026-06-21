import type { Course } from '@/lib/types';

// LinkedIn Learning and Percipio require enterprise API access/contracts. Until
// those credentials exist, these adapters return curated, deterministic results
// in the same Course shape so the UI and ranking work end-to-end. Swap the body
// for a real API call when credentials are available.

export function searchLinkedIn(query: string): Course[] {
  return [
    {
      id: `linkedin:${slug(query)}-1`,
      provider: 'linkedin',
      external_id: `${slug(query)}-essentials`,
      title: `${query}: Essential Training`,
      url: 'https://www.linkedin.com/learning/',
      description: 'LinkedIn Learning · curated suggestion',
      skills: [query],
      duration_minutes: 180,
      level: 'Beginner',
    },
    {
      id: `linkedin:${slug(query)}-2`,
      provider: 'linkedin',
      external_id: `${slug(query)}-advanced`,
      title: `Advanced ${query}`,
      url: 'https://www.linkedin.com/learning/',
      description: 'LinkedIn Learning · curated suggestion',
      skills: [query],
      duration_minutes: 240,
      level: 'Advanced',
    },
  ];
}

export function searchPercipio(query: string): Course[] {
  return [
    {
      id: `percipio:${slug(query)}-1`,
      provider: 'percipio',
      external_id: `${slug(query)}-track`,
      title: `${query} Skill Track`,
      url: 'https://percipio.com/',
      description: 'Percipio · curated suggestion',
      skills: [query],
      duration_minutes: 300,
      level: 'Intermediate',
    },
  ];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

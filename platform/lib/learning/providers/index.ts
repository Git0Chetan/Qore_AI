import { createAdminClient } from '@/lib/supabase/admin';
import type { Course } from '@/lib/types';
import { searchYouTube } from './youtube';
import { searchLinkedIn, searchPercipio } from './stubs';

// Internal LMS catalog: courses stored in the DB tagged provider='lms'.
async function searchLms(query: string): Promise<Course[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('courses')
      .select('*')
      .eq('provider', 'lms')
      .overlaps('skills', [query])
      .limit(4);
    return (data ?? []) as Course[];
  } catch {
    return [];
  }
}

// Aggregate recommendations across all providers for a skill/competency query.
// Live YouTube first, then internal LMS, then curated LinkedIn/Percipio.
export async function recommendCourses(query: string): Promise<Course[]> {
  const [yt, lms] = await Promise.all([searchYouTube(query, 4), searchLms(query)]);
  const merged: Course[] = [...yt, ...lms, ...searchLinkedIn(query), ...searchPercipio(query)];

  // De-dupe by title, cap the list.
  const seen = new Set<string>();
  const out: Course[] = [];
  for (const c of merged) {
    const key = c.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, 8);
}

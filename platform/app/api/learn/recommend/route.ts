import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recommendCourses } from '@/lib/learning/providers';

export const dynamic = 'force-dynamic';

// Recommend learning content for a competency/skill across providers.
export async function GET(req: Request) {
  const competency = new URL(req.url).searchParams.get('competency');
  if (!competency) return NextResponse.json({ error: 'competency required' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const courses = await recommendCourses(competency);
  return NextResponse.json({ courses });
}

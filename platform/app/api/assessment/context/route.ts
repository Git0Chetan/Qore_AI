import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAssessmentToken } from '@/lib/assessment-token';
import { corsJson, corsPreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight();
}

// Returns JD context for the quiz app to generate assessment questions from.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || '';
  const payload = verifyAssessmentToken(token);
  if (!payload) return corsJson({ error: 'Invalid or expired token' }, 401);

  const admin = createAdminClient();
  const { data: job } = await admin
    .from('jobs')
    .select('title, description, requirements, responsibilities, skills_required, experience_required, test_threshold')
    .eq('id', payload.jobId)
    .single();
  if (!job) return corsJson({ error: 'Job not found' }, 404);

  return corsJson({
    applicationId: payload.applicationId,
    jobTitle: job.title,
    jobDescription: [job.description, job.requirements, job.responsibilities].filter(Boolean).join('\n'),
    skills: job.skills_required,
    experienceRequired: job.experience_required,
    testThreshold: job.test_threshold,
  });
}

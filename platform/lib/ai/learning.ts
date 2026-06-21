import { chatJSON, chatText } from '@/lib/ai/groq';
import type { CareerRole, SkillGap } from '@/lib/types';

// Context assembled by the caller from the employee's profile, resume, assessments,
// current/target role and the org competency framework.
export type SkillContext = {
  name: string;
  currentRole: string;
  aspiration: string;
  targetRole: CareerRole;
  requiredCompetencies: { name: string; required_level: number }[];
  knownSkills: { name: string; level: number }[];
  resumeSkills: string[];
  assessmentScores: { label: string; score: number }[];
};

export type SkillGapResult = {
  readiness_score: number;
  gaps: SkillGap[];
  reasoning: string;
};

// AI skill-gap analysis -> Skill Readiness Score (0-100) + per-competency gaps.
export async function analyzeSkillGap(ctx: SkillContext): Promise<SkillGapResult> {
  const raw = await chatJSON<SkillGapResult>(
    [
      {
        role: 'system',
        content:
          'You are a career development analyst. Compare an employee to the competencies ' +
          'required for their target role and produce a JSON object: ' +
          '{ "readiness_score": <0-100>, "gaps": [{ "competency": string, "current": <0-5>, "required": <0-5> }], ' +
          '"reasoning": "2-4 sentences" }. ' +
          'readiness_score reflects how close they are overall. Only list competencies where current < required. JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          employee: ctx.name,
          currentRole: ctx.currentRole,
          aspiration: ctx.aspiration,
          targetRole: `${ctx.targetRole.title}${ctx.targetRole.level ? ` (${ctx.targetRole.level})` : ''}`,
          requiredCompetencies: ctx.requiredCompetencies,
          knownSkills: ctx.knownSkills,
          resumeSkills: ctx.resumeSkills,
          assessmentScores: ctx.assessmentScores,
        }),
      },
    ],
    { temperature: 0 },
  );

  if (!raw) {
    return { readiness_score: 0, gaps: [], reasoning: 'AI analysis unavailable.' };
  }
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.readiness_score) || 0)));
  const gaps = Array.isArray(raw.gaps)
    ? raw.gaps
        .filter((g) => g && typeof g.competency === 'string')
        .map((g) => ({
          competency: g.competency,
          current: Math.max(0, Math.min(5, Math.round(Number(g.current) || 0))),
          required: Math.max(0, Math.min(5, Math.round(Number(g.required) || 0))),
        }))
    : [];
  return { readiness_score: score, gaps, reasoning: raw.reasoning ?? '' };
}

export type GeneratedPathItem = { title: string; competency: string };

// Generate an ordered learning path from the identified gaps.
export async function generateLearningPath(
  gaps: SkillGap[],
  targetRole: CareerRole,
): Promise<GeneratedPathItem[]> {
  const raw = await chatJSON<{ items: GeneratedPathItem[] }>(
    [
      {
        role: 'system',
        content:
          'You are a learning designer. Given skill gaps and a target role, produce an ordered ' +
          'learning path as JSON: { "items": [{ "title": string, "competency": string }] }. ' +
          'Order from foundational to advanced. 4-7 items. "competency" must match one of the gap competencies. JSON only.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          targetRole: `${targetRole.title}${targetRole.level ? ` (${targetRole.level})` : ''}`,
          gaps,
        }),
      },
    ],
    { temperature: 0.3 },
  );
  return Array.isArray(raw?.items)
    ? raw!.items.filter((i) => i && typeof i.title === 'string').slice(0, 8)
    : [];
}

// Context for a Career Buddy answer.
export type BuddyContext = {
  name: string;
  currentRole: string;
  aspiration: string;
  targetRole: string;
  readinessScore: number | null;
  gaps: SkillGap[];
  pathItems: { title: string; status: string }[];
  openRoles: string[];
};

// Grounded conversational reply for the AI Career Buddy (text channel).
export async function careerBuddyReply(
  ctx: BuddyContext,
  history: { role: 'user' | 'assistant'; content: string }[],
  question: string,
): Promise<string> {
  const system =
    'You are "Career Buddy", a warm, concise career mentor for an internal employee. ' +
    'Use ONLY the provided context to give specific, actionable guidance about learning, ' +
    'skills, promotion readiness, certifications, and internal opportunities. ' +
    'Keep answers under ~120 words. If asked about promotion readiness, reference the readiness score and gaps.\n\n' +
    `CONTEXT:\n${JSON.stringify(ctx)}`;

  const reply = await chatText(
    [
      { role: 'system', content: system },
      ...history.slice(-8),
      { role: 'user', content: question },
    ],
    { temperature: 0.5 },
  );
  return reply ?? "I'm having trouble reaching the AI service right now. Please try again.";
}

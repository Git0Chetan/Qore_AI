import mammoth from 'mammoth';
import { chatJSON } from '@/lib/ai/groq';
import type { AtsBreakdown, Job, ParsedResume } from '@/lib/types';

// Max points per ATS category (sum = 100). Used to bound the model's output.
const WEIGHTS: AtsBreakdown = {
  skill: 30,
  experience: 25,
  education: 10,
  domain: 15,
  keyword: 10,
  project: 10,
};

// Extract plain text from an uploaded resume (PDF / DOCX). Best-effort.
export async function extractResumeText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  try {
    if (lower.endsWith('.pdf')) {
      // Import the lib entry directly: the package's index.js runs a debug
      // self-test (reads a sample PDF) when bundled, which throws.
      // @ts-expect-error - deep import has no type declarations
      const mod = await import('pdf-parse/lib/pdf-parse.js');
      const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      return result.text || '';
    }
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      return buffer.toString('utf8');
    }
  } catch (err) {
    console.error('[extractResumeText] failed for', filename, err);
  }
  // Last-resort fallback for unknown types.
  return buffer.toString('utf8');
}

// Structured extraction of resume fields.
export async function parseResume(resumeText: string): Promise<ParsedResume> {
  const parsed = await chatJSON<ParsedResume>(
    [
      {
        role: 'system',
        content:
          'Extract structured data from a resume. Return JSON with keys: name (string), ' +
          'skills (string[]), education (string[]), experience (string[]), ' +
          'certifications (string[]), projects (string[]). Use [] when unknown. JSON only.',
      },
      { role: 'user', content: resumeText.slice(0, 12000) },
    ],
    { temperature: 0 },
  );
  return parsed ?? {};
}

export type AtsResult = {
  ats_score: number;
  breakdown: AtsBreakdown;
  reasoning: string;
};

function clampPoint(v: unknown, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

// Score a resume against a job description. Always returns a usable result.
export async function scoreAts(
  resumeText: string,
  parsed: ParsedResume,
  job: Job,
): Promise<AtsResult> {
  const jd = [
    `Title: ${job.title}`,
    job.experience_required ? `Experience required: ${job.experience_required}` : '',
    job.skills_required.length ? `Required skills: ${job.skills_required.join(', ')}` : '',
    job.description ? `Description: ${job.description}` : '',
    job.requirements ? `Requirements: ${job.requirements}` : '',
    job.responsibilities ? `Responsibilities: ${job.responsibilities}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await chatJSON<{ breakdown: Partial<AtsBreakdown>; reasoning: string }>(
    [
      {
        role: 'system',
        content:
          'You are an ATS engine. Compare a candidate resume to a job description and award ' +
          `points in each category up to its maximum: skill (max ${WEIGHTS.skill}), ` +
          `experience (max ${WEIGHTS.experience}), education (max ${WEIGHTS.education}), ` +
          `domain (max ${WEIGHTS.domain}), keyword (max ${WEIGHTS.keyword}), ` +
          `project (max ${WEIGHTS.project}). Be objective and strict. ` +
          'Return JSON: { "breakdown": { "skill": n, "experience": n, "education": n, ' +
          '"domain": n, "keyword": n, "project": n }, "reasoning": "2-4 sentences" }. JSON only.',
      },
      {
        role: 'user',
        content: `JOB DESCRIPTION:\n${jd}\n\nCANDIDATE PARSED:\n${JSON.stringify(parsed)}\n\nRESUME TEXT:\n${resumeText.slice(0, 8000)}`,
      },
    ],
    { temperature: 0 },
  );

  const b = raw?.breakdown ?? {};
  const breakdown: AtsBreakdown = {
    skill: clampPoint(b.skill, WEIGHTS.skill),
    experience: clampPoint(b.experience, WEIGHTS.experience),
    education: clampPoint(b.education, WEIGHTS.education),
    domain: clampPoint(b.domain, WEIGHTS.domain),
    keyword: clampPoint(b.keyword, WEIGHTS.keyword),
    project: clampPoint(b.project, WEIGHTS.project),
  };
  const ats_score =
    breakdown.skill +
    breakdown.experience +
    breakdown.education +
    breakdown.domain +
    breakdown.keyword +
    breakdown.project;

  return {
    ats_score,
    breakdown,
    reasoning: raw?.reasoning ?? 'Automated scoring unavailable; defaulted to 0.',
  };
}

export { WEIGHTS as ATS_WEIGHTS };

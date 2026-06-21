import { NextResponse } from 'next/server';

// Always generate fresh questions (never cache)
export const dynamic = 'force-dynamic';

type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

type CodingChallenge = {
  title: string;
  prompt: string;
  language: string;
  starterCode: string;
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const NUM_QUESTIONS = 4;

const FALLBACK_CODING: CodingChallenge = {
  title: 'Reverse a String',
  prompt:
    'Write a function reverseString(s) that returns the input string reversed. Example: reverseString("hello") -> "olleh".',
  language: 'javascript',
  starterCode: 'function reverseString(s) {\n  // your code here\n}\n',
};

const SYSTEM_PROMPT = `You are a quiz generator. Generate technology content for an exam.
Topics: programming, software engineering, computers, the internet, AI, databases, networking, operating systems, and notable tech history/companies.
Rules for multiple-choice questions:
- Each question has exactly 4 options.
- Exactly one option is correct, and "correctAnswer" must match one option string EXACTLY.
- Keep questions concise and unambiguous. Vary difficulty (easy to medium).
Rules for the coding challenge:
- It must be a SMALL programming task solvable in about 2 minutes.
- Include a short, clear prompt with an example, plus minimal starter code.
Return ONLY valid JSON, no markdown, no commentary.`;

type JdContext = {
  jobTitle?: string;
  jobDescription?: string;
  skills?: string[];
};

function buildUserPrompt(jd?: JdContext): string {
  // A random seed nudges the model toward fresh content each run.
  const seed = Math.random().toString(36).slice(2, 10);
  const jdBlock =
    jd && (jd.jobTitle || jd.jobDescription || (jd.skills && jd.skills.length))
      ? `Tailor the questions and coding challenge to THIS role:
Title: ${jd.jobTitle ?? ''}
Skills: ${(jd.skills ?? []).join(', ')}
Description: ${(jd.jobDescription ?? '').slice(0, 1500)}
Focus on the skills and domain above.\n\n`
      : '';
  return `${jdBlock}Generate ${NUM_QUESTIONS} NEW and varied technical multiple-choice questions AND one short coding challenge (seed: ${seed}).
Respond as JSON in this exact shape:
{
  "questions": [
    { "question": "string", "options": ["a","b","c","d"], "correctAnswer": "a" }
  ],
  "coding": {
    "title": "string",
    "prompt": "string with an example",
    "language": "javascript",
    "starterCode": "function solve() {\\n  // your code here\\n}\\n"
  }
}`;
}

function isValid(q: unknown): q is QuizQuestion {
  if (!q || typeof q !== 'object') return false;
  const c = q as Record<string, unknown>;
  return (
    typeof c.question === 'string' &&
    Array.isArray(c.options) &&
    c.options.length === 4 &&
    c.options.every((o) => typeof o === 'string') &&
    typeof c.correctAnswer === 'string' &&
    (c.options as string[]).includes(c.correctAnswer as string)
  );
}

function parseCoding(raw: unknown): CodingChallenge {
  if (raw && typeof raw === 'object') {
    const c = raw as Record<string, unknown>;
    if (typeof c.title === 'string' && typeof c.prompt === 'string') {
      return {
        title: c.title,
        prompt: c.prompt,
        language: typeof c.language === 'string' ? c.language : 'javascript',
        starterCode: typeof c.starterCode === 'string' ? c.starterCode : '',
      };
    }
  }
  return FALLBACK_CODING;
}

async function generate(jd?: JdContext) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(jd) },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: 'Groq request failed', detail }, { status: 502 });
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);

    const questions: QuizQuestion[] = Array.isArray(parsed?.questions)
      ? parsed.questions.filter(isValid)
      : [];

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No valid questions generated' }, { status: 502 });
    }

    return NextResponse.json({
      questions: questions.slice(0, NUM_QUESTIONS),
      coding: parseCoding(parsed?.coding),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate questions', detail: String(err) }, { status: 500 });
  }
}

// Standalone quiz (no role context).
export async function GET() {
  return generate();
}

// Assessment mode: questions tailored to a job description.
export async function POST(req: Request) {
  const jd = (await req.json().catch(() => ({}))) as JdContext;
  return generate(jd);
}

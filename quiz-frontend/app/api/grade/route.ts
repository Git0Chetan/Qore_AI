import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a strict but fair programming grader.
You are given a coding task and a candidate's submitted solution.
Decide whether the solution correctly and meaningfully solves the task.
Rules:
- "correct" must be true ONLY if the code is a genuine attempt that would solve the task (minor syntax slips are acceptable if the logic is right).
- Empty code, unchanged starter code, comments only, or irrelevant code => correct: false.
- Keep "feedback" to one short sentence.
- Return ONLY valid JSON: {"correct": boolean, "feedback": "string"}`;

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
  }

  let body: { prompt?: string; language?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { prompt = '', language = 'javascript', code = '' } = body;

  // Cheap local guard: nothing meaningful submitted.
  if (!code.trim()) {
    return NextResponse.json({ correct: false, feedback: 'No code was submitted.' });
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
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `TASK:\n${prompt}\n\nLANGUAGE: ${language}\n\nSUBMITTED CODE:\n${code}`,
          },
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

    return NextResponse.json({
      correct: Boolean(parsed?.correct),
      feedback: typeof parsed?.feedback === 'string' ? parsed.feedback : '',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to grade code', detail: String(err) },
      { status: 500 },
    );
  }
}

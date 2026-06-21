// Thin Groq wrapper (OpenAI-compatible). Provider is isolated here so it can be
// swapped without touching callers. Mirrors the pattern used in quiz-frontend.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// Calls Groq in JSON mode and returns the parsed object, or null on any failure.
export async function chatJSON<T>(
  messages: ChatMessage[],
  opts: { temperature?: number } = {},
): Promise<T | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: opts.temperature ?? 0.2,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
    if (!res.ok) {
      console.error('[groq:chatJSON] request failed', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '{}';
    return JSON.parse(content) as T;
  } catch (err) {
    console.error('[groq:chatJSON] error', err);
    return null;
  }
}

// Plain-text chat completion (e.g. conversational Career Buddy). Returns null on failure.
export async function chatText(
  messages: ChatMessage[],
  opts: { temperature?: number } = {},
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: opts.temperature ?? 0.4,
        messages,
      }),
    });
    if (!res.ok) {
      console.error('[groq:chatText] request failed', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content as string) ?? null;
  } catch (err) {
    console.error('[groq:chatText] error', err);
    return null;
  }
}

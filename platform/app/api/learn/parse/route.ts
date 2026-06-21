import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractResumeText } from '@/lib/ai/ats';
import { chatJSON, chatText } from '@/lib/ai/groq';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = ['.pdf', '.doc', '.docx', '.txt', '.md'];

// Intelligent Document Parser: turn a static document into adaptive, multi-format
// knowledge (summary, flowchart, audio narration, flashcards, key points).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  const format = (form?.get('format') ?? 'summary').toString();
  if (!file || file.size === 0) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ error: 'Upload a PDF, DOC, DOCX, TXT, or MD file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = (await extractResumeText(buffer, file.name)).slice(0, 14000);
  if (!text.trim()) return NextResponse.json({ error: 'Could not read any text from the document' }, { status: 422 });

  try {
    switch (format) {
      case 'summary': {
        const out = await chatText(
          [
            { role: 'system', content: 'Summarize the document clearly for a busy professional. Use short paragraphs. No preamble.' },
            { role: 'user', content: text },
          ],
          { temperature: 0.3 },
        );
        return NextResponse.json({ format, summary: out ?? '' });
      }
      case 'keypoints': {
        const out = await chatJSON<{ points: string[] }>(
          [
            { role: 'system', content: 'Extract the key points from the document. Return JSON: {"points": string[]} with 5-10 crisp bullets. JSON only.' },
            { role: 'user', content: text },
          ],
          { temperature: 0.2 },
        );
        return NextResponse.json({ format, points: out?.points ?? [] });
      }
      case 'flowchart': {
        const out = await chatJSON<{ mermaid: string; steps: { title: string; detail?: string }[] }>(
          [
            {
              role: 'system',
              content:
                'Convert the document into a process flowchart. Return JSON with two keys: ' +
                '"mermaid" and "steps". ' +
                '"mermaid" MUST be valid Mermaid flowchart code starting with "flowchart TD", using ' +
                '[Box] for steps, {Decision} for branches, and --> arrows (optionally -->|label|). ' +
                'Use simple node ids (A, B, C...). Keep node labels short and free of quotes, parentheses, ' +
                'colons, and special characters. 4-10 nodes. ' +
                '"steps" is a plain list: [{"title":string,"detail":string}] mirroring the flow (fallback). JSON only.',
            },
            { role: 'user', content: text },
          ],
          { temperature: 0.2 },
        );
        return NextResponse.json({ format, mermaid: out?.mermaid ?? '', steps: out?.steps ?? [] });
      }
      case 'flashcards': {
        const out = await chatJSON<{ cards: { q: string; a: string }[] }>(
          [
            { role: 'system', content: 'Create study flashcards from the document. Return JSON: {"cards":[{"q":string,"a":string}]} with 5-8 Q&A pairs. JSON only.' },
            { role: 'user', content: text },
          ],
          { temperature: 0.3 },
        );
        return NextResponse.json({ format, cards: out?.cards ?? [] });
      }
      case 'audio': {
        const out = await chatText(
          [
            { role: 'system', content: 'Write a natural, spoken-word narration script that explains the document conversationally, as if reading an audio guide. ~150-220 words. Plain text only, no markdown or headings.' },
            { role: 'user', content: text },
          ],
          { temperature: 0.4 },
        );
        return NextResponse.json({ format, narration: out ?? '' });
      }
      default:
        return NextResponse.json({ error: 'Unknown format' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Transformation failed', detail: String(err) }, { status: 500 });
  }
}

'use client';

import { useState } from 'react';
import { Button, Card, Field, PageShell, Select } from '@/components/ui';
import { MermaidChart } from '@/components/learn/MermaidChart';

type ParseResult =
  | { format: 'summary'; summary: string }
  | { format: 'keypoints'; points: string[] }
  | { format: 'flowchart'; mermaid: string; steps: { title: string; detail?: string }[] }
  | { format: 'flashcards'; cards: { q: string; a: string }[] }
  | { format: 'audio'; narration: string };

const FORMATS = [
  { value: 'summary', label: '📝 Text summary' },
  { value: 'keypoints', label: '🎯 Key points' },
  { value: 'flowchart', label: '🔀 Flowchart' },
  { value: 'flashcards', label: '🃏 Flashcards' },
  { value: 'audio', label: '🔊 Audio narration' },
];

function Flashcard({ q, a }: { q: string; a: string }) {
  const [show, setShow] = useState(false);
  return (
    <button
      onClick={() => setShow((s) => !s)}
      className="ui-card"
      style={{ textAlign: 'left', cursor: 'pointer', padding: 16 }}
    >
      <div style={{ fontWeight: 700, marginBottom: show ? 8 : 0 }}>{q}</div>
      {show ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{a}</div>
      ) : (
        <div style={{ color: 'var(--accent)', fontSize: 12 }}>Click to reveal answer</div>
      )}
    </button>
  );
}

function AudioPlayer({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  const play = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button onClick={play} disabled={speaking}>▶ Play narration</Button>
        <Button variant="secondary" onClick={stop} disabled={!speaking}>■ Stop</Button>
      </div>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  );
}

export default function DocParserPage() {
  const [format, setFormat] = useState('summary');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!(fd.get('file') as File)?.size) {
      setError('Please choose a document.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/learn/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not process the document.');
      } else {
        setResult(data as ParseResult);
      }
    } catch {
      setError('Network error — please try again.');
    }
    setLoading(false);
  };

  return (
    <PageShell
      title="Intelligent Document Parser"
      subtitle="Turn static documents into adaptive, multi-format knowledge."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        <Card>
          <form onSubmit={onSubmit}>
            <Field label="Document" hint="PDF, DOC, DOCX, TXT, or MD">
              <input
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                className="ui-input"
              />
            </Field>
            {fileName && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8 }}>{fileName}</p>}
            <Field label="Output format">
              <Select name="format" value={format} onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Transforming…' : 'Transform with AI'}
            </Button>
            {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 10 }}>{error}</p>}
          </form>
        </Card>

        <Card style={{ minHeight: 300 }}>
          {!result && !loading && (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Upload a document and pick a format. The AI will transform it — a summary, key points, a
              process flowchart, study flashcards, or a spoken audio narration.
            </p>
          )}
          {loading && <p style={{ color: 'var(--text-muted)', margin: 0 }}>AI is transforming your document…</p>}

          {result?.format === 'summary' && (
            <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result.summary}</div>
          )}

          {result?.format === 'keypoints' && (
            <ul style={{ lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
              {result.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}

          {result?.format === 'flowchart' && (
            <MermaidChart
              code={result.mermaid}
              fallback={
                <div>
                  {result.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: 'var(--grad)', color: '#051018', fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                        }}>{i + 1}</div>
                        {i < result.steps.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 18 }} />}
                      </div>
                      <div style={{ paddingBottom: 18 }}>
                        <div style={{ fontWeight: 700 }}>{s.title}</div>
                        {s.detail && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>{s.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {result?.format === 'flashcards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
              {result.cards.map((c, i) => <Flashcard key={i} q={c.q} a={c.a} />)}
            </div>
          )}

          {result?.format === 'audio' && <AudioPlayer text={result.narration} />}
        </Card>
      </div>
    </PageShell>
  );
}

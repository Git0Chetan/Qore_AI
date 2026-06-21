'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, PageShell } from '@/components/ui';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'What should I learn next?',
  'Am I ready for promotion?',
  'What skills am I missing?',
  'Which certification should I pursue?',
];

export default function CareerBuddyPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hi! I'm your Career Buddy. Ask me about your skills, learning path, promotion readiness, or internal opportunities." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const convId = useRef<string | undefined>(undefined);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/learn/buddy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: convId.current }),
      });
      const data = await res.json();
      convId.current = data.conversationId ?? convId.current;
      setMessages((m) => [...m, { role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error — please try again.' }]);
    }
    setLoading(false);
  };

  return (
    <PageShell
      title="Career Buddy"
      subtitle="Your AI mentor for learning and career growth."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/learn/buddy/session?mode=voice"><Button variant="secondary">🎙 Voice</Button></Link>
          <Link href="/learn/buddy/session?mode=video"><Button>🎥 Video coaching</Button></Link>
        </div>
      }
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 460, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: m.role === 'user' ? 'var(--grad)' : 'rgba(255,255,255,0.05)',
                  color: m.role === 'user' ? '#051018' : 'var(--text)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: 13 }}>Career Buddy is thinking…</div>}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  style={{
                    fontSize: 12, padding: '5px 10px', borderRadius: 9999, cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                className="ui-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your career…"
              />
              <Button type="submit" disabled={loading}>Send</Button>
            </form>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

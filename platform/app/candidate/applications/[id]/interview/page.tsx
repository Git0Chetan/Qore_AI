'use client';

import { use, useEffect, useState } from 'react';
import { Card, PageShell } from '@/components/ui';

// Mints a platform-authorized LiveKit token for the AI interview, then hands off
// to the agent-starter-react voice UI which connects to room `interview_<id>`.
// The voice agent detects that room name and runs the JD-driven InterviewAgent.
export default function InterviewLaunch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: id, mode: 'interview' }),
        });
        if (!res.ok) {
          setError((await res.json().catch(() => ({})))?.error || 'Could not start the interview.');
          return;
        }
        const { serverUrl, participantToken } = await res.json();
        const agentUi = process.env.NEXT_PUBLIC_AGENT_UI_URL || 'http://localhost:3000';
        const returnUrl = `${window.location.origin}/candidate/applications/${id}`;
        window.location.href =
          `${agentUi}/?lkUrl=${encodeURIComponent(serverUrl)}` +
          `&lkToken=${encodeURIComponent(participantToken)}` +
          `&returnUrl=${encodeURIComponent(returnUrl)}`;
      } catch {
        setError('Could not start the interview.');
      }
    })();
  }, [id]);

  return (
    <PageShell title="AI interview" subtitle="Connecting you to the interviewer…">
      <div style={{ maxWidth: 480 }}>
        <Card>
          {error ? (
            <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
          ) : (
            <p style={{ color: '#64748b', margin: 0 }}>Preparing your interview room. Please allow camera and microphone access.</p>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

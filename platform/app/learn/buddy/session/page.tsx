'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, PageShell } from '@/components/ui';

// Mints a Career Buddy LiveKit token (room buddy_<employeeId>) and hands off to
// the agent UI. The voice-agent detects the buddy_ room and runs CareerBuddyAgent.
function Launcher() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'video' ? 'video' : 'voice';
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'buddy' }),
        });
        if (!res.ok) {
          setError((await res.json().catch(() => ({})))?.error || 'Could not start the session.');
          return;
        }
        const { serverUrl, participantToken } = await res.json();
        const agentUi = process.env.NEXT_PUBLIC_AGENT_UI_URL || 'http://localhost:3000';
        const returnUrl = `${window.location.origin}/learn`;
        window.location.href =
          `${agentUi}/?lkUrl=${encodeURIComponent(serverUrl)}` +
          `&lkToken=${encodeURIComponent(participantToken)}` +
          `&returnUrl=${encodeURIComponent(returnUrl)}` +
          `&video=${mode === 'video' ? '1' : '0'}`;
      } catch {
        setError('Could not start the session.');
      }
    })();
  }, [mode]);

  return (
    <Card>
      {error ? (
        <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
      ) : (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Starting your {mode} session with Career Buddy… Please allow microphone{mode === 'video' ? ' and camera' : ''} access.
        </p>
      )}
    </Card>
  );
}

export default function BuddySessionPage() {
  return (
    <PageShell title="Career Buddy" subtitle="Connecting…">
      <div style={{ maxWidth: 480 }}>
        <Suspense fallback={null}>
          <Launcher />
        </Suspense>
      </div>
    </PageShell>
  );
}

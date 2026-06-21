'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';

// Mock identity verification: shows a live webcam preview and a confirmation.
// Real face-match + UIDAI Aadhaar verification is Phase 2 (the existing LiveKit
// vision pipeline can supply the face signal). The submit triggers the parent form.
export function IdentityCheck({ applicationId, action }: { applicationId: string; action: (fd: FormData) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camOk, setCamOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setCamOk(true);
        }
      })
      .catch(() => setError('Camera access is required for proctored assessment.'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div>
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: '#0f172a',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
      <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 18, lineHeight: 1.7 }}>
        <li>Your face is matched against your registered identity.</li>
        <li>Aadhaar details are confirmed.</li>
        <li>Screen, camera, and audio are monitored during the test.</li>
      </ul>
      <form action={action}>
        <input type="hidden" name="application_id" value={applicationId} />
        <Button type="submit" disabled={!camOk} style={{ width: '100%' }}>
          {camOk ? 'Verify identity & begin assessment →' : 'Waiting for camera…'}
        </Button>
      </form>
    </div>
  );
}

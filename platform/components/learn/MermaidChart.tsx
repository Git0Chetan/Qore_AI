'use client';

import { useEffect, useRef, useState } from 'react';

// Renders AI-generated Mermaid flowchart syntax to an SVG diagram. Shows the
// provided fallback if the syntax is invalid or rendering fails.
export function MermaidChart({ code, fallback }: { code: string; fallback?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const clean = code.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
    if (!clean) {
      setFailed(true);
      return;
    }
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
        const id = 'mmd-' + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.render(id, clean);
        if (active && ref.current) {
          ref.current.innerHTML = svg;
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  if (failed) return <>{fallback ?? <p style={{ color: 'var(--text-muted)' }}>Could not render diagram.</p>}</>;
  return <div ref={ref} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />;
}

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Field, Input } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(params.get('next') || '/');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit}>
      <h1 style={{ fontSize: 26, fontWeight: 900, marginTop: 0 }}>Log in</h1>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
      <Button type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
        {loading ? 'Signing in…' : 'Log in'}
      </Button>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
        No account? <Link href="/register" className="ui-link">Register</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Card>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}

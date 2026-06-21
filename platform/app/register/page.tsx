'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isValidAadhaar } from '@/lib/utils';
import type { UserRole } from '@/lib/types';
import { Button, Card, Field, Input, Select } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('external_candidate');
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    aadhaar: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const isCandidate = role === 'external_candidate' || role === 'internal_employee';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (isCandidate && !isValidAadhaar(form.aadhaar)) {
      setError('Enter a valid 12-digit Aadhaar number.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          mobile: form.mobile,
          aadhaar: isCandidate ? form.aadhaar.replace(/\s/g, '') : null,
          role,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is enabled, there's no session yet.
    if (!data.session) {
      setInfo('Account created. Check your email to confirm, then log in.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <Card>
          <form onSubmit={onSubmit}>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginTop: 0 }}>Create account</h1>

            <Field label="I am a">
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="external_candidate">External Candidate</option>
                <option value="internal_employee">Internal Employee</option>
                <option value="hr_admin">HR / Admin</option>
              </Select>
            </Field>

            <Field label="Full name">
              <Input value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set('email')} required />
            </Field>
            <Field label="Mobile number">
              <Input value={form.mobile} onChange={set('mobile')} required />
            </Field>

            {isCandidate && (
              <Field label="Aadhaar number" hint="12 digits. Stored securely; verified at assessment time.">
                <Input value={form.aadhaar} onChange={set('aadhaar')} inputMode="numeric" required />
              </Field>
            )}

            <Field label="Password">
              <Input type="password" value={form.password} onChange={set('password')} required minLength={6} />
            </Field>

            {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
            {info && <p style={{ color: 'var(--success)', fontSize: 14 }}>{info}</p>}

            <Button type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Creating…' : 'Create account'}
            </Button>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
              Already have an account? <Link href="/login" className="ui-link">Log in</Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}

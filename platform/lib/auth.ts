import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types';

// Returns the current profile, or null if not signed in.
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return (data as Profile) ?? null;
}

// Guards a server component: redirects to /login if signed out, or to the
// user's home if their role isn't allowed.
export async function requireRole(allowed: UserRole[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (!allowed.includes(profile.role)) redirect(homePathForRole(profile.role));
  return profile;
}

export function homePathForRole(role: UserRole): string {
  if (role === 'super_admin') return '/admin';
  if (role === 'hr_admin') return '/hr';
  return '/candidate';
}

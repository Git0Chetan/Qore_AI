import { createClient } from '@supabase/supabase-js';

// Service-role client. SERVER-ONLY — bypasses RLS. Never import into client code.
// Used by trusted server routes (ATS scoring, assessment result write-backs).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

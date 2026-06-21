import { createClient } from '@/lib/supabase/server';

// Records an action in the audit log. Best-effort (never throws to the caller).
// Insert is permitted for HR/super-admin by RLS (audit_insert policy).
export async function writeAudit(input: {
  orgId: string | null;
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      org_id: input.orgId,
      actor_id: input.actorId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      detail: input.detail ?? null,
    });
  } catch (err) {
    console.error('[audit] failed', err);
  }
}

import crypto from 'crypto';

// Short-lived signed token that binds an assessment session to one application.
// Passed to the quiz app on launch and returned with results so the candidate
// cannot point results at a different application. (Score integrity itself is a
// Phase 2 concern — see plan: server-authoritative grading.)

type Payload = { applicationId: string; jobId: string; exp: number };

function secret(): string {
  return process.env.ASSESSMENT_SHARED_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signAssessmentToken(applicationId: string, jobId: string, ttlMs = 2 * 60 * 60 * 1000): string {
  const payload: Payload = { applicationId, jobId, exp: Date.now() + ttlMs };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAssessmentToken(token: string): Payload | null {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

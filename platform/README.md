# Qore AI — Recruitment Platform (Phase 1)

The hub app: auth, job postings, AI resume screening (ATS), candidate + HR
dashboards, and handoff to the proctored assessment (`quiz-frontend` + `voice-agent`).

Runs on **http://localhost:3002**.

## One-time setup

### 1. Create a Supabase project
At https://supabase.com, create a project. Then in **Project Settings → API**, copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)

Paste them into `platform/.env.local` (already created; Groq + LiveKit are pre-filled).

### 2. Apply the database schema
Open the Supabase **SQL Editor** and run, in order:

```
platform/supabase/migrations/0001_init.sql   # core schema, RLS, storage buckets
platform/supabase/migrations/0002_phase2.sql # audit logs, interviews, offers, super-admin
```

`0001` creates all tables, enums, RLS policies, the signup trigger, and the
`resumes` / `recordings` storage buckets. `0002` adds Phase 2 features.

To bootstrap the first **Super Admin**, after registering an account run:

```sql
update profiles set role = 'super_admin' where email = 'you@example.com';
```

### 3. Disable email confirmation (for local dev)
Supabase **Authentication → Providers → Email** → turn **off** "Confirm email".
Otherwise new sign-ups must click an email link before they get a session.

### 4. Set the assessment secret
In `.env.local`, set `ASSESSMENT_SHARED_SECRET` to any long random string.

## Run

From the repo root, `./start.sh` launches everything (platform, quiz, agent UI,
proctor). Or just this app:

```bash
cd platform && pnpm dev
```

## End-to-end flow

1. Register an **HR / Admin** account → land on `/hr`.
2. Post a job (external, with an ATS threshold) → get a public `/jobs/<slug>` URL.
3. Register a **Candidate** (with a 12-digit Aadhaar) → `/candidate`.
4. Open the job, upload a PDF/DOCX resume, apply → AI screens it instantly.
5. If `ATS score ≥ threshold`, status becomes **Assessment Assigned**.
6. Start assessment → identity check → proctored quiz (questions generated from
   the JD) → score is reported back, status flips to **Passed/Failed**.
7. Candidate sees ATS/assessment scores + timeline; HR sees the pipeline and can
   move stages, reject, or comment.

## Phase 2 features

- **Reporting & analytics** — `/hr/analytics` (and `/admin` org-wide): hiring funnel,
  conversion rates, assessment success rate, ATS distribution, time-to-hire, skill gaps.
- **Interview scheduling & offers** — HR schedules interviews and releases offers from the
  job pipeline; candidates see them on the application page and can accept/decline an offer.
- **Super Admin console** — `/admin`: manage user roles, edit org settings (default
  thresholds + notification toggles), and view an audit log of admin/pipeline actions.
- **Internal Employee flow** — register as an internal employee; internal-visibility jobs
  appear to signed-in users.
- **Voice AI interview** — after passing the assessment, the candidate gets a "Start AI
  interview" button. The platform mints a LiveKit token for room `interview_<id>` and hands
  off to `agent-starter-react` (`?lkUrl=&lkToken=`); the `voice-agent` detects that room and
  runs a JD-driven `InterviewAgent`, then reports scores via `/api/agent/result`.
- **Advanced proctoring** — the `voice-agent` runs camera-based detection (no-face,
  multiple faces, looking away, phone) plus tab-switch tracking, computes an integrity
  score, and posts violations to the platform.

These add env vars (already in `.env.local` / `.env.example`):
`AGENT_SHARED_SECRET` (must match the voice-agent's), `NEXT_PUBLIC_AGENT_UI_URL`.
The voice-agent needs `PLATFORM_URL` and a matching `AGENT_SHARED_SECRET`.

> The voice AI interview + advanced proctoring span LiveKit and three apps; they're wired
> end-to-end but need a live LiveKit session to verify in your environment.

## Notes / Phase-2 hardening

- **Aadhaar** is format-validated and stored only (mock verify) — not UIDAI-checked.
- **Face verification** shows a live camera but is a mock confirmation.
- **Assessment scoring** is computed client-side in the quiz and bound to the
  application via a signed token; server-authoritative grading is deferred.
- **Notifications** send email via Resend if `RESEND_API_KEY` is set, else log to
  console. WhatsApp/push are stubbed behind `lib/notify.ts`.
- Deferred: Super Admin console, Internal Employee flow, voice AI interview,
  full reporting/analytics, interview scheduling & offers.

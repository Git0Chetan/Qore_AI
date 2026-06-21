# Deploying Qore AI to Railway

Qore AI is **4 services** deployed from this one repo, plus managed providers
(Supabase, LiveKit Cloud, Groq, Anam). On Railway you create **one project** with
**four services**, each pointing at a subfolder of this repo.

| Service | Folder | Type | Public URL needed? |
|---|---|---|---|
| platform | `platform/` | Next.js (web) | ✅ main app |
| quiz-frontend | `quiz-frontend/` | Next.js (web) | ✅ |
| agent-ui (agent-starter-react) | `agent-starter-react/` | Next.js (web) | ✅ |
| voice-agent | `voice-agent/` | Docker worker | ❌ (no inbound HTTP) |

> The three web apps are stateless Next.js apps; `voice-agent` is a long-running
> LiveKit worker (that's why it can't go on Vercel/serverless).

---

## 0. Prerequisites (managed providers)

- **Supabase** project (you already have one). You'll set its prod Auth URLs in step 4.
- **LiveKit Cloud** project → `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- **Groq** API key (the working one already in your local env).
- **Anam** API key (`ANAM_API_KEY`) for avatar video.
- Pick two strong secrets you'll reuse: `ASSESSMENT_SHARED_SECRET`, `AGENT_SHARED_SECRET`.

---

## 1. Push the repo to GitHub

Railway deploys from a Git repo. Push this repo (each app keeps its own lockfile).

---

## 2. Create the Railway project + 4 services

In Railway: **New Project → Deploy from GitHub repo**, then add services. For each
service set **Settings → Root Directory** to the folder and let Railway autodetect:

- **platform** → Root `platform` → build `pnpm build`, start `pnpm start` (Nixpacks autodetects Next.js).
- **quiz-frontend** → Root `quiz-frontend`.
- **agent-ui** → Root `agent-starter-react`.
- **voice-agent** → Root `voice-agent` → Railway detects the **Dockerfile** automatically (build type = Dockerfile).

Generate a public domain for each of the **three web** services
(Settings → Networking → Generate Domain). The voice-agent needs **no** domain.

> The Next start scripts now use plain `next start`, which binds to Railway's `$PORT`
> automatically. Do not hardcode ports.

---

## 3. Set environment variables (per service)

Use the generated domains. Below, replace `…` with your real values and
`https://<platform>` etc. with the Railway domains.

### platform
```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
GROQ_API_KEY=…
GROQ_MODEL=llama-3.3-70b-versatile
LIVEKIT_API_KEY=…
LIVEKIT_API_SECRET=…
LIVEKIT_URL=wss://<your-livekit>.livekit.cloud
NEXT_PUBLIC_APP_URL=https://<platform-domain>
NEXT_PUBLIC_QUIZ_URL=https://<quiz-domain>
NEXT_PUBLIC_AGENT_UI_URL=https://<agent-ui-domain>
ASSESSMENT_SHARED_SECRET=…           # must match nothing else, but keep stable
AGENT_SHARED_SECRET=…                # MUST match voice-agent
INTERVIEW_MAX_ATTEMPTS=2
INTERVIEW_PASS_SCORE=60
YOUTUBE_API_KEY=…                    # optional
RESEND_API_KEY=                      # optional (email notifications)
NOTIFY_FROM_EMAIL=recruiting@yourdomain.com
```

### quiz-frontend
```
GROQ_API_KEY=…
GROQ_MODEL=llama-3.3-70b-versatile
```

### agent-ui (agent-starter-react)
```
NEXT_PUBLIC_QUIZ_URL=https://<quiz-domain>
```
(LiveKit creds are NOT needed here — tokens are minted by the platform and passed in the URL.)

### voice-agent
```
LIVEKIT_URL=wss://<your-livekit>.livekit.cloud
LIVEKIT_API_KEY=…
LIVEKIT_API_SECRET=…
GROQ_API_KEY=…
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
ANAM_API_KEY=…
PLATFORM_URL=https://<platform-domain>
AGENT_SHARED_SECRET=…                # MUST match platform
# optional knobs:
INTERVIEW_USE_AVATAR=1
BUDDY_USE_AVATAR=1
PROCTOR_INTERVAL_SECONDS=12
```

> Tip: in Railway you can reference another service's domain with a variable
> reference like `https://${{quiz-frontend.RAILWAY_PUBLIC_DOMAIN}}` instead of pasting URLs.

**Important about `NEXT_PUBLIC_*`:** these are baked at **build time**. If you change
any of them later, **redeploy** that web service so the new value is compiled in.

---

## 4. Supabase production config

1. **Run the SQL** (SQL editor), in order:
   `0001_init.sql` → `0002_phase2.sql` → `0003_interview_attempts.sql` →
   `0004_learning.sql`, then `seed.sql`, `seed_data.sql`, `seed_learning.sql`.
2. **Auth → URL Configuration**: set **Site URL** to `https://<platform-domain>` and add
   it (and `…/**`) to **Redirect URLs**.
3. **Auth → Providers → Email**: keep "Confirm email" **off** for the demo logins to work
   immediately (or implement the confirm flow).
4. **Storage**: the `resumes` / `recordings` buckets are created by `0001_init.sql` — no action.

---

## 5. Deploy order & smoke test

1. Deploy all four services. The voice-agent build downloads model files (first build is slower).
2. Open `https://<platform-domain>`, log in (`hr@qore.ai` / `Hr@123456`, etc.).
3. Post a job → public `/jobs/<slug>` loads.
4. As a candidate, apply with a PDF → ATS score appears (verifies Groq + storage).
5. Start an assessment → quiz opens (verifies cross-app handoff + CORS).
6. Pass it → start the AI interview/Career Buddy → confirm the voice-agent connects
   (check the voice-agent service logs for "registered worker" / job logs).

---

## Notes & gotchas

- **voice-agent base image**: the Dockerfile uses `ghcr.io/astral-sh/uv:python3.14-bookworm-slim`.
  If that tag is unavailable, switch the `FROM` to a `python3.13` uv image and relax
  `requires-python` in `pyproject.toml` to `>=3.13`.
- **agent-ui `/api/token`** intentionally throws outside development (it's insecure). That's
  fine: users only ever reach the agent UI via the platform, which passes a real token in the
  URL (`?lkToken=…`). Don't link to the agent UI directly without a token.
- **Avatar reliability**: the Anam avatar can drop on long calls; the agent already falls back
  to voice-only (watchdog). Set `INTERVIEW_USE_AVATAR=0` / `BUDDY_USE_AVATAR=0` to force
  voice-only if needed.
- **Costs**: Groq/LiveKit/Anam free tiers have limits; a public deployment can hit rate limits.
- **`start.sh`** is for local dev only — Railway runs each service independently.

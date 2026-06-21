-- ============================================================================
-- Qore AI — Phase 2: audit logs, interviews, offers, super-admin capabilities.
-- Run after 0001_init.sql.
-- ============================================================================

-- ---------- Helper: is the current user a super admin? ----------
create or replace function public.is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false)
$$;

-- ---------- Tables ----------
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id),
  actor_id    uuid references auth.users(id),
  action      text not null,            -- e.g. role_changed, settings_updated, interview_scheduled
  target_type text,                     -- e.g. profile, job, application, organization
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create table interviews (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  scheduled_at   timestamptz not null,
  mode           text not null default 'video',   -- video | phone | onsite
  location       text,                             -- meeting link or address
  notes          text,
  status         text not null default 'scheduled', -- scheduled | completed | cancelled
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create table offers (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  salary         text,
  joining_date   date,
  notes          text,
  status         text not null default 'released',  -- released | accepted | declined
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index on audit_logs (org_id, created_at);
create index on interviews (application_id);
create index on offers (application_id);

-- ---------- RLS ----------
alter table audit_logs enable row level security;
alter table interviews enable row level security;
alter table offers     enable row level security;

-- audit logs: only super admins can read; HR/super can insert (via server actions)
create policy audit_select on audit_logs for select using (public.is_super_admin());
create policy audit_insert on audit_logs for insert with check (public.is_hr());

-- interviews: candidate owner or HR can read; HR manages
create policy interviews_select on interviews for select using (
  public.is_hr()
  or exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
);
create policy interviews_write on interviews for all using (public.is_hr()) with check (public.is_hr());

-- offers: candidate owner can read (and accept/decline); HR manages
create policy offers_select on offers for select using (
  public.is_hr()
  or exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
);
create policy offers_insert on offers for insert with check (public.is_hr());
create policy offers_update on offers for update using (
  public.is_hr()
  or exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
);

-- super admins can read every profile and change roles; can update org settings
create policy profiles_admin_update on profiles for update using (public.is_super_admin());
create policy orgs_update on organizations for update using (public.is_hr());

-- ============================================================================
-- Bootstrapping the first super admin (run once, manually):
--   update profiles set role = 'super_admin' where email = 'you@example.com';
-- ============================================================================

-- ============================================================================
-- Qore AI Recruitment Platform — Phase 1 schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- ============================================================================

-- ---------- Enums ----------
create type user_role as enum (
  'super_admin', 'hr_admin', 'internal_employee', 'external_candidate'
);
create type job_visibility as enum ('internal', 'external');
create type job_status as enum ('draft', 'active', 'closed');
create type application_status as enum (
  'applied', 'ats_review', 'ats_rejected',
  'assessment_assigned', 'assessment_passed', 'assessment_failed',
  'hr_review', 'interview', 'offer', 'hired', 'rejected'
);

-- ---------- Tables ----------
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  org_id           uuid references organizations(id),
  role             user_role not null default 'external_candidate',
  name             text,
  email            text,
  mobile           text,
  aadhaar          text,                       -- stored + format-validated (mock verify)
  aadhaar_verified boolean not null default false,
  created_at       timestamptz not null default now()
);

create table jobs (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references organizations(id),
  title               text not null,
  department          text,
  location            text,
  employment_type     text,
  experience_required text,
  skills_required     text[] not null default '{}',
  salary_min          int,
  salary_max          int,
  description         text,
  responsibilities    text,
  requirements        text,
  ats_threshold       int not null default 60,
  test_threshold      int not null default 60,
  hiring_manager      text,
  openings            int not null default 1,
  deadline            date,
  visibility          job_visibility not null default 'external',
  status              job_status not null default 'draft',
  public_slug         text unique,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

create table applications (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references jobs(id) on delete cascade,
  candidate_id     uuid not null references auth.users(id) on delete cascade,
  resume_url       text,
  current_company  text,
  current_role     text,
  experience       text,
  notice_period    text,
  expected_salary  text,
  skills           text[] not null default '{}',
  linkedin         text,
  portfolio        text,
  parsed           jsonb,                       -- { name, skills, education, experience, certifications, projects }
  ats_score        int,
  ats_breakdown    jsonb,                       -- { skill, experience, education, domain, keyword, project }
  ats_reasoning    text,
  assessment_score int,
  status           application_status not null default 'applied',
  created_at       timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create table assessments (
  id                         uuid primary key default gen_random_uuid(),
  application_id             uuid not null references applications(id) on delete cascade,
  technical_score            int,
  behavioral_score           int,
  coding_score               int,
  aptitude_score             int,
  proctoring_integrity_score int,
  overall_score              int,
  violations                 jsonb,
  recording_url              text,
  ai_feedback                text,
  created_at                 timestamptz not null default now()
);

create table application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  type           text not null,               -- applied | ats_passed | ats_failed | assessment_* | stage_change | comment ...
  message        text,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index on jobs (status, visibility);
create index on applications (job_id);
create index on applications (candidate_id);
create index on application_events (application_id, created_at);

-- ---------- Helper functions (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.my_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.my_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function public.is_hr() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('hr_admin', 'super_admin') from profiles where id = auth.uid()),
    false)
$$;

-- ---------- Auto-create a profile when a user signs up ----------
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, mobile, aadhaar, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'mobile',
    new.raw_user_meta_data->>'aadhaar',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'external_candidate')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
alter table organizations      enable row level security;
alter table profiles           enable row level security;
alter table jobs               enable row level security;
alter table applications       enable row level security;
alter table assessments        enable row level security;
alter table application_events enable row level security;

-- profiles: read own or HR reads all; update own
create policy profiles_select on profiles for select using (id = auth.uid() or public.is_hr());
create policy profiles_update on profiles for update using (id = auth.uid());
create policy profiles_insert on profiles for insert with check (id = auth.uid());

-- organizations: HR can read its org and create one
create policy orgs_select on organizations for select using (public.is_hr());
create policy orgs_insert on organizations for insert with check (public.is_hr());

-- jobs: public sees active external; authenticated sees active internal; HR manages all
create policy jobs_select on jobs for select using (
  (status = 'active' and visibility = 'external')
  or (status = 'active' and visibility = 'internal' and auth.uid() is not null)
  or public.is_hr()
);
create policy jobs_insert on jobs for insert with check (public.is_hr());
create policy jobs_update on jobs for update using (public.is_hr());
create policy jobs_delete on jobs for delete using (public.is_hr());

-- applications: candidate owns theirs; HR reads/updates
create policy applications_select on applications for select using (
  candidate_id = auth.uid() or public.is_hr()
);
create policy applications_insert on applications for insert with check (candidate_id = auth.uid());
create policy applications_update on applications for update using (
  candidate_id = auth.uid() or public.is_hr()
);

-- assessments: HR or the owning candidate
create policy assessments_select on assessments for select using (
  public.is_hr()
  or exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
);
create policy assessments_write on assessments for all using (public.is_hr()) with check (public.is_hr());

-- application_events: owner or HR can read; owner or HR can insert
create policy events_select on application_events for select using (
  public.is_hr()
  or exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
);
create policy events_insert on application_events for insert with check (
  public.is_hr()
  or exists (select 1 from applications a where a.id = application_id and a.candidate_id = auth.uid())
);

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false)
  on conflict (id) do nothing;

-- resumes: a candidate uploads/reads under their own uid folder; HR can read all
create policy resume_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy resume_select on storage.objects for select to authenticated using (
  bucket_id = 'resumes'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_hr())
);
create policy recording_rw on storage.objects for all to authenticated using (
  bucket_id = 'recordings' and public.is_hr()
) with check (
  bucket_id = 'recordings' and public.is_hr()
);

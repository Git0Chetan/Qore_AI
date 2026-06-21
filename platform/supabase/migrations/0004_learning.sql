-- ============================================================================
-- Qore AI — AI Learning & Career Buddy module (Phase 1).
-- Run after 0003_interview_attempts.sql.
-- ============================================================================

alter table profiles add column if not exists manager_id uuid references auth.users(id);

-- ---------- Org competency framework + career roles ----------
create table competencies (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id),
  name        text not null,
  category    text,
  description text,
  created_at  timestamptz not null default now()
);

create table career_roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id),
  title       text not null,
  level       text,
  description text,
  created_at  timestamptz not null default now()
);

create table role_competencies (
  id             uuid primary key default gen_random_uuid(),
  role_id        uuid not null references career_roles(id) on delete cascade,
  competency_id  uuid not null references competencies(id) on delete cascade,
  required_level int not null default 3,  -- 1..5
  unique (role_id, competency_id)
);

-- ---------- Employee skills + AI skill-gap reports ----------
create table employee_skills (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references auth.users(id) on delete cascade,
  competency_id uuid not null references competencies(id) on delete cascade,
  level         int not null default 0,    -- 0..5
  source        text[] not null default '{}',
  updated_at    timestamptz not null default now(),
  unique (employee_id, competency_id)
);

create table skill_gap_reports (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references auth.users(id) on delete cascade,
  target_role_id  uuid references career_roles(id),
  readiness_score int not null default 0,   -- 0..100
  gaps            jsonb,                     -- [{competency,current,required}]
  reasoning       text,
  created_at      timestamptz not null default now()
);

-- ---------- Learning paths ----------
create table learning_paths (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references auth.users(id) on delete cascade,
  target_role_id uuid references career_roles(id),
  title          text not null,
  status         text not null default 'active',  -- active | completed
  created_at     timestamptz not null default now()
);

create table path_items (
  id            uuid primary key default gen_random_uuid(),
  path_id       uuid not null references learning_paths(id) on delete cascade,
  ord           int not null default 0,
  title         text not null,
  competency_id uuid references competencies(id),
  course_id     uuid,
  status        text not null default 'not_started', -- not_started | in_progress | completed
  created_at    timestamptz not null default now()
);

-- ---------- Content catalog + enrollments ----------
create table courses (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id),
  provider         text not null default 'lms',  -- youtube | linkedin | percipio | lms
  external_id      text,
  title            text not null,
  url              text,
  description      text,
  skills           text[] not null default '{}',
  duration_minutes int,
  level            text,
  created_at       timestamptz not null default now()
);

create table enrollments (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references auth.users(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  status       text not null default 'assigned', -- assigned | in_progress | completed
  progress_pct int not null default 0,
  hours_spent  numeric not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (employee_id, course_id)
);

create table certifications (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  issuer      text,
  issued_date date,
  url         text,
  created_at  timestamptz not null default now()
);

-- ---------- Democratic training nomination ----------
create table training_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references auth.users(id) on delete cascade,
  type          text not null,  -- training | certification | workshop | conference
  title         text not null,
  justification text,
  cost          text,
  status        text not null default 'pending', -- pending | approved | rejected
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------- Peer learning & mentorship ----------
create table mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references auth.users(id) on delete cascade,
  mentee_id  uuid not null references auth.users(id) on delete cascade,
  focus      text,
  status     text not null default 'proposed', -- proposed | active | ended
  created_at timestamptz not null default now()
);

create table learning_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  topic      text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id    uuid not null references learning_groups(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, employee_id)
);

-- ---------- Career Buddy chat ----------
create table buddy_conversations (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  channel     text not null default 'text', -- text | voice | video
  summary     text,
  created_at  timestamptz not null default now()
);

create table buddy_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references buddy_conversations(id) on delete cascade,
  role            text not null,  -- user | assistant
  content         text not null,
  created_at      timestamptz not null default now()
);

create index on employee_skills (employee_id);
create index on skill_gap_reports (employee_id, created_at);
create index on learning_paths (employee_id);
create index on path_items (path_id, ord);
create index on enrollments (employee_id);
create index on training_requests (employee_id, status);
create index on buddy_messages (conversation_id, created_at);

-- ---------- RLS ----------
alter table competencies        enable row level security;
alter table career_roles        enable row level security;
alter table role_competencies   enable row level security;
alter table employee_skills     enable row level security;
alter table skill_gap_reports   enable row level security;
alter table learning_paths      enable row level security;
alter table path_items          enable row level security;
alter table courses             enable row level security;
alter table enrollments         enable row level security;
alter table certifications      enable row level security;
alter table training_requests   enable row level security;
alter table mentorships         enable row level security;
alter table learning_groups     enable row level security;
alter table group_members       enable row level security;
alter table buddy_conversations enable row level security;
alter table buddy_messages      enable row level security;

-- Reference data: readable by any signed-in user; writable by HR.
create policy comp_read   on competencies      for select using (auth.uid() is not null);
create policy comp_write  on competencies      for all using (public.is_hr()) with check (public.is_hr());
create policy roles_read  on career_roles      for select using (auth.uid() is not null);
create policy roles_write on career_roles      for all using (public.is_hr()) with check (public.is_hr());
create policy rc_read     on role_competencies for select using (auth.uid() is not null);
create policy rc_write    on role_competencies for all using (public.is_hr()) with check (public.is_hr());
create policy courses_read  on courses for select using (auth.uid() is not null);
create policy courses_write on courses for all using (public.is_hr()) with check (public.is_hr());

-- Employee-owned data: owner or HR/manager (is_hr) can read; owner or HR can write.
create policy es_rw   on employee_skills   for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());
create policy sgr_rw  on skill_gap_reports for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());
create policy lp_rw   on learning_paths    for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());
create policy en_rw   on enrollments       for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());
create policy cert_rw on certifications    for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());

-- path_items: scoped via their parent path.
create policy pi_select on path_items for select using (
  public.is_hr() or exists (select 1 from learning_paths p where p.id = path_id and p.employee_id = auth.uid())
);
create policy pi_write on path_items for all using (
  public.is_hr() or exists (select 1 from learning_paths p where p.id = path_id and p.employee_id = auth.uid())
) with check (
  public.is_hr() or exists (select 1 from learning_paths p where p.id = path_id and p.employee_id = auth.uid())
);

-- training requests: employee owns; HR reads all + decides.
create policy tr_select on training_requests for select using (employee_id = auth.uid() or public.is_hr());
create policy tr_insert on training_requests for insert with check (employee_id = auth.uid());
create policy tr_update on training_requests for update using (public.is_hr());

-- mentorship / groups: participants or HR.
create policy ment_select on mentorships for select using (mentor_id = auth.uid() or mentee_id = auth.uid() or public.is_hr());
create policy ment_write  on mentorships for all using (public.is_hr()) with check (public.is_hr());
create policy lg_read   on learning_groups for select using (auth.uid() is not null);
create policy lg_write  on learning_groups for all using (public.is_hr()) with check (public.is_hr());
create policy gm_read   on group_members for select using (auth.uid() is not null);
create policy gm_write  on group_members for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());

-- Career Buddy chat: owner or HR.
create policy bc_rw on buddy_conversations for all using (employee_id = auth.uid() or public.is_hr()) with check (employee_id = auth.uid() or public.is_hr());
create policy bm_rw on buddy_messages for all using (
  public.is_hr() or exists (select 1 from buddy_conversations c where c.id = conversation_id and c.employee_id = auth.uid())
) with check (
  public.is_hr() or exists (select 1 from buddy_conversations c where c.id = conversation_id and c.employee_id = auth.uid())
);

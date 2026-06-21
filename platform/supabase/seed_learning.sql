-- ============================================================================
-- Qore AI — Learning module sample data.
-- Run AFTER 0004_learning.sql and seed.sql (needs demo org + employee@qore.ai).
-- Idempotent: replaces its own seed rows by fixed id.
-- ============================================================================

do $$
declare
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_emp uuid := (select id from auth.users where email = 'employee@qore.ai');

  c_sys  uuid := '44444444-0000-0000-0000-000000000001';
  c_cloud uuid := '44444444-0000-0000-0000-000000000002';
  c_lead uuid := '44444444-0000-0000-0000-000000000003';
  c_arch uuid := '44444444-0000-0000-0000-000000000004';
  c_ds   uuid := '44444444-0000-0000-0000-000000000005';
  c_comm uuid := '44444444-0000-0000-0000-000000000006';

  r_mid    uuid := '44444444-0000-0000-0000-0000000000a1';
  r_senior uuid := '44444444-0000-0000-0000-0000000000a2';

  p_path uuid := '44444444-0000-0000-0000-0000000000b1';
begin
  if v_emp is null then
    raise exception 'Run seed.sql first (employee@qore.ai not found)';
  end if;

  -- Clean prior seed (children cascade).
  delete from competencies where id in (c_sys, c_cloud, c_lead, c_arch, c_ds, c_comm);
  delete from career_roles where id in (r_mid, r_senior);
  delete from learning_paths where id = p_path;
  delete from skill_gap_reports where employee_id = v_emp;
  delete from employee_skills where employee_id = v_emp;
  delete from courses where org_id = v_org and provider = 'lms';

  -- Competency framework.
  insert into competencies (id, org_id, name, category, description) values
  (c_sys,  v_org, 'System Design', 'Technical', 'Designing scalable systems'),
  (c_cloud,v_org, 'Cloud Fundamentals', 'Technical', 'Cloud platforms & services'),
  (c_lead, v_org, 'Leadership Skills', 'Behavioral', 'Leading and mentoring'),
  (c_arch, v_org, 'Architecture Patterns', 'Technical', 'Software architecture patterns'),
  (c_ds,   v_org, 'Data Structures', 'Technical', 'DS & algorithms'),
  (c_comm, v_org, 'Communication', 'Behavioral', 'Written & verbal communication');

  -- Career roles + the senior role's required competencies.
  insert into career_roles (id, org_id, title, level, description) values
  (r_mid,    v_org, 'Software Engineer', 'Mid', 'Builds features independently'),
  (r_senior, v_org, 'Senior Software Engineer', 'Senior', 'Owns systems and mentors others');

  insert into role_competencies (role_id, competency_id, required_level) values
  (r_senior, c_sys, 4), (r_senior, c_cloud, 4), (r_senior, c_lead, 3),
  (r_senior, c_arch, 4), (r_senior, c_ds, 4), (r_senior, c_comm, 4);

  -- Employee's current skill levels.
  insert into employee_skills (employee_id, competency_id, level, source) values
  (v_emp, c_sys, 2, '{assessment}'), (v_emp, c_cloud, 2, '{resume}'),
  (v_emp, c_lead, 1, '{self}'), (v_emp, c_arch, 2, '{assessment}'),
  (v_emp, c_ds, 4, '{assessment}'), (v_emp, c_comm, 3, '{manager}');

  -- A small internal LMS catalog.
  insert into courses (org_id, provider, title, url, description, skills, duration_minutes, level) values
  (v_org, 'lms', 'System Design Bootcamp (Internal)', 'https://lms.example.com/sysdesign', 'Internal LMS course', '{System Design}', 360, 'Intermediate'),
  (v_org, 'lms', 'Cloud Foundations (Internal)', 'https://lms.example.com/cloud', 'Internal LMS course', '{Cloud Fundamentals}', 240, 'Beginner'),
  (v_org, 'lms', 'Leading Without Authority', 'https://lms.example.com/leadership', 'Internal LMS course', '{Leadership Skills}', 180, 'Intermediate');

  -- A pre-computed skill-gap report (employee can re-run AI analysis anytime).
  insert into skill_gap_reports (employee_id, target_role_id, readiness_score, gaps, reasoning) values
  (v_emp, r_senior, 58,
   '[{"competency":"System Design","current":2,"required":4},
     {"competency":"Cloud Fundamentals","current":2,"required":4},
     {"competency":"Leadership Skills","current":1,"required":3},
     {"competency":"Architecture Patterns","current":2,"required":4}]'::jsonb,
   'Strong fundamentals (data structures, communication). To reach Senior, focus on system design, cloud, architecture, and leadership.');

  -- An active learning path with ordered steps.
  insert into learning_paths (id, employee_id, target_role_id, title, status)
  values (p_path, v_emp, r_senior, 'Path to Senior Software Engineer', 'active');

  insert into path_items (path_id, ord, title, competency_id, status) values
  (p_path, 0, 'System Design Fundamentals', c_sys, 'in_progress'),
  (p_path, 1, 'Cloud Fundamentals (AWS)', c_cloud, 'not_started'),
  (p_path, 2, 'Architecture Patterns', c_arch, 'not_started'),
  (p_path, 3, 'Leadership Skills', c_lead, 'not_started');

  -- One completed course (so learning hours/certifications show) + a certification.
  insert into courses (org_id, provider, title, url, skills, duration_minutes, level)
  values (v_org, 'youtube', 'Intro to System Design', 'https://youtube.com', '{System Design}', 90, 'Beginner')
  on conflict do nothing;

  insert into enrollments (employee_id, course_id, status, progress_pct, hours_spent, completed_at)
  select v_emp, id, 'completed', 100, 1.5, now()
  from courses where title = 'Intro to System Design' limit 1
  on conflict (employee_id, course_id) do nothing;

  insert into certifications (employee_id, name, issuer, issued_date)
  values (v_emp, 'AWS Cloud Practitioner', 'Amazon Web Services', current_date - 60);
end $$;

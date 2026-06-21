-- ============================================================================
-- Qore AI — sample jobs + applications so dashboards/analytics aren't empty.
-- Run AFTER seed.sql (needs the demo org + hr@/candidate@ accounts).
-- Idempotent: it deletes its own seed rows (by fixed id) and re-inserts.
-- ============================================================================

do $$
declare
  v_org   uuid := '11111111-1111-1111-1111-111111111111';
  v_hr    uuid := (select id from auth.users where email = 'hr@qore.ai');
  v_cand  uuid := (select id from auth.users where email = 'candidate@qore.ai');

  -- Fixed ids so re-runs replace cleanly.
  j1 uuid := '22222222-0000-0000-0000-000000000001'; -- Senior Frontend (active/external)
  j2 uuid := '22222222-0000-0000-0000-000000000002'; -- Backend Node    (active/external)
  j3 uuid := '22222222-0000-0000-0000-000000000003'; -- Data Analyst    (active/internal)
  j4 uuid := '22222222-0000-0000-0000-000000000004'; -- DevOps          (closed/external)
  j5 uuid := '22222222-0000-0000-0000-000000000005'; -- ML Engineer     (draft/external)

  a1 uuid := '33333333-0000-0000-0000-000000000001'; -- hired
  a2 uuid := '33333333-0000-0000-0000-000000000002'; -- assessment_passed
  a3 uuid := '33333333-0000-0000-0000-000000000003'; -- ats_rejected
  a4 uuid := '33333333-0000-0000-0000-000000000004'; -- hr_review
begin
  if v_hr is null or v_cand is null then
    raise exception 'Run seed.sql first (hr@qore.ai / candidate@qore.ai not found)';
  end if;

  -- Clean previous seed rows (cascades to applications/assessments/events).
  delete from jobs where id in (j1, j2, j3, j4, j5);

  -- ---------- Jobs ----------
  insert into jobs (id, org_id, title, department, location, employment_type, experience_required,
                    skills_required, salary_min, salary_max, description, responsibilities, requirements,
                    ats_threshold, test_threshold, hiring_manager, openings, deadline, visibility, status,
                    public_slug, created_by, created_at) values
  (j1, v_org, 'Senior Frontend Engineer', 'Engineering', 'Remote', 'Full-time', '4-6 years',
   array['React','TypeScript','Next.js','CSS'], 1800000, 2800000,
   'Build delightful, performant web experiences for our hiring platform.',
   'Own features end to end; mentor juniors; collaborate with design.',
   'Strong React + TypeScript; experience with Next.js and design systems.',
   60, 60, 'Hari HR', 2, current_date + 30, 'external', 'active',
   'senior-frontend-engineer-seed01', v_hr, now() - interval '20 days'),

  (j2, v_org, 'Backend Engineer (Node.js)', 'Engineering', 'Bengaluru', 'Full-time', '3-5 years',
   array['Node.js','PostgreSQL','REST APIs','AWS'], 1600000, 2500000,
   'Design and scale the APIs powering AI screening and assessments.',
   'Build services; own data models; ensure reliability and security.',
   'Solid Node.js + SQL; API design; cloud deployment experience.',
   65, 60, 'Hari HR', 1, current_date + 21, 'external', 'active',
   'backend-engineer-node-seed02', v_hr, now() - interval '14 days'),

  (j3, v_org, 'Data Analyst', 'Analytics', 'Remote', 'Full-time', '2-4 years',
   array['SQL','Python','Excel','Dashboards'], 900000, 1500000,
   'Turn hiring data into insights for the recruitment team.',
   'Build reports; analyze funnels; partner with HR leadership.',
   'Strong SQL + Python; comfort with BI dashboards.',
   55, 55, 'Hari HR', 1, current_date + 18, 'internal', 'active',
   'data-analyst-seed03', v_hr, now() - interval '10 days'),

  (j4, v_org, 'DevOps Engineer', 'Platform', 'Remote', 'Full-time', '5-8 years',
   array['Kubernetes','Terraform','CI/CD','AWS'], 2000000, 3200000,
   'Own infrastructure, deployments, and observability.',
   'Manage clusters; automate pipelines; improve reliability.',
   'Deep K8s + IaC; production on-call experience.',
   70, 65, 'Hari HR', 1, current_date - 3, 'external', 'closed',
   'devops-engineer-seed04', v_hr, now() - interval '40 days'),

  (j5, v_org, 'Machine Learning Engineer', 'AI', 'Remote', 'Full-time', '4-7 years',
   array['Python','PyTorch','LLMs','MLOps'], 2200000, 3600000,
   'Build the models behind resume screening and interview scoring.',
   'Train/evaluate models; ship to production; measure impact.',
   'Strong ML fundamentals; LLM and MLOps experience.',
   65, 60, 'Hari HR', 1, current_date + 25, 'external', 'draft',
   'ml-engineer-seed05', v_hr, now() - interval '2 days');

  -- ---------- Applications (one candidate, one per job) ----------
  insert into applications (id, job_id, candidate_id, current_company, current_role, experience,
                            notice_period, expected_salary, skills, linkedin, portfolio, parsed,
                            ats_score, ats_breakdown, ats_reasoning, assessment_score, status,
                            interview_attempts, created_at) values
  (a1, j1, v_cand, 'PixelWorks', 'Frontend Engineer', '5 years', '30 days', '2600000',
   array['React','TypeScript','Next.js','CSS'], 'https://linkedin.com/in/cara', 'https://github.com/cara',
   '{"name":"Cara Candidate","skills":["React","TypeScript","Next.js"],"education":["B.Tech CSE"],"experience":["PixelWorks (5y)"]}'::jsonb,
   88, '{"skill":27,"experience":22,"education":10,"domain":14,"keyword":8,"project":7}'::jsonb,
   'Excellent skill and experience match for a senior frontend role.', 82, 'hired', 1,
   now() - interval '18 days'),

  (a2, j2, v_cand, 'PixelWorks', 'Frontend Engineer', '5 years', '30 days', '2400000',
   array['Node.js','PostgreSQL','REST APIs'], 'https://linkedin.com/in/cara', 'https://github.com/cara',
   '{"name":"Cara Candidate","skills":["Node.js","PostgreSQL"],"education":["B.Tech CSE"]}'::jsonb,
   74, '{"skill":22,"experience":18,"education":10,"domain":12,"keyword":7,"project":5}'::jsonb,
   'Good backend fundamentals; some gaps in AWS depth.', 70, 'assessment_passed', 1,
   now() - interval '8 days'),

  (a3, j3, v_cand, 'PixelWorks', 'Frontend Engineer', '5 years', '30 days', '1400000',
   array['Excel'], 'https://linkedin.com/in/cara', 'https://github.com/cara',
   '{"name":"Cara Candidate","skills":["Excel"]}'::jsonb,
   41, '{"skill":10,"experience":12,"education":9,"domain":4,"keyword":3,"project":3}'::jsonb,
   'Limited SQL/Python evidence for an analytics role.', null, 'ats_rejected', 0,
   now() - interval '6 days'),

  (a4, j4, v_cand, 'PixelWorks', 'Frontend Engineer', '5 years', '30 days', '3000000',
   array['AWS','CI/CD'], 'https://linkedin.com/in/cara', 'https://github.com/cara',
   '{"name":"Cara Candidate","skills":["AWS","CI/CD"]}'::jsonb,
   79, '{"skill":21,"experience":20,"education":10,"domain":13,"keyword":8,"project":7}'::jsonb,
   'Reasonable platform exposure; proceed to review.', 68, 'hr_review', 1,
   now() - interval '12 days');

  -- ---------- Assessments ----------
  insert into assessments (application_id, technical_score, behavioral_score, coding_score, aptitude_score,
                           proctoring_integrity_score, overall_score, violations, ai_feedback) values
  (a1, 85, 80, 90, 78, 95, 82, '[]'::jsonb, 'Strong technical interview; clear communication.'),
  (a2, 72, 68, 75, 70, 90, 70, '[{"type":"looking_away"}]'::jsonb, 'Solid fundamentals; minor proctoring flag.'),
  (a4, 66, 70, 64, 69, 88, 68, '[]'::jsonb, 'Borderline pass; recommended for HR review.');

  -- ---------- Timeline events ----------
  insert into application_events (application_id, type, message, created_at) values
  -- a1: full journey ending in a hire (drives time-to-hire ~17 days)
  (a1, 'applied', 'Application submitted.', now() - interval '18 days'),
  (a1, 'ats_passed', 'ATS screening passed (88/100).', now() - interval '18 days'),
  (a1, 'assessment_passed', 'Assessment passed (82/100).', now() - interval '15 days'),
  (a1, 'interview_decision', 'AI interview decision: Recommended for HR review.', now() - interval '12 days'),
  (a1, 'interview_scheduled', 'Interview scheduled.', now() - interval '8 days'),
  (a1, 'offer_released', 'Offer released.', now() - interval '4 days'),
  (a1, 'stage_change', 'Candidate accepted the offer.', now() - interval '1 days'),
  -- a2
  (a2, 'applied', 'Application submitted.', now() - interval '8 days'),
  (a2, 'ats_passed', 'ATS screening passed (74/100).', now() - interval '8 days'),
  (a2, 'assessment_passed', 'Assessment passed (70/100).', now() - interval '5 days'),
  -- a3
  (a3, 'applied', 'Application submitted.', now() - interval '6 days'),
  (a3, 'ats_failed', 'Rejected — ATS criteria not met (41/100).', now() - interval '6 days'),
  -- a4
  (a4, 'applied', 'Application submitted.', now() - interval '12 days'),
  (a4, 'ats_passed', 'ATS screening passed (79/100).', now() - interval '12 days'),
  (a4, 'assessment_passed', 'Assessment passed (68/100).', now() - interval '9 days'),
  (a4, 'stage_change', 'HR moved candidate to "hr_review".', now() - interval '7 days');
end $$;

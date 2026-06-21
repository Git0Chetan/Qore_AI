-- ============================================================================
-- Qore AI — seed login accounts (one per role).
-- Run ONCE in the Supabase SQL editor after 0001/0002/0003 migrations.
-- Safe to re-run: existing emails are skipped.
--
-- Logins created (email / password):
--   Super Admin        admin@qore.ai      / Admin@12345
--   HR / Admin         hr@qore.ai         / Hr@123456
--   Internal Employee  employee@qore.ai   / Employee@123
--   External Candidate candidate@qore.ai  / Candidate@123
-- ============================================================================

create extension if not exists pgcrypto;

-- A demo organization so HR/Admin land in a configured org.
insert into organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Qore AI Demo Org')
on conflict (id) do nothing;

-- Helper: create an auth user + identity. The handle_new_user trigger then
-- inserts the matching profiles row (reading role/name/mobile/aadhaar below).
create or replace function public.seed_user(
  p_email text,
  p_password text,
  p_role user_role,
  p_name text,
  p_mobile text,
  p_aadhaar text
) returns uuid
language plpgsql
as $$
declare
  uid uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = p_email) then
    return null;  -- already seeded
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name, 'role', p_role::text, 'mobile', p_mobile, 'aadhaar', p_aadhaar),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid,
    jsonb_build_object('sub', uid::text, 'email', p_email),
    'email', uid::text, now(), now(), now()
  );

  return uid;
end;
$$;

-- Create the four accounts.
select public.seed_user('admin@qore.ai',     'Admin@12345',   'super_admin',        'Sara Admin',     '9000000001', null);
select public.seed_user('hr@qore.ai',        'Hr@123456',     'hr_admin',           'Hari HR',        '9000000002', null);
select public.seed_user('employee@qore.ai',  'Employee@123',  'internal_employee',  'Ian Employee',   '9000000003', '111122223333');
select public.seed_user('candidate@qore.ai', 'Candidate@123', 'external_candidate', 'Cara Candidate', '9000000004', '444455556666');

-- Attach staff (not external candidates) to the demo org.
update profiles
set org_id = '11111111-1111-1111-1111-111111111111'
where email in ('admin@qore.ai', 'hr@qore.ai', 'employee@qore.ai');

-- Clean up the helper.
drop function public.seed_user(text, text, user_role, text, text, text);

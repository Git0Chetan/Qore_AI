-- ============================================================================
-- Qore AI — Phase 2 follow-up: cap AI interview attempts per application.
-- Run after 0002_phase2.sql.
-- ============================================================================

alter table applications
  add column if not exists interview_attempts int not null default 0;

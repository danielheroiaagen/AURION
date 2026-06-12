-- Phase 30 rollback: remove post-call intelligence columns.

ALTER TABLE voice_sessions
  DROP COLUMN IF EXISTS caller_number,
  DROP COLUMN IF EXISTS ai_summary,
  DROP COLUMN IF EXISTS ai_insights;

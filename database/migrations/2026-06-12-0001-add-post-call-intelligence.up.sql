-- Phase 30: post-call intelligence fields on voice_sessions.
-- All three columns are nullable TEXT; encryption happens at the application
-- layer (ADR-011), not here. Existing rows remain untouched — additive only.

ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS caller_number TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary    TEXT,
  ADD COLUMN IF NOT EXISTS ai_insights   TEXT;

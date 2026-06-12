-- Reverse the call QA transcript retention migration.

BEGIN;

DROP TRIGGER IF EXISTS voice_session_turns_append_only ON voice_session_turns;
DROP POLICY IF EXISTS voice_session_turns_isolation ON voice_session_turns;
DROP TABLE IF EXISTS voice_session_turns;

COMMIT;

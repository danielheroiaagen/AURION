import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr039Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-039-call-qa-transcript-retention.md"

    def test_adr_exists_and_decides_transcript_retention(self):
        text = read(self.ADR)
        for marker in [
            "voice_session_turns",
            "append-only",
            "AES-256-GCM",
            "conversation:review",
            "best-effort",
        ]:
            self.assertIn(marker, text)

    def test_phase30_plan_exists(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-30-call-qa-plan.md").exists()
        )


class MigrationTests(unittest.TestCase):
    UP = (
        ROOT
        / "database"
        / "migrations"
        / "2026-06-12-0003-call-qa-transcript-turns.up.sql"
    )
    DOWN = (
        ROOT
        / "database"
        / "migrations"
        / "2026-06-12-0003-call-qa-transcript-turns.down.sql"
    )

    def test_migration_creates_an_encrypted_append_only_tenant_scoped_table(self):
        up = read(self.UP)
        self.assertIn("CREATE TABLE voice_session_turns", up)
        # Tenant isolation, append-only evidence, idempotency key.
        self.assertIn("ENABLE ROW LEVEL SECURITY", up)
        self.assertIn("aurion_current_tenant_id()", up)
        self.assertIn("aurion_block_mutation", up)
        self.assertIn("UNIQUE (tenant_id, voice_session_id, turn_index)", up)
        # Sessions are never hard-deleted from under a transcript.
        self.assertIn("ON DELETE RESTRICT", up)

    def test_down_migration_drops_the_table(self):
        self.assertIn("DROP TABLE IF EXISTS voice_session_turns", read(self.DOWN))

    def test_schema_type_mirrors_the_table(self):
        schema = read(API / "src" / "database" / "database.schema.ts")
        self.assertIn("VoiceSessionTurnsTable", schema)
        self.assertIn("voice_session_turns: VoiceSessionTurnsTable", schema)


class ApiTests(unittest.TestCase):
    def test_transcript_endpoints_are_gated_and_idempotent(self):
        controller = read(
            API
            / "src"
            / "modules"
            / "voice-sessions"
            / "http"
            / "voice-sessions.controller.ts"
        )
        self.assertIn("':id/turns'", controller)
        # Write is the voice agent's; read is QA review.
        self.assertIn("@RequirePermission('conversation:write')", controller)
        self.assertIn("@RequirePermission('conversation:review')", controller)

        repo = read(
            API
            / "src"
            / "modules"
            / "voice-sessions"
            / "infrastructure"
            / "kysely-transcript.repository.ts"
        )
        self.assertIn("this.crypto.encrypt", repo)
        self.assertIn("doNothing", repo)  # idempotent append

    def test_openapi_artifact_exposes_the_turns_endpoint(self):
        spec = json.loads(read(ROOT / "32_API_REFERENCE" / "openapi.json"))
        self.assertIn("/api/v1/voice-sessions/{id}/turns", spec["paths"])


class GatewayTests(unittest.TestCase):
    def test_gateway_flushes_the_transcript_best_effort(self):
        client = read(GATEWAY / "src" / "infrastructure" / "aurion-api.client.ts")
        self.assertIn("recordTranscript", client)
        self.assertIn("/turns", client)
        engine = read(GATEWAY / "src" / "application" / "conversation-engine.ts")
        self.assertIn("flushTranscript", engine)
        # Best-effort: guarded by an optional port method and a try/catch.
        self.assertIn("this.api.recordTranscript", engine)


if __name__ == "__main__":
    unittest.main()

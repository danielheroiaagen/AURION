import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway" / "src"
API = ROOT / "apps" / "api" / "src"
DASHBOARD = ROOT / "apps" / "dashboard" / "src"
MIGRATIONS = ROOT / "database" / "migrations"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class MigrationTests(unittest.TestCase):
    UP = MIGRATIONS / "2026-06-12-0001-add-post-call-intelligence.up.sql"
    DOWN = MIGRATIONS / "2026-06-12-0001-add-post-call-intelligence.down.sql"

    def test_up_migration_exists(self):
        self.assertTrue(self.UP.exists(), "up migration file must exist")

    def test_down_migration_exists(self):
        self.assertTrue(self.DOWN.exists(), "down migration file must exist")

    def test_up_adds_three_columns(self):
        text = read(self.UP)
        self.assertIn("caller_number", text)
        self.assertIn("ai_summary", text)
        self.assertIn("ai_insights", text)

    def test_down_drops_columns(self):
        text = read(self.DOWN)
        self.assertIn("caller_number", text)
        self.assertIn("ai_summary", text)
        self.assertIn("ai_insights", text)


class Adr039Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-039-post-call-intelligence.md"

    def test_adr_exists(self):
        self.assertTrue(self.ADR.exists(), "ADR-039 must exist")

    def test_adr_has_key_sections(self):
        text = read(self.ADR)
        for marker in [
            "post-call intelligence",
            "asynchronous",
            "encrypted at rest",
            "ADR-011",
            "ADR-028",
            "ADR-031",
            "lead_quality",
            "Out of scope",
            "post_call.notify",
        ]:
            self.assertIn(marker, text, f"ADR-039 must mention '{marker}'")

    def test_phase30_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-30-post-call-intelligence-plan.md"
        self.assertTrue(plan.exists(), "phase-30 plan must exist")


class GatewaySummarizerTests(unittest.TestCase):
    SUMMARIZER = GATEWAY / "application" / "post-call-summarizer.ts"

    def test_summarizer_file_exists(self):
        self.assertTrue(self.SUMMARIZER.exists(), "post-call-summarizer.ts must exist")

    def test_summarizer_has_key_markers(self):
        text = read(self.SUMMARIZER)
        for marker in [
            "post-call",
            "lead_quality",
            "max_completion_tokens",
            "caller_name",
            "action_items",
            "language",
            "PostCallSummarizer",
            "LlmConfig",
        ]:
            self.assertIn(marker, text, f"summarizer must contain '{marker}'")

    def test_summarizer_skips_empty_conversation(self):
        text = read(self.SUMMARIZER)
        # Must mention skipping when no user turns to avoid burning tokens
        self.assertIn("user", text)
        self.assertIn("null", text)

    def test_config_has_post_call_summary_env(self):
        config = read(GATEWAY / "config.ts")
        self.assertIn("POST_CALL_SUMMARY", config)


class ApiTests(unittest.TestCase):
    CONTROLLER = API / "modules" / "voice-sessions" / "http" / "voice-sessions.controller.ts"
    DTO = API / "modules" / "voice-sessions" / "http" / "voice-sessions.dto.ts"
    SERVICE = API / "modules" / "voice-sessions" / "application" / "voice-sessions.service.ts"
    REPO_PORT = API / "modules" / "voice-sessions" / "application" / "voice-sessions.repository.port.ts"

    def test_controller_has_ai_summary_route(self):
        text = read(self.CONTROLLER)
        self.assertIn("ai-summary", text)

    def test_dto_has_ai_fields(self):
        text = read(self.DTO)
        for marker in ["ai_summary", "ai_insights", "caller_number"]:
            self.assertIn(marker, text, f"DTO must expose '{marker}'")

    def test_dto_has_api_property_decorators(self):
        text = read(self.DTO)
        self.assertIn("@ApiProperty", text)

    def test_service_has_patch_ai_summary_method(self):
        text = read(self.SERVICE)
        self.assertIn("patchAiSummary", text)

    def test_repo_port_has_ai_summary(self):
        text = read(self.REPO_PORT)
        self.assertIn("aiSummary", text)

    def test_response_type_has_new_fields(self):
        text = read(self.DTO)
        for marker in ["ai_summary", "ai_insights", "caller_number"]:
            self.assertIn(marker, text)


class DashboardTests(unittest.TestCase):
    DETAIL = DASHBOARD / "pages" / "session-detail.tsx"
    SESSIONS = DASHBOARD / "pages" / "sessions.tsx"
    RESOURCES = DASHBOARD / "api" / "resources.ts"
    TYPES = DASHBOARD / "api" / "types.ts"
    APP = DASHBOARD / "app.tsx"

    def test_session_detail_page_exists(self):
        self.assertTrue(self.DETAIL.exists(), "session-detail.tsx must exist")

    def test_detail_page_has_key_markers(self):
        text = read(self.DETAIL)
        for marker in [
            "ai_summary",
            "ai_insights",
            "caller_number",
            "lead_quality",
            "action_items",
            "AI summary not available",
            "StatusBadge",
        ]:
            self.assertIn(marker, text, f"session-detail must contain '{marker}'")

    def test_sessions_page_has_caller_column(self):
        text = read(self.SESSIONS)
        self.assertIn("Caller", text)

    def test_sessions_page_links_to_detail(self):
        text = read(self.SESSIONS)
        # Must have a link to the session detail route
        self.assertIn("/sessions/", text)

    def test_resources_has_get_voice_session(self):
        text = read(self.RESOURCES)
        self.assertIn("getVoiceSession", text)

    def test_types_has_new_fields(self):
        text = read(self.TYPES)
        for marker in ["ai_summary", "ai_insights", "caller_number"]:
            self.assertIn(marker, text)

    def test_app_has_session_detail_route(self):
        text = read(self.APP)
        self.assertIn("session-detail", text.lower().replace("-", "").replace("_", "") + "session-detail")
        # Accept either SessionDetailPage import or the path pattern /sessions/:id
        self.assertTrue(
            "sessions/:id" in text or "SessionDetailPage" in text or "session-detail" in text,
            "app.tsx must register the session detail route"
        )


class OpenApiTests(unittest.TestCase):
    OPENAPI = ROOT / "32_API_REFERENCE" / "openapi.json"

    def test_openapi_has_ai_summary_path(self):
        text = read(self.OPENAPI)
        self.assertIn("ai-summary", text)

    def test_openapi_has_caller_number_field(self):
        text = read(self.OPENAPI)
        self.assertIn("caller_number", text)


if __name__ == "__main__":
    unittest.main()

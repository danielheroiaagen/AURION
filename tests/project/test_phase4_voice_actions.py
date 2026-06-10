import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API_SRC = ROOT / "apps" / "api" / "src"
API_TEST = ROOT / "apps" / "api" / "test"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class VoiceSessionsModuleTests(unittest.TestCase):
    BASE = API_SRC / "modules" / "voice-sessions"

    def test_module_files_exist(self):
        for relative in [
            "voice-sessions.module.ts",
            "domain/voice-session.ts",
            "application/voice-sessions.repository.port.ts",
            "application/voice-sessions.service.ts",
            "infrastructure/kysely-voice-sessions.repository.ts",
            "http/voice-sessions.controller.ts",
            "http/voice-sessions.dto.ts",
        ]:
            self.assertTrue((self.BASE / relative).exists(), relative)

    def test_lifecycle_is_explicit_with_terminal_states(self):
        source = read(self.BASE / "domain" / "voice-session.ts")
        for status in ["started", "active", "completed", "failed", "cancelled"]:
            self.assertIn(status, source)
        self.assertIn("canTransition", source)

    def test_summary_is_encrypted_in_the_repository_adapter(self):
        source = read(self.BASE / "infrastructure" / "kysely-voice-sessions.repository.ts")
        self.assertIn("FieldEncryptionService", source)
        self.assertIn("encrypt", source)
        self.assertIn("isEncrypted", source)

    def test_start_is_idempotent_on_external_session_id(self):
        source = read(self.BASE / "application" / "voice-sessions.service.ts")
        self.assertIn("findByExternalSessionId", source)
        self.assertIn("created: false", source)


class ControlledActionsModuleTests(unittest.TestCase):
    BASE = API_SRC / "modules" / "actions"

    def test_module_files_exist(self):
        for relative in [
            "actions.module.ts",
            "domain/controlled-action.ts",
            "application/controlled-actions.repository.port.ts",
            "application/controlled-actions.service.ts",
            "infrastructure/kysely-controlled-actions.repository.ts",
            "http/controlled-actions.controller.ts",
            "http/controlled-actions.dto.ts",
        ]:
            self.assertTrue((self.BASE / relative).exists(), relative)

    def test_idempotency_key_contract(self):
        dto = read(self.BASE / "http" / "controlled-actions.dto.ts")
        self.assertIn("Idempotency-Key", dto)
        service = read(self.BASE / "application" / "controlled-actions.service.ts")
        self.assertIn("canonicalJson", service)
        self.assertIn("different request payload", service)

    def test_approval_workflow_rules(self):
        service = read(self.BASE / "application" / "controlled-actions.service.ts")
        self.assertIn("Only human actors", service)
        self.assertIn("their own action", service)
        self.assertIn("assessGrant", service)
        self.assertIn("authorize", service)

    def test_payloads_are_encrypted_in_the_repository_adapter(self):
        source = read(self.BASE / "infrastructure" / "kysely-controlled-actions.repository.ts")
        self.assertIn("FieldEncryptionService", source)
        self.assertIn("ciphertext", source)

    def test_action_types_map_to_tool_permissions(self):
        domain = read(self.BASE / "domain" / "controlled-action.ts")
        self.assertIn("calendar.update", domain)
        self.assertIn("ticket.create", domain)
        self.assertIn("tool:execute:", domain)


class PolicyLayerTests(unittest.TestCase):
    def test_assess_grant_exists_without_approval_gate(self):
        source = read(API_SRC / "modules" / "auth" / "application" / "policy.service.ts")
        self.assertIn("assessGrant", source)
        self.assertIn("requiresHumanApproval", source)

    def test_new_permissions_in_catalog_and_docs(self):
        permissions = read(API_SRC / "modules" / "auth" / "domain" / "permissions.ts")
        self.assertIn("'conversation:write'", permissions)
        self.assertIn("'action:read'", permissions)
        doc = read(ROOT / "05_SECURITY" / "permissions.md")
        self.assertIn("`conversation:write`", doc)
        self.assertIn("`action:read`", doc)


class WiringAndDocsTests(unittest.TestCase):
    def test_app_module_wires_phase4_modules(self):
        source = read(API_SRC / "modules" / "app.module.ts")
        self.assertIn("VoiceSessionsModule", source)
        self.assertIn("ActionsModule", source)

    def test_integration_suite_proves_encryption_at_rest(self):
        spec = API_TEST / "integration" / "voice-actions.spec.ts"
        self.assertTrue(spec.exists())
        source = read(spec)
        self.assertIn("enc:v1:", source)
        self.assertIn("Idempotency", source)
        self.assertIn("approve", source)

    def test_adr_013_records_the_decisions(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-013-voice-sessions-controlled-actions.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["Idempotency-Key", "assessGrant", "self-approval", "compare-and-set"]:
            self.assertIn(marker, text)

    def test_phase4_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-4-voice-actions-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-013", read(plan))


if __name__ == "__main__":
    unittest.main()

import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
GATEWAY = ROOT / "apps" / "voice-gateway"
RECEIVER = ROOT / "apps" / "hermes-receiver"
WORKFLOWS = ROOT / "29_HERMES_AGENT_WORKFORCE" / "n8n-workflows"

NEW_TYPES = ["email.send", "whatsapp.send"]
ALL_TYPES = ["ticket.create", "calendar.update", "email.send", "whatsapp.send"]


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr030Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-030-n8n-connectors.md"

    def test_adr_exists_and_decides_the_connector_backend(self):
        text = read(self.ADR)
        for marker in ["CONNECTOR_MODE", "n8n", "whatsapp.send", "email.send", "pending-configuration"]:
            self.assertIn(marker, text)

    def test_phase21_plan_exists(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-21-real-connectors-plan.md").exists()
        )


class CatalogTests(unittest.TestCase):
    def test_action_types_cover_the_four_channels(self):
        domain = read(API / "src" / "modules" / "actions" / "domain" / "controlled-action.ts")
        for action_type in ALL_TYPES:
            self.assertIn(f"'{action_type}'", domain)

    def test_permissions_and_matrix_grow_with_the_catalog(self):
        permissions = read(API / "src" / "modules" / "auth" / "domain" / "permissions.ts")
        matrix = read(API / "src" / "modules" / "auth" / "domain" / "permission-matrix.ts")
        doc = read(ROOT / "05_SECURITY" / "permissions.md")
        for action_type in NEW_TYPES:
            self.assertIn(f"tool:execute:{action_type}", permissions)
            self.assertIn(f"tool:execute:{action_type}", matrix)
            self.assertIn(f"tool:execute:{action_type}", doc)

    def test_openapi_artifact_knows_the_new_types(self):
        openapi = read(ROOT / "32_API_REFERENCE" / "openapi.json")
        for action_type in NEW_TYPES:
            self.assertIn(action_type, openapi)

    def test_brains_offer_the_new_tools(self):
        llm = read(GATEWAY / "src" / "infrastructure" / "llm-brain.ts")
        scripted = read(GATEWAY / "src" / "infrastructure" / "scripted-brain.ts")
        for action_type in NEW_TYPES:
            self.assertIn(action_type, llm)
            self.assertIn(action_type, scripted)


class ReceiverTests(unittest.TestCase):
    def test_n8n_mode_fails_closed_and_stamps_evidence(self):
        config = read(RECEIVER / "src" / "config.ts")
        self.assertIn("N8N_WEBHOOK_BASE is required", config)
        connector = read(RECEIVER / "src" / "infrastructure" / "n8n-connector.ts")
        self.assertIn("connector_mode: 'n8n'", connector.replace('"', "'"))
        self.assertIn("ConnectorError", connector)

    def test_receiver_stays_zero_dependency(self):
        pkg = json.loads(read(RECEIVER / "package.json"))
        self.assertNotIn("dependencies", pkg, "the receiver stays zero-dependency")

    def test_workflow_skeletons_exist_and_are_honest(self):
        for action_type in ALL_TYPES:
            path = WORKFLOWS / f"aurion-{action_type.replace('.', '-')}.json"
            self.assertTrue(path.exists(), path)
            workflow = json.loads(read(path))
            self.assertIn("pending-configuration", json.dumps(workflow))
            self.assertIn(f"aurion-{action_type}", json.dumps(workflow))

    def test_compose_passes_connector_settings(self):
        compose = read(ROOT / "docker-compose.yml")
        for var in ["CONNECTOR_MODE", "N8N_WEBHOOK_BASE", "N8N_SECRET"]:
            self.assertIn(var, compose)


if __name__ == "__main__":
    unittest.main()

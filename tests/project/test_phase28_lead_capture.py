import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API = ROOT / "apps" / "api"
GATEWAY = ROOT / "apps" / "voice-gateway"
RECEIVER = ROOT / "apps" / "hermes-receiver"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr037Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-037-lead-capture.md"

    def test_adr_exists(self):
        text = read(self.ADR)
        for marker in ["lead.capture", "voice_leads", "ORION", "approval-gated"]:
            self.assertIn(marker, text)


class LeadCaptureTests(unittest.TestCase):
    def test_catalog_includes_lead_capture_end_to_end(self):
        domain = read(API / "src" / "modules" / "actions" / "domain" / "controlled-action.ts")
        self.assertIn("'lead.capture'", domain)
        permissions = read(API / "src" / "modules" / "auth" / "domain" / "permissions.ts")
        matrix = read(API / "src" / "modules" / "auth" / "domain" / "permission-matrix.ts")
        for f in (permissions, matrix):
            self.assertIn("tool:execute:lead.capture", f)
        self.assertIn("lead.capture", read(ROOT / "32_API_REFERENCE" / "openapi.json"))
        self.assertIn("lead.capture", read(ROOT / "05_SECURITY" / "permissions.md"))

    def test_brains_offer_lead_capture(self):
        llm = read(GATEWAY / "src" / "infrastructure" / "llm-brain.ts")
        scripted = read(GATEWAY / "src" / "infrastructure" / "scripted-brain.ts")
        self.assertIn("lead.capture", llm)
        self.assertIn("lead.capture", scripted)

    def test_receiver_registers_lead_connector(self):
        main = read(RECEIVER / "src" / "main.ts")
        self.assertIn("lead.capture", main)
        self.assertIn("StubLeadConnector", read(RECEIVER / "src" / "infrastructure" / "stub-connectors.ts"))

    def test_lead_workflow_skeleton_exists(self):
        wf = ROOT / "29_HERMES_AGENT_WORKFORCE" / "n8n-workflows" / "aurion-lead-capture.json"
        self.assertTrue(wf.exists())
        data = json.loads(read(wf))
        self.assertIn("aurion-lead.capture", json.dumps(data))


if __name__ == "__main__":
    unittest.main()

import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
WIDGET = ROOT / "apps" / "widget"
SRC = WIDGET / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class WorkspaceTests(unittest.TestCase):
    def test_widget_workspace_exists_with_scripts(self):
        package = json.loads(read(WIDGET / "package.json"))
        self.assertEqual(package["name"], "@aurion/widget")
        for script in ["build", "test", "typecheck"]:
            self.assertIn(script, package["scripts"])

    def test_zero_runtime_dependencies(self):
        package = json.loads(read(WIDGET / "package.json"))
        # ADR-024: not even a framework.
        self.assertNotIn("dependencies", package)

    def test_ci_runs_widget_typecheck_tests_and_build(self):
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        for marker in [
            "npm --workspace @aurion/widget run typecheck",
            "npm --workspace @aurion/widget run test",
            "npm --workspace @aurion/widget run build",
        ]:
            self.assertIn(marker, ci)


class ProtocolTests(unittest.TestCase):
    def test_client_mirrors_the_gateway_event_contract(self):
        protocol = read(SRC / "protocol.ts")
        for event in [
            "session.start",
            "turn.user",
            "action.poll",
            "session.end",
            "session.started",
            "turn.agent",
            "action.requested",
            "approval_pending",
            "session.ended",
        ]:
            self.assertIn(event, protocol)

    def test_reconnect_resumes_the_same_conversation_record(self):
        client = read(SRC / "conversation-client.ts")
        self.assertIn("sessionStorage", client)
        self.assertIn("external_session_id", client)
        self.assertIn("forgetSession", client)

    def test_websocket_access_is_confined_to_the_client(self):
        for source in SRC.glob("*.ts"):
            if source.name in ("conversation-client.ts",):
                continue
            self.assertNotIn("new WebSocket", read(source), source)


class SpeechTests(unittest.TestCase):
    def test_speech_stays_local_with_availability_detection(self):
        speech = read(SRC / "speech.ts")
        self.assertIn("speechInputAvailable", speech)
        self.assertIn("speechSynthesis", speech)
        self.assertIn("webkitSpeechRecognition", speech)

    def test_ui_surfaces_approval_pending_to_the_caller(self):
        main = read(SRC / "main.ts")
        self.assertIn("awaiting human approval", main)
        self.assertIn("speechInputAvailable", main)


class DocsTests(unittest.TestCase):
    def test_adr_024_records_the_decision_and_the_deferral(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-024-caller-voice-widget.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in [
            "browser-native speech",
            "media server is deliberately NOT introduced",
            "external_session_id",
            "zero-runtime",
        ]:
            self.assertIn(marker, text)

    def test_phase14_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-14-caller-widget-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-024", read(plan))


if __name__ == "__main__":
    unittest.main()

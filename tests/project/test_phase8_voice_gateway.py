import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"
SRC = GATEWAY / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class WorkspaceTests(unittest.TestCase):
    def test_gateway_workspace_exists_with_scripts(self):
        package = json.loads(read(GATEWAY / "package.json"))
        self.assertEqual(package["name"], "@aurion/voice-gateway")
        for script in ["build", "start", "test", "typecheck"]:
            self.assertIn(script, package["scripts"])

    def test_runtime_dependency_tree_is_minimal(self):
        package = json.loads(read(GATEWAY / "package.json"))
        # ADR-018: ws and NOTHING else at runtime — no Nest, no LLM SDKs.
        self.assertEqual(set(package["dependencies"]), {"ws"})

    def test_ci_runs_gateway_typecheck_tests_and_build(self):
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        for marker in [
            "npm --workspace @aurion/voice-gateway run typecheck",
            "npm --workspace @aurion/voice-gateway run test",
            "npm --workspace @aurion/voice-gateway run build",
        ]:
            self.assertIn(marker, ci)


class ArchitectureTests(unittest.TestCase):
    def test_hexagonal_layout(self):
        for relative in [
            "config.ts",
            "domain/conversation.ts",
            "application/ports.ts",
            "application/conversation-engine.ts",
            "infrastructure/scripted-brain.ts",
            "infrastructure/aurion-api.client.ts",
            "infrastructure/protocol.ts",
            "infrastructure/ws-server.ts",
            "main.ts",
        ]:
            self.assertTrue((SRC / relative).exists(), relative)

    def test_the_gateway_never_executes_actions(self):
        ports = read(SRC / "application" / "ports.ts")
        self.assertIn("requestAction", ports)
        self.assertNotIn("executeAction", ports)
        engine = read(SRC / "application" / "conversation-engine.ts")
        self.assertNotIn("executeAction", engine)
        self.assertNotIn("/execute", engine)

    def test_action_requests_are_turn_keyed_idempotent(self):
        engine = read(SRC / "application" / "conversation-engine.ts")
        self.assertIn("vg:${sessionId}:${turn}", engine)
        client = read(SRC / "infrastructure" / "aurion-api.client.ts")
        self.assertIn("idempotency-key", client)

    def test_fail_closed_config(self):
        config = read(SRC / "config.ts")
        for marker in [
            "AURION_API_URL",
            "VOICE_AGENT_TOKEN",
            "VOICE_GATEWAY_CLIENT_KEYS",
            "BRAIN_MODE",
            "throw new Error",
        ]:
            self.assertIn(marker, config)

    def test_handshake_is_key_gated_and_drop_closes_failed(self):
        server = read(SRC / "infrastructure" / "ws-server.ts")
        self.assertIn("4401", server)
        self.assertIn("abort('connection_dropped')", server)

    def test_abrupt_sessions_never_end_silently(self):
        engine = read(SRC / "application" / "conversation-engine.ts")
        self.assertIn("'failed'", engine)
        self.assertIn("abort", engine)


class ContractDocsTests(unittest.TestCase):
    def test_websocket_event_contract_is_documented(self):
        doc = ROOT / "27_VOICE_IVR" / "websocket-event-contracts.md"
        self.assertTrue(doc.exists())
        text = read(doc)
        for marker in [
            "session.start",
            "turn.user",
            "action.poll",
            "session.end",
            "session.started",
            "turn.agent",
            "action.requested",
            "approval_pending",
            "4401",
        ]:
            self.assertIn(marker, text)

    def test_adr_018_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-018-voice-gateway-runtime.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in [
            "AgentBrainPort",
            "voice_agent",
            "never executes",
            "Turn-keyed idempotency",
            "Fail-closed startup",
        ]:
            self.assertIn(marker, text)

    def test_env_example_documents_the_gateway_contract(self):
        env = read(ROOT / ".env.example")
        for marker in [
            "AURION_API_URL",
            "VOICE_AGENT_TOKEN",
            "VOICE_GATEWAY_CLIENT_KEYS",
            "BRAIN_MODE",
        ]:
            self.assertIn(marker, env)

    def test_phase8_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-8-voice-gateway-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-018", read(plan))


if __name__ == "__main__":
    unittest.main()

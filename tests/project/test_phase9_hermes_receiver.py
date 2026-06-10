import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
RECEIVER = ROOT / "apps" / "hermes-receiver"
SRC = RECEIVER / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class WorkspaceTests(unittest.TestCase):
    def test_receiver_workspace_exists_with_scripts(self):
        package = json.loads(read(RECEIVER / "package.json"))
        self.assertEqual(package["name"], "@aurion/hermes-receiver")
        for script in ["build", "start", "test", "typecheck"]:
            self.assertIn(script, package["scripts"])

    def test_zero_runtime_dependencies(self):
        package = json.loads(read(RECEIVER / "package.json"))
        # ADR-019: node:http + node:crypto only — no runtime deps at all.
        self.assertNotIn("dependencies", package)

    def test_ci_runs_receiver_typecheck_tests_and_build(self):
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        for marker in [
            "npm --workspace @aurion/hermes-receiver run typecheck",
            "npm --workspace @aurion/hermes-receiver run test",
            "npm --workspace @aurion/hermes-receiver run build",
        ]:
            self.assertIn(marker, ci)


class SecurityTests(unittest.TestCase):
    def test_signature_is_verified_before_parsing(self):
        server = read(SRC / "infrastructure" / "http-server.ts")
        self.assertIn("verifyDispatchSignature", server)
        # The signature check appears before JSON.parse in the handler body.
        self.assertLess(server.index("verifyDispatchSignature("), server.index("JSON.parse"))

    def test_constant_time_comparison_and_staleness_window(self):
        signature = read(SRC / "security" / "signature.ts")
        self.assertIn("timingSafeEqual", signature)
        self.assertIn("stale_timestamp", signature)
        # Staleness is evaluated only after authenticity.
        self.assertLess(signature.index("timingSafeEqual"), signature.index("stale_timestamp'"))

    def test_fail_closed_config(self):
        config = read(SRC / "config.ts")
        self.assertIn("HERMES_RECEIVER_SECRET", config)
        self.assertIn("throw new Error", config)
        self.assertIn("32", config)


class DispatchSemanticsTests(unittest.TestCase):
    def test_dedupe_by_action_id_with_lru_cap(self):
        handler = read(SRC / "application" / "dispatch-handler.ts")
        self.assertIn("DedupeStore", handler)
        self.assertIn("replayed: true", handler)
        self.assertIn("capacity", handler)

    def test_unknown_action_types_are_explicit_rejections(self):
        handler = read(SRC / "application" / "dispatch-handler.ts")
        self.assertIn("unknown_action_type", handler)
        self.assertIn("422", handler)

    def test_stub_connectors_are_honest(self):
        stubs = read(SRC / "infrastructure" / "stub-connectors.ts")
        self.assertIn("connector_mode", stubs)
        self.assertIn("'stub'", stubs)
        for action_type in ["ticket.create", "calendar.update"]:
            self.assertIn(action_type, stubs)

    def test_connector_port_seam_exists(self):
        port = read(SRC / "application" / "connector.port.ts")
        self.assertIn("ConnectorPort", port)
        self.assertIn("ConnectorRegistry", port)


class DocsTests(unittest.TestCase):
    def test_adr_019_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-019-hermes-receiver.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in [
            "zero-runtime-dependency",
            "constant",
            "action_id",
            "connector_mode",
            "Fail-closed",
        ]:
            self.assertIn(marker, text)

    def test_env_example_documents_the_receiver(self):
        env = read(ROOT / ".env.example")
        self.assertIn("HERMES_RECEIVER_SECRET", env)

    def test_phase9_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-9-hermes-receiver-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-019", read(plan))


if __name__ == "__main__":
    unittest.main()

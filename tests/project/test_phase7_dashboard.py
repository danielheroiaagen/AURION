import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
DASH = ROOT / "apps" / "dashboard"
SRC = DASH / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class WorkspaceTests(unittest.TestCase):
    def test_dashboard_workspace_exists_with_scripts(self):
        package = json.loads(read(DASH / "package.json"))
        self.assertEqual(package["name"], "@aurion/dashboard")
        for script in ["dev", "build", "test", "typecheck"]:
            self.assertIn(script, package["scripts"])

    def test_runtime_dependency_tree_is_minimal(self):
        package = json.loads(read(DASH / "package.json"))
        runtime = set(package["dependencies"])
        # ADR-017: react + router and NOTHING else at runtime.
        self.assertEqual(runtime, {"react", "react-dom", "react-router-dom"})

    def test_ci_runs_dashboard_typecheck_tests_and_build(self):
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        for marker in [
            "npm --workspace @aurion/dashboard run typecheck",
            "npm --workspace @aurion/dashboard run test",
            "npm --workspace @aurion/dashboard run build",
        ]:
            self.assertIn(marker, ci)


class SessionSecurityTests(unittest.TestCase):
    def test_token_lives_in_session_storage_never_local_storage(self):
        session = read(SRC / "auth" / "session.ts")
        self.assertIn("sessionStorage", session)
        # Usage (not prose): no code path may touch localStorage.
        for source_file in SRC.rglob("*.ts*"):
            text = read(source_file)
            self.assertNotIn("localStorage.", text, source_file)
            self.assertNotIn("window.localStorage", text, source_file)

    def test_claims_are_ux_hints_never_authority(self):
        session = read(SRC / "auth" / "session.ts")
        self.assertIn("NEVER authority", session)

    def test_401_kills_the_session(self):
        client = read(SRC / "api" / "client.ts")
        self.assertIn("onUnauthorized", client)
        context = read(SRC / "auth" / "auth-context.tsx")
        self.assertIn("onUnauthorized: signOut", context)


class ApiClientTests(unittest.TestCase):
    def test_pages_never_call_fetch_directly(self):
        for page in (SRC / "pages").glob("*.tsx"):
            self.assertNotIn("fetch(", read(page), page)

    def test_client_supports_the_idempotency_contract(self):
        client = read(SRC / "api" / "client.ts")
        self.assertIn("idempotency-key", client)
        self.assertIn("ProblemDetails", client)

    def test_types_mirror_the_six_contract_groups(self):
        types = read(SRC / "api" / "types.ts")
        for shape in [
            "TenantResponse",
            "TenantUserResponse",
            "KnowledgeDocumentResponse",
            "VoiceSessionResponse",
            "ControlledActionResponse",
            "AuditEventResponse",
        ]:
            self.assertIn(shape, types)


class ApprovalWorkflowTests(unittest.TestCase):
    def test_approval_rules_mirror_adr_013(self):
        rules = read(SRC / "domain" / "approval-rules.ts")
        self.assertIn("canDecide", rules)
        self.assertIn("canExecute", rules)
        # Requester ban and machine-actor ban, mirrored client-side.
        self.assertIn("actor_user_id !== claims.sub", rules)
        self.assertIn("claims.actorType === 'user'", rules)

    def test_actions_page_gates_buttons_through_the_rules(self):
        page = read(SRC / "pages" / "actions.tsx")
        for marker in ["canDecide", "canExecute", "isTerminal", "approveAction", "rejectAction", "executeAction"]:
            self.assertIn(marker, page)


class DocsTests(unittest.TestCase):
    def test_adr_017_records_the_stack_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-017-admin-dashboard-stack.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["Vite", "sessionStorage", "No SSR", "No API codegen", "PKCE"]:
            self.assertIn(marker, text)

    def test_phase7_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-7-dashboard-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-017", read(plan))


if __name__ == "__main__":
    unittest.main()

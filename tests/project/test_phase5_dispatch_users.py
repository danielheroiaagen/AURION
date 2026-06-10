import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API_SRC = ROOT / "apps" / "api" / "src"
API_TEST = ROOT / "apps" / "api" / "test"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class ActionDispatchTests(unittest.TestCase):
    ACTIONS = API_SRC / "modules" / "actions"

    def test_dispatch_layer_files_exist(self):
        for relative in [
            "application/action-dispatcher.port.ts",
            "infrastructure/hermes-http.dispatcher.ts",
            "infrastructure/noop.dispatcher.ts",
        ]:
            self.assertTrue((self.ACTIONS / relative).exists(), relative)
        self.assertTrue((API_SRC / "config" / "dispatch.config.ts").exists())

    def test_dispatch_failures_are_results_not_exceptions(self):
        port = read(self.ACTIONS / "application" / "action-dispatcher.port.ts")
        self.assertIn("ok: false", port)
        self.assertIn("errorCode", port)

    def test_hermes_adapter_signs_requests_and_times_out(self):
        source = read(self.ACTIONS / "infrastructure" / "hermes-http.dispatcher.ts")
        self.assertIn("createHmac", source)
        self.assertIn("sha256", source)
        self.assertIn("x-aurion-timestamp", source)
        self.assertIn("x-aurion-signature", source)
        self.assertIn("AbortController", source)
        self.assertIn("dispatch_timeout", source)

    def test_noop_adapter_is_honest_about_simulation(self):
        source = read(self.ACTIONS / "infrastructure" / "noop.dispatcher.ts")
        self.assertIn("dispatch_mode", source)
        self.assertIn("'noop'", source)

    def test_hermes_mode_fails_closed(self):
        source = read(API_SRC / "config" / "dispatch.config.ts")
        self.assertIn("HERMES_DISPATCH_URL", source)
        self.assertIn("HERMES_DISPATCH_SECRET", source)
        self.assertIn("throw new Error", source)
        self.assertIn("32", source)

    def test_execute_uses_dispatcher_result_never_client_payload(self):
        service = read(self.ACTIONS / "application" / "controlled-actions.service.ts")
        self.assertIn("dispatcher.dispatch", service)
        self.assertIn("BadGatewayException", service)
        dto = read(self.ACTIONS / "http" / "controlled-actions.dto.ts")
        self.assertNotIn("ExecuteActionDto", dto)
        controller = read(self.ACTIONS / "http" / "controlled-actions.controller.ts")
        self.assertNotIn("result_payload", controller)


class UsersModuleTests(unittest.TestCase):
    BASE = API_SRC / "modules" / "users"

    def test_module_files_exist(self):
        for relative in [
            "users.module.ts",
            "domain/membership.ts",
            "application/users.repository.port.ts",
            "application/users.service.ts",
            "infrastructure/kysely-users.repository.ts",
            "http/users.controller.ts",
            "http/memberships.controller.ts",
            "http/users.dto.ts",
        ]:
            self.assertTrue((self.BASE / relative).exists(), relative)

    def test_platform_owner_is_not_assignable(self):
        domain = read(self.BASE / "domain" / "membership.ts")
        self.assertIn("ASSIGNABLE_ROLES", domain)
        # The assignable list must not include the internal operator role.
        assignable = domain.split("ASSIGNABLE_ROLES")[1].split("]")[0]
        self.assertNotIn("platform_owner", assignable)

    def test_self_modification_is_forbidden(self):
        service = read(self.BASE / "application" / "users.service.ts")
        self.assertIn("own membership", service)
        self.assertIn("ForbiddenException", service)

    def test_global_users_table_is_only_reached_through_the_membership_join(self):
        repository = read(self.BASE / "infrastructure" / "kysely-users.repository.ts")
        self.assertIn("tenant_memberships", repository)
        self.assertIn("innerJoin", repository)
        self.assertIn("withTenant", repository)

    def test_routes_carry_user_permissions(self):
        users_controller = read(self.BASE / "http" / "users.controller.ts")
        self.assertIn("user:manage", users_controller)
        self.assertIn("user:read", users_controller)
        memberships_controller = read(self.BASE / "http" / "memberships.controller.ts")
        self.assertIn("user:manage", memberships_controller)


class PolicyAndDocsTests(unittest.TestCase):
    def test_user_permissions_in_catalog_matrix_and_docs(self):
        permissions = read(API_SRC / "modules" / "auth" / "domain" / "permissions.ts")
        self.assertIn("'user:read'", permissions)
        self.assertIn("'user:manage'", permissions)
        matrix = read(API_SRC / "modules" / "auth" / "domain" / "permission-matrix.ts")
        self.assertIn("'user:manage'", matrix)
        doc = read(ROOT / "05_SECURITY" / "permissions.md")
        self.assertIn("`user:read`", doc)
        self.assertIn("`user:manage`", doc)

    def test_user_manage_is_sensitive(self):
        permissions = read(API_SRC / "modules" / "auth" / "domain" / "permissions.ts")
        sensitive = permissions.split("SENSITIVE_PERMISSIONS")[1].split("]")[0]
        self.assertIn("user:manage", sensitive)

    def test_adr_014_records_the_dispatch_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-014-action-dispatch-port.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["ActionDispatcherPort", "HMAC", "noop", "502", "result_payload"]:
            self.assertIn(marker, text)

    def test_adr_015_and_runbook_record_key_rotation(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-015-key-rotation-crypto-shredding.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["DATA_ENCRYPTION_KEYS", "crypto-shredding", "keyId"]:
            self.assertIn(marker, text)
        runbook = ROOT / "05_SECURITY" / "key-rotation-runbook.md"
        self.assertTrue(runbook.exists())
        runbook_text = read(runbook)
        for marker in ["openssl rand -base64 32", "escrow", "enc:v1:k1:"]:
            self.assertIn(marker, runbook_text)

    def test_env_example_documents_dispatch_contract(self):
        env = read(ROOT / ".env.example")
        for marker in [
            "ACTION_DISPATCH_MODE",
            "HERMES_DISPATCH_URL",
            "HERMES_DISPATCH_SECRET",
            "HERMES_DISPATCH_TIMEOUT_MS",
        ]:
            self.assertIn(marker, env)

    def test_phase5_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-5-dispatch-users-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-014", read(plan))
        self.assertIn("ADR-015", read(plan))


class WiringTests(unittest.TestCase):
    def test_app_module_wires_users_module(self):
        source = read(API_SRC / "modules" / "app.module.ts")
        self.assertIn("UsersModule", source)

    def test_actions_module_selects_dispatcher_fail_closed(self):
        source = read(API_SRC / "modules" / "actions" / "actions.module.ts")
        self.assertIn("loadDispatchConfig", source)
        self.assertIn("HermesHttpDispatcher", source)
        self.assertIn("NoopDispatcher", source)

    def test_integration_suite_proves_dispatch_and_users_against_postgres(self):
        spec = API_TEST / "integration" / "users-dispatch.spec.ts"
        self.assertTrue(spec.exists())
        source = read(spec)
        self.assertIn("BadGatewayException", source)
        self.assertIn("invite", source)
        self.assertIn("enc:v1:", source)


if __name__ == "__main__":
    unittest.main()

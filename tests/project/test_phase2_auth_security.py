import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API_SRC = ROOT / "apps" / "api" / "src"
MIGRATIONS = ROOT / "database" / "migrations"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class DatabaseSecurityHardeningTests(unittest.TestCase):
    UP = MIGRATIONS / "2026-06-10-0002-security-rls-audit-hardening.up.sql"
    DOWN = MIGRATIONS / "2026-06-10-0002-security-rls-audit-hardening.down.sql"

    def test_security_migration_pair_exists(self):
        self.assertTrue(self.UP.exists())
        self.assertTrue(self.DOWN.exists())

    def test_up_enables_rls_on_all_tenant_owned_tables(self):
        sql = read(self.UP)
        for table in [
            "tenants",
            "tenant_memberships",
            "knowledge_documents",
            "voice_sessions",
            "controlled_actions",
            "audit_events",
        ]:
            self.assertRegex(sql, rf"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
            self.assertRegex(sql, rf"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        self.assertIn("CREATE POLICY", sql)
        self.assertIn("aurion_current_tenant_id", sql)
        self.assertIn("app.tenant_id", sql)

    def test_up_makes_audit_events_append_only(self):
        sql = read(self.UP)
        self.assertIn("BEFORE UPDATE OR DELETE ON audit_events", sql)
        self.assertIn("audit_events_append_only", sql)
        self.assertIn("RAISE EXCEPTION", sql)

    def test_down_reverses_rls_and_triggers(self):
        sql = read(self.DOWN)
        self.assertIn("DROP POLICY IF EXISTS", sql)
        self.assertIn("DISABLE ROW LEVEL SECURITY", sql)
        self.assertIn("DROP TRIGGER IF EXISTS audit_events_append_only", sql)

    def test_database_readme_documents_tenant_context(self):
        text = read(ROOT / "database" / "README.md")
        self.assertIn("Row-Level Security", text)
        self.assertIn("SET LOCAL app.tenant_id", text)
        self.assertIn("append-only", text)


class AuthImplementationTests(unittest.TestCase):
    def test_auth_module_files_exist(self):
        auth = API_SRC / "modules" / "auth"
        for relative in [
            "auth.module.ts",
            "domain/roles.ts",
            "domain/permissions.ts",
            "domain/permission-matrix.ts",
            "domain/actor.ts",
            "domain/authorization.ts",
            "application/policy.service.ts",
            "application/authorization-audit.port.ts",
            "infrastructure/jwt.verifier.ts",
            "infrastructure/jwt-auth.guard.ts",
            "infrastructure/policy.guard.ts",
            "infrastructure/logging-audit.sink.ts",
            "decorators/public.decorator.ts",
            "decorators/require-permission.decorator.ts",
            "decorators/current-actor.decorator.ts",
        ]:
            self.assertTrue((auth / relative).exists(), relative)

    def test_policy_service_is_deny_by_default_with_audit(self):
        text = read(API_SRC / "modules" / "auth" / "application" / "policy.service.ts")
        for marker in [
            "no_actor",
            "missing_tenant",
            "cross_tenant",
            "role_not_permitted",
            "human_approval_required",
            "requiresAudit",
        ]:
            self.assertIn(marker, text)

    def test_jwt_verifier_pins_hs256_and_compares_in_constant_time(self):
        text = read(API_SRC / "modules" / "auth" / "infrastructure" / "jwt.verifier.ts")
        self.assertIn("HS256", text)
        self.assertIn("timingSafeEqual", text)
        # Claim validation moved to the shared contract in phase 6 (ADR-016).
        claims = read(API_SRC / "modules" / "auth" / "infrastructure" / "jwt-claims.ts")
        self.assertIn("Missing expiration", claims)
        self.assertIn("validateTimeClaims", text)

    def test_permission_matrix_covers_all_roles(self):
        text = read(API_SRC / "modules" / "auth" / "domain" / "permission-matrix.ts")
        for subject in [
            "platform_owner",
            "tenant_admin",
            "supervisor",
            "human_agent",
            "developer_integrator",
            "auditor",
            "voice_agent",
            "system",
        ]:
            self.assertIn(subject, text)

    def test_health_endpoint_is_public(self):
        text = read(API_SRC / "modules" / "health" / "health.controller.ts")
        self.assertIn("@Public()", text)


class EdgeHardeningTests(unittest.TestCase):
    def test_main_applies_helmet_cors_and_shutdown_hooks(self):
        text = read(API_SRC / "main.ts")
        self.assertIn("helmet", text)
        self.assertIn("enableCors", text)
        self.assertIn("enableShutdownHooks", text)
        self.assertIn("loadSecurityConfig", text)

    def test_app_module_wires_throttler_filter_and_correlation(self):
        text = read(API_SRC / "modules" / "app.module.ts")
        self.assertIn("ThrottlerModule", text)
        self.assertIn("ThrottlerGuard", text)
        self.assertIn("ProblemDetailsFilter", text)
        self.assertIn("CorrelationIdMiddleware", text)
        self.assertIn("AuthModule", text)

    def test_problem_details_filter_follows_adr009_shape(self):
        text = read(API_SRC / "common" / "errors" / "problem-details.ts")
        for field in ["type", "title", "status", "detail", "code", "correlation_id"]:
            self.assertIn(field, text)

    def test_security_config_fails_closed_without_secret(self):
        text = read(API_SRC / "config" / "security.config.ts")
        self.assertIn("JWT_SECRET is required", text)
        self.assertIn("CORS_ORIGINS", text)


class CiSecurityTests(unittest.TestCase):
    WORKFLOWS = ROOT / ".github" / "workflows"

    def test_security_workflow_runs_audit_and_secret_scan(self):
        text = read(self.WORKFLOWS / "security.yml")
        self.assertIn("npm audit", text)
        self.assertIn("gitleaks", text)
        self.assertIn("secret-scan", text)

    def test_codeql_workflow_exists(self):
        text = read(self.WORKFLOWS / "codeql.yml")
        self.assertIn("CodeQL", text)
        self.assertIn("javascript-typescript", text)

    def test_ci_runs_api_unit_tests(self):
        text = read(self.WORKFLOWS / "ci.yml")
        self.assertIn("test:api", text)

    def test_all_actions_are_pinned_to_commit_sha(self):
        uses = re.compile(r"uses:\s*([^\s#]+)")
        sha_pin = re.compile(r"@[0-9a-f]{40}$")
        for workflow in self.WORKFLOWS.glob("*.yml"):
            for line in read(workflow).splitlines():
                match = uses.search(line)
                if not match:
                    continue
                reference = match.group(1)
                self.assertRegex(
                    reference,
                    sha_pin,
                    f"{workflow.name}: action '{reference}' must be pinned to a 40-char commit SHA",
                )

    def test_dependabot_tracks_npm_and_actions(self):
        text = read(ROOT / ".github" / "dependabot.yml")
        self.assertIn("package-ecosystem: npm", text)
        self.assertIn("package-ecosystem: github-actions", text)

    def test_security_policy_documents_automated_controls(self):
        text = read(ROOT / "SECURITY.md")
        self.assertIn("CodeQL", text)
        self.assertIn("gitleaks", text)
        self.assertIn("Row-Level Security", text)


class Phase2GovernanceTests(unittest.TestCase):
    def test_edge_security_adr_exists(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-010-api-edge-security-hardening.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        self.assertIn("Helmet", text)
        self.assertIn("rate limiting", text)
        self.assertIn("Problem Details", text)

    def test_pii_protection_adr_exists(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-011-pii-protection-at-rest.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        self.assertIn("encryption", text)
        self.assertIn("Row-Level Security", text)

    def test_phase2_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-2-auth-security-plan.md"
        self.assertTrue(plan.exists())
        text = read(plan)
        self.assertIn("Phase 2", text)
        self.assertIn("ADR-007", text)


if __name__ == "__main__":
    unittest.main()

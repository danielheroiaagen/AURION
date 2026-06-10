import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCKER = ROOT / "docker"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class ImageTests(unittest.TestCase):
    DOCKERFILES = [
        "api.Dockerfile",
        "voice-gateway.Dockerfile",
        "hermes-receiver.Dockerfile",
        "dashboard.Dockerfile",
    ]

    def test_every_service_has_a_multistage_image(self):
        for name in self.DOCKERFILES:
            path = DOCKER / name
            self.assertTrue(path.exists(), name)
            text = read(path)
            self.assertIn("AS build", text, name)
            self.assertGreaterEqual(text.count("FROM "), 2, name)

    def test_node_services_run_as_non_root(self):
        for name in ["api.Dockerfile", "voice-gateway.Dockerfile", "hermes-receiver.Dockerfile"]:
            self.assertIn("USER node", read(DOCKER / name), name)

    def test_api_image_carries_migration_tooling(self):
        text = read(DOCKER / "api.Dockerfile")
        self.assertIn("tools/db", text)
        self.assertIn("database/migrations", text)

    def test_dockerignore_excludes_secrets_and_node_modules(self):
        text = read(ROOT / ".dockerignore")
        self.assertIn("node_modules", text)
        self.assertIn(".env", text)


class ComposeTests(unittest.TestCase):
    def test_stack_has_all_services(self):
        compose = read(ROOT / "docker-compose.yml")
        for service in ["postgres:", "migrate:", "api:", "hermes-receiver:", "voice-gateway:", "dashboard:", "edge:"]:
            self.assertIn(service, compose)

    def test_migrations_are_a_one_shot_service_never_app_startup(self):
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("migrate.mjs", compose)
        self.assertIn("service_completed_successfully", compose)

    def test_secrets_come_only_from_the_environment(self):
        compose = read(ROOT / "docker-compose.yml")
        for required in [
            "${POSTGRES_PASSWORD:?",
            "${DATA_ENCRYPTION_KEYS:?",
            "${HERMES_DISPATCH_SECRET:?",
            "${VOICE_AGENT_TOKEN:?",
            "${VOICE_GATEWAY_CLIENT_KEYS:?",
        ]:
            self.assertIn(required, compose)

    def test_private_network_dispatch_uses_the_explicit_flag(self):
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("HERMES_DISPATCH_ALLOW_INSECURE_HTTP", compose)
        config = read(ROOT / "apps" / "api" / "src" / "config" / "dispatch.config.ts")
        self.assertIn("HERMES_DISPATCH_ALLOW_INSECURE_HTTP", config)

    def test_single_origin_edge_routes_all_three_surfaces(self):
        caddy = read(DOCKER / "Caddyfile")
        self.assertIn("/api/*", caddy)
        self.assertIn("/ws", caddy)
        self.assertIn("dashboard:80", caddy)


class E2eTests(unittest.TestCase):
    SCRIPT = ROOT / "tests" / "e2e" / "run-e2e.mjs"

    def test_e2e_driver_exists_and_is_wired(self):
        self.assertTrue(self.SCRIPT.exists())
        import json

        package = json.loads(read(ROOT / "package.json"))
        self.assertEqual(package["scripts"]["e2e"], "node tests/e2e/run-e2e.mjs")
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        self.assertIn("npm run e2e", ci)

    def test_e2e_covers_the_full_product_loop(self):
        text = read(self.SCRIPT)
        for marker in [
            "session.start",
            "turn.user",
            "approval_pending",
            "/approve",
            "/execute",
            "connector_mode",
            "'stub'",
            "session.ended",
            "summary",
        ]:
            self.assertIn(marker, text)

    def test_e2e_refuses_premature_execution(self):
        text = read(self.SCRIPT)
        self.assertIn("409", text)

    def test_e2e_mints_throwaway_secrets_at_runtime(self):
        text = read(self.SCRIPT)
        self.assertIn("randomBytes", text)
        # No committed JWTs: tokens are built, not pasted.
        self.assertIn("mintToken", text)


class DocsTests(unittest.TestCase):
    def test_adr_020_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-020-containerized-deployment.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["Compose", "one-shot", "Caddy", "E2E", "non-root"]:
            self.assertIn(marker, text)

    def test_vps_runbook_covers_operations(self):
        runbook = ROOT / "10_DEPLOYMENT" / "vps-deploy-runbook.md"
        self.assertTrue(runbook.exists())
        text = read(runbook)
        for marker in ["pg_dump", "Caddyfile", "--profile full", "AUTH_MODE=jwks", ".env"]:
            self.assertIn(marker, text)

    def test_phase10_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-10-infra-deploy-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-020", read(plan))


if __name__ == "__main__":
    unittest.main()

import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API_SRC = ROOT / "apps" / "api" / "src"
AUTH = API_SRC / "modules" / "auth"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class JwksVerifierTests(unittest.TestCase):
    def test_verifier_files_exist(self):
        for relative in [
            "application/token-verifier.port.ts",
            "infrastructure/jwt-claims.ts",
            "infrastructure/jwks.verifier.ts",
        ]:
            self.assertTrue((AUTH / relative).exists(), relative)

    def test_algorithm_is_pinned_to_rs256(self):
        source = read(AUTH / "infrastructure" / "jwks.verifier.ts")
        self.assertIn("'RS256'", source)
        self.assertIn("kid", source)

    def test_no_jwt_library_enters_the_supply_chain(self):
        package = json.loads(read(ROOT / "apps" / "api" / "package.json"))
        for dep in list(package.get("dependencies", {})) + list(package.get("devDependencies", {})):
            self.assertNotIn("jsonwebtoken", dep)
            self.assertNotIn("jose", dep)
        source = read(AUTH / "infrastructure" / "jwks.verifier.ts")
        self.assertIn("node:crypto", source)

    def test_unknown_kid_refetch_is_cooldown_limited(self):
        source = read(AUTH / "infrastructure" / "jwks.verifier.ts")
        self.assertIn("refreshCooldownSec", source)
        self.assertIn("AbortController", source)

    def test_both_verifiers_share_the_claim_contract(self):
        hs = read(AUTH / "infrastructure" / "jwt.verifier.ts")
        jwks = read(AUTH / "infrastructure" / "jwks.verifier.ts")
        for shared in ["toAuthenticatedActor", "validateTimeClaims", "validateIssuerAudience"]:
            self.assertIn(shared, hs)
            self.assertIn(shared, jwks)

    def test_guard_depends_on_the_port_not_a_concrete_verifier(self):
        guard = read(AUTH / "infrastructure" / "jwt-auth.guard.ts")
        self.assertIn("TOKEN_VERIFIER", guard)
        self.assertIn("await this.verifier.verify", guard)


class AuthConfigTests(unittest.TestCase):
    def test_jwks_mode_fails_closed_with_pinned_issuer_and_audience(self):
        source = read(API_SRC / "config" / "security.config.ts")
        self.assertIn("AUTH_MODE", source)
        self.assertIn("AUTH_JWKS_URL", source)
        self.assertIn("https://", source)
        self.assertIn("JWT_ISSUER and JWT_AUDIENCE are required in jwks mode", source)

    def test_auth_module_selects_the_verifier_by_mode(self):
        source = read(AUTH / "auth.module.ts")
        self.assertIn("JwksJwtVerifier", source)
        self.assertIn("JwtVerifier", source)
        self.assertIn("TOKEN_VERIFIER", source)

    def test_env_example_documents_the_auth_modes(self):
        env = read(ROOT / ".env.example")
        for marker in ["AUTH_MODE", "AUTH_JWKS_URL", "AUTH_JWKS_CACHE_SECONDS"]:
            self.assertIn(marker, env)


class OpenApiArtifactTests(unittest.TestCase):
    ARTIFACT = ROOT / "32_API_REFERENCE" / "openapi.json"

    def test_artifact_exists_and_is_valid_openapi(self):
        self.assertTrue(self.ARTIFACT.exists())
        document = json.loads(read(self.ARTIFACT))
        self.assertIn("openapi", document)
        self.assertEqual(document["info"]["title"], "AURION API")

    def test_artifact_covers_all_six_contract_groups(self):
        paths = json.loads(read(self.ARTIFACT))["paths"]
        for route in [
            "/api/v1/tenants/{tenantId}",
            "/api/v1/users",
            "/api/v1/memberships/{id}",
            "/api/v1/knowledge-documents",
            "/api/v1/voice-sessions",
            "/api/v1/actions",
            "/api/v1/audit-events",
        ]:
            self.assertIn(route, paths, route)

    def test_generator_and_drift_check_are_wired(self):
        generator = API_SRC / "openapi" / "generate-openapi.ts"
        self.assertTrue(generator.exists())
        package = json.loads(read(ROOT / "apps" / "api" / "package.json"))
        self.assertIn("openapi:generate", package["scripts"])
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        self.assertIn("openapi:generate", ci)
        self.assertIn("git diff --exit-code -- 32_API_REFERENCE/openapi.json", ci)


class DocsTests(unittest.TestCase):
    def test_adr_016_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-016-external-idp-jwks.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["AUTH_MODE", "JWKS", "RS256", "kid", "Fail closed", "account-takeover"]:
            self.assertIn(marker, text)

    def test_hermes_receiver_contract_exists(self):
        doc = ROOT / "29_HERMES_AGENT_WORKFORCE" / "dispatch-receiver-contract.md"
        self.assertTrue(doc.exists())
        text = read(doc)
        for marker in ["x-aurion-signature", "staleness", "action_id", "constant time"]:
            self.assertIn(marker, text)

    def test_phase6_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-6-idp-openapi-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-016", read(plan))


if __name__ == "__main__":
    unittest.main()

import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr033Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-033-self-hosted-idp.md"

    def test_adr_exists_and_decides_the_idp(self):
        text = read(self.ADR)
        for marker in ["Keycloak", "client_credentials", "PKCE", "voice_agent", "jwks"]:
            self.assertIn(marker, text)

    def test_phase24_plan_exists(self):
        self.assertTrue((ROOT / "26_PROJECT_MANAGEMENT" / "phase-24-real-idp-plan.md").exists())


class MachineIdentityTests(unittest.TestCase):
    def test_token_provider_is_fetch_only_and_cached(self):
        provider = read(GATEWAY / "src" / "infrastructure" / "oidc-token-provider.ts")
        for marker in ["client_credentials", "EARLY_REFRESH_SEC", "single-flight", "OidcTokenError"]:
            self.assertIn(marker, provider.replace("single‑flight", "single-flight"))
        pkg = json.loads(read(GATEWAY / "package.json"))
        self.assertEqual(set(pkg["dependencies"]), {"ws"}, "gateway runtime deps must stay ws-only")

    def test_config_demands_exactly_one_identity_mechanism(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("OIDC_TOKEN_URL", config)
        self.assertIn("VOICE_AGENT_TOKEN (a JWT) or OIDC_TOKEN_URL", config)


class IdpInfrastructureTests(unittest.TestCase):
    def test_compose_ships_keycloak_behind_a_profile(self):
        compose = read(ROOT / "docker-compose.yml")
        for marker in ["keycloak", "KC_DB", "KC_HOSTNAME", "OIDC_TOKEN_URL", "VITE_OIDC_CLIENT_ID"]:
            self.assertIn(marker, compose)

    def test_bootstrap_script_creates_the_claim_contract(self):
        script = read(ROOT / "10_DEPLOYMENT" / "keycloak-bootstrap.sh")
        for marker in [
            "aurion-dashboard",
            "aurion-voice-gateway",
            "pkce.code.challenge.method",
            "actor_type",
            "tenant_id",
            "aurion-api",
        ]:
            self.assertIn(marker, script)

    def test_env_example_documents_both_identity_paths(self):
        env = read(ROOT / ".env.example")
        for var in ["OIDC_TOKEN_URL", "OIDC_CLIENT_SECRET", "KEYCLOAK_HOSTNAME", "VITE_OIDC_TOKEN_URL"]:
            self.assertIn(var, env)


if __name__ == "__main__":
    unittest.main()

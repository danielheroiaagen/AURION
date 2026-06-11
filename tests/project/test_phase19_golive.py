import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr028Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-028-signed-twiml-endpoint.md"

    def test_adr_exists_and_decides_the_signed_door(self):
        text = read(self.ADR)
        for marker in ["X-Twilio-Signature", "/twiml", "TWILIO_AUTH_TOKEN", "TELEPHONY_PUBLIC_URL"]:
            self.assertIn(marker, text)

    def test_adr_pins_the_public_url(self):
        self.assertIn("never derived from request headers", read(self.ADR))

    def test_phase19_plan_exists(self):
        self.assertTrue((ROOT / "26_PROJECT_MANAGEMENT" / "phase-19-go-live-plan.md").exists())


class TwimlEndpointTests(unittest.TestCase):
    def test_signature_is_validated_in_constant_time(self):
        twiml = read(GATEWAY / "src" / "infrastructure" / "twiml.ts")
        self.assertIn("timingSafeEqual", twiml)
        self.assertIn("sha1", twiml)
        self.assertIn("escapeXml", twiml)

    def test_config_fails_closed_on_the_new_settings(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("TWILIO_AUTH_TOKEN is required", config)
        self.assertIn("TELEPHONY_PUBLIC_URL is required", config)

    def test_server_refuses_unsigned_twiml_requests(self):
        server = read(GATEWAY / "src" / "infrastructure" / "ws-server.ts")
        self.assertIn("validateTwilioSignature", server)
        self.assertIn("403", server)


class EdgeTests(unittest.TestCase):
    def test_caddyfile_is_domain_parametrized_and_routes_telephony(self):
        caddy = read(ROOT / "docker" / "Caddyfile")
        self.assertIn("{$CADDY_DOMAIN::80}", caddy)
        self.assertIn("/twilio", caddy)
        self.assertIn("/twiml", caddy)

    def test_compose_passes_golive_settings(self):
        compose = read(ROOT / "docker-compose.yml")
        for var in ["CADDY_DOMAIN", "TWILIO_AUTH_TOKEN", "TELEPHONY_PUBLIC_URL"]:
            self.assertIn(var, compose)

    def test_env_example_documents_golive_contract(self):
        env = read(ROOT / ".env.example")
        for var in ["TWILIO_AUTH_TOKEN", "TELEPHONY_PUBLIC_URL", "CADDY_DOMAIN"]:
            self.assertIn(var, env)


if __name__ == "__main__":
    unittest.main()

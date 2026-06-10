import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
DASH = ROOT / "apps" / "dashboard"
SRC = DASH / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class PkceTests(unittest.TestCase):
    def test_pkce_module_uses_webcrypto_s256(self):
        pkce = read(SRC / "auth" / "pkce.ts")
        self.assertIn("crypto.getRandomValues", pkce)
        self.assertIn("crypto.subtle.digest", pkce)
        self.assertIn("SHA-256", pkce)

    def test_oidc_module_validates_state_before_network(self):
        oidc = read(SRC / "auth" / "oidc.ts")
        self.assertIn("consumeAttempt", oidc)
        self.assertIn("state !== attempt.state", oidc)
        self.assertIn("code_challenge_method", oidc)
        self.assertIn("'S256'", oidc)

    def test_attempts_are_single_use(self):
        oidc = read(SRC / "auth" / "oidc.ts")
        # Read AND remove in the same operation.
        self.assertIn("storage.removeItem(ATTEMPT_KEY)", oidc)


class PublicClientTests(unittest.TestCase):
    def test_no_client_secret_anywhere_in_the_dashboard(self):
        for source_file in SRC.rglob("*.ts*"):
            self.assertNotIn("client_secret", read(source_file).replace("client_secret')).toBeNull", ""), source_file)
        env_example = read(DASH / ".env.example")
        self.assertNotIn("SECRET", env_example.upper().replace("DELIBERATELY NO CLIENT SECRET", ""))

    def test_oidc_endpoints_must_be_https(self):
        oidc = read(SRC / "auth" / "oidc.ts")
        self.assertEqual(oidc.count("startsWith('https://')"), 2)


class FlowTests(unittest.TestCase):
    def test_callback_route_is_wired(self):
        app = read(SRC / "app.tsx")
        self.assertIn('path="/callback"', app)
        self.assertIn("CallbackPage", app)

    def test_token_enters_through_the_existing_validated_door(self):
        callback = read(SRC / "pages" / "callback.tsx")
        self.assertIn("completeSignIn", callback)
        self.assertIn("await signIn(token)", callback)

    def test_login_keeps_the_dev_fallback(self):
        login = read(SRC / "pages" / "login.tsx")
        self.assertIn("beginSignIn", login)
        self.assertIn("fallback", login)

    def test_env_example_documents_the_oidc_contract(self):
        env = read(DASH / ".env.example")
        for marker in [
            "VITE_OIDC_AUTHORIZATION_URL",
            "VITE_OIDC_TOKEN_URL",
            "VITE_OIDC_CLIENT_ID",
        ]:
            self.assertIn(marker, env)


class DocsTests(unittest.TestCase):
    def test_adr_021_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-021-dashboard-oidc-pkce.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["PKCE", "S256", "public client", "state", "single-use"]:
            self.assertIn(marker, text)

    def test_phase11_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-11-oidc-pkce-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-021", read(plan))


if __name__ == "__main__":
    unittest.main()

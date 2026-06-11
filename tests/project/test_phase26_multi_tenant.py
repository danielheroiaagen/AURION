import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr035Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-035-multi-tenant-telephony.md"

    def test_adr_exists_and_keeps_the_isolation_model(self):
        text = read(self.ADR)
        for marker in ["TELEPHONY_TENANT_ROUTES", "client key identifies", "RLS", "backward compatible"]:
            self.assertIn(marker, text)
        # The whole point: no change to the API/security model.
        self.assertIn("no API change", text)


class RoutingTests(unittest.TestCase):
    def test_routes_parse_fail_closed_in_config(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("TELEPHONY_TENANT_ROUTES", config)
        self.assertIn("duplicate phone or clientKey", config)
        self.assertIn("TenantRoute", config)

    def test_dialed_number_selects_the_tenant_key(self):
        server = read(GATEWAY / "src" / "infrastructure" / "ws-server.ts")
        self.assertIn("phoneToKey", server)
        self.assertIn("phoneDigits", server)

    def test_bridge_resolves_identity_by_key(self):
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        self.assertIn("CallIdentity", bridge)
        self.assertIn("options.routes", bridge)

    def test_each_route_gets_its_own_machine_identity(self):
        main = read(GATEWAY / "src" / "main.ts")
        self.assertIn("OidcTokenProvider(route.oidc)", main)
        self.assertIn("phoneToKey", main)

    def test_backward_compatible_default(self):
        # No routes env → empty routes → single-tenant (asserted in detail
        # by the gateway unit suite); guard the contract intent here.
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("empty = single-tenant", config)
        env = read(ROOT / ".env.example")
        self.assertIn("TELEPHONY_TENANT_ROUTES", env)


if __name__ == "__main__":
    unittest.main()

import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class AuthPolicyModelDocumentationTests(unittest.TestCase):
    def test_auth_rbac_policy_decision_is_documented(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-007-auth-rbac-policy-model.md"

        self.assertTrue(adr.exists())
        text = adr.read_text(encoding="utf-8")
        self.assertIn("tenant-scoped RBAC", text)
        self.assertIn("policy guard", text)
        self.assertIn("Voice Agent", text)
        self.assertIn("human approval", text)

    def test_permissions_define_roles_and_sensitive_actions(self):
        permissions = ROOT / "05_SECURITY" / "permissions.md"

        text = permissions.read_text(encoding="utf-8")
        for role in [
            "Platform Owner",
            "Tenant Admin",
            "Supervisor",
            "Human Agent",
            "Developer/Integrator",
            "Auditor",
            "Voice Agent",
        ]:
            self.assertIn(role, text)

        self.assertIn("Matriz de permisos MVP", text)
        self.assertIn("Acciones sensibles", text)
        self.assertIn("tenant_id", text)

    def test_backend_auth_doc_references_policy_boundary(self):
        backend_doc = ROOT / "19_BACKEND" / "auth-authorization.md"

        text = backend_doc.read_text(encoding="utf-8")
        self.assertIn("ADR-007", text)
        self.assertIn("JWT", text)
        self.assertIn("Policy Guard", text)
        self.assertIn("audit", text)


if __name__ == "__main__":
    unittest.main()

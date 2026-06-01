import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class MvpApiContractDocumentationTests(unittest.TestCase):
    def test_mvp_api_contract_decision_is_documented(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-009-mvp-api-contracts.md"

        self.assertTrue(adr.exists())
        text = adr.read_text(encoding="utf-8")
        self.assertIn("OpenAPI-first", text)
        self.assertIn("REST", text)
        self.assertIn("tenant-scoped", text)
        self.assertIn("voice sessions", text)
        self.assertIn("controlled actions", text)

    def test_api_design_names_mvp_contracts_and_boundaries(self):
        api_design = ROOT / "19_BACKEND" / "api-design.md"

        text = api_design.read_text(encoding="utf-8")
        self.assertIn("ADR-009", text)
        self.assertIn("/v1/tenants", text)
        self.assertIn("/v1/knowledge-documents", text)
        self.assertIn("/v1/voice-sessions", text)
        self.assertIn("/v1/actions", text)
        self.assertIn("tenant_id", text)

    def test_rest_standards_define_errors_pagination_and_idempotency(self):
        standards = ROOT / "19_BACKEND" / "rest-api-standards.md"

        text = standards.read_text(encoding="utf-8")
        self.assertIn("ADR-009", text)
        self.assertIn("correlation_id", text)
        self.assertIn("Idempotency-Key", text)
        self.assertIn("Problem Details", text)
        self.assertIn("cursor pagination", text)
        self.assertIn("OpenAPI", text)


if __name__ == "__main__":
    unittest.main()

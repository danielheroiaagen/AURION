import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class Phase1FoundationTests(unittest.TestCase):
    def test_backend_framework_decision_is_documented(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-006-nestjs-typescript-backend.md"

        self.assertTrue(adr.exists())
        text = adr.read_text(encoding="utf-8")
        self.assertIn("NestJS + TypeScript", text)
        self.assertIn("FastAPI", text)

    def test_root_package_defines_npm_workspaces(self):
        package_json = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))

        self.assertEqual(package_json["name"], "aurion")
        self.assertTrue(package_json["private"])
        self.assertIn("apps/*", package_json["workspaces"])
        self.assertIn("packages/*", package_json["workspaces"])
        self.assertIn("test", package_json["scripts"])

    def test_api_workspace_declares_nestjs_dependencies(self):
        package_json = json.loads((ROOT / "apps" / "api" / "package.json").read_text(encoding="utf-8"))

        self.assertEqual(package_json["name"], "@aurion/api")
        self.assertIn("@nestjs/common", package_json["dependencies"])
        self.assertIn("@nestjs/core", package_json["dependencies"])
        self.assertIn("typescript", package_json["devDependencies"])

    def test_phase1_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-1-foundation-plan.md"

        self.assertTrue(plan.exists())
        text = plan.read_text(encoding="utf-8")
        self.assertIn("NestJS + TypeScript", text)
        self.assertIn("Review Workload Forecast", text)


if __name__ == "__main__":
    unittest.main()


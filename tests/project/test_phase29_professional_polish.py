import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "apps" / "dashboard"
LANDING = ROOT / "apps" / "landing"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr038Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-038-professional-product-polish.md"

    def test_adr_exists_and_defines_polish_gates(self):
        text = read(self.ADR)
        for marker in ["root quality gate", "responsive dashboard", "structured intake", "no measurement script"]:
            self.assertIn(marker, text)

    def test_phase29_plan_exists(self):
        self.assertTrue((ROOT / "26_PROJECT_MANAGEMENT" / "phase-29-professional-polish-plan.md").exists())


class RootQualityGateTests(unittest.TestCase):
    def test_root_scripts_are_real(self):
        package = json.loads(read(ROOT / "package.json"))
        self.assertEqual(package["scripts"]["lint"], "node tools/quality/lint.mjs")
        self.assertIn("--workspaces", package["scripts"]["typecheck"])
        self.assertNotIn("not configured yet", json.dumps(package["scripts"]))
        self.assertIn("discover -s tests/project", package["scripts"]["test:project"])

    def test_ci_runs_root_gates(self):
        ci = read(ROOT / ".github" / "workflows" / "ci.yml")
        self.assertIn("npm run lint", ci)
        self.assertIn("npm run typecheck", ci)

    def test_quality_lint_script_exists(self):
        lint = read(ROOT / "tools" / "quality" / "lint.mjs")
        for marker in ["repository hygiene lint", "README", "dashboard", "demo-form"]:
            self.assertIn(marker, lint)

    def test_docker_builds_use_supported_npm(self):
        for name in ["api", "dashboard", "voice-gateway", "hermes-receiver"]:
            dockerfile = read(ROOT / "docker" / f"{name}.Dockerfile")
            self.assertIn("npm install -g npm@11", dockerfile, name)
            self.assertLess(
                dockerfile.index("npm install -g npm@11"),
                dockerfile.index("npm ci"),
                name,
            )


class ProductEntryPointTests(unittest.TestCase):
    def test_readme_describes_the_current_product(self):
        readme = read(ROOT / "README.md")
        for marker in ["Production-aware Voice Agent SaaS Core", "Vite + React", "NestJS", "voice gateway", "Hermes receiver"]:
            self.assertIn(marker, readme)
        self.assertNotIn("Stack base asumido", readme)


class DashboardPolishTests(unittest.TestCase):
    def test_dashboard_has_mobile_and_table_guards(self):
        styles = read(DASHBOARD / "src" / "styles.css")
        for marker in ["@media (max-width: 860px)", "grid-template-columns: 1fr", "min-width: 720px", "overview-grid"]:
            self.assertIn(marker, styles)

    def test_tenant_page_surfaces_launch_readiness(self):
        tenant = read(DASHBOARD / "src" / "pages" / "tenant.tsx")
        for marker in ["Launch readiness", "Number routing", "Connector workflow", "business_hours"]:
            self.assertIn(marker, tenant)

    def test_overview_surfaces_operator_focus(self):
        overview = read(DASHBOARD / "src" / "pages" / "overview.tsx")
        for marker in ["Operator focus", "failed sessions", "pending approvals"]:
            self.assertIn(marker, overview)


class LandingPolishTests(unittest.TestCase):
    def test_landing_has_structured_demo_intake(self):
        landing = read(LANDING / "index.html")
        for marker in ["id=\"demo-form\"", "data-lead-form", "name=\"company\"", "Demo request ready", "wa.me"]:
            self.assertIn(marker, landing)

    def test_landing_form_is_styled_and_mobile_safe(self):
        styles = read(LANDING / "styles.css")
        for marker in [".demo-form", "grid-template-columns", "@media (max-width: 720px)"]:
            self.assertIn(marker, styles)


if __name__ == "__main__":
    unittest.main()

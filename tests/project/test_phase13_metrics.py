import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API_SRC = ROOT / "apps" / "api" / "src"
DASH_SRC = ROOT / "apps" / "dashboard" / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class MetricsApiTests(unittest.TestCase):
    BASE = API_SRC / "modules" / "metrics"

    def test_module_files_exist(self):
        for relative in [
            "metrics.module.ts",
            "application/metrics.repository.port.ts",
            "application/metrics.service.ts",
            "infrastructure/kysely-metrics.repository.ts",
            "http/metrics.controller.ts",
        ]:
            self.assertTrue((self.BASE / relative).exists(), relative)

    def test_endpoint_is_permission_guarded_and_window_bounded(self):
        controller = read(self.BASE / "http" / "metrics.controller.ts")
        self.assertIn("metrics:read", controller)
        self.assertIn("@Max(90)", controller)
        self.assertIn("requireActorTenant", controller)

    def test_aggregates_run_inside_the_tenant_scope(self):
        repository = read(self.BASE / "infrastructure" / "kysely-metrics.repository.ts")
        self.assertIn("withTenant", repository)

    def test_rates_are_null_on_zero_denominators(self):
        service = read(self.BASE / "application" / "metrics.service.ts")
        self.assertIn("number | null", service)
        self.assertIn("denominator > 0", service)

    def test_approval_rate_counts_decisions_not_current_status(self):
        port = read(self.BASE / "application" / "metrics.repository.port.ts")
        self.assertIn("actionsApprovedEver", port)
        repository = read(self.BASE / "infrastructure" / "kysely-metrics.repository.ts")
        self.assertIn("approved_by_user_id", repository)

    def test_permission_in_catalog_matrix_and_docs(self):
        permissions = read(API_SRC / "modules" / "auth" / "domain" / "permissions.ts")
        self.assertIn("'metrics:read'", permissions)
        matrix = read(API_SRC / "modules" / "auth" / "domain" / "permission-matrix.ts")
        self.assertEqual(matrix.count("'metrics:read'"), 3)  # admin, supervisor, auditor
        doc = read(ROOT / "05_SECURITY" / "permissions.md")
        self.assertIn("`metrics:read`", doc)

    def test_openapi_artifact_includes_the_metrics_route(self):
        document = json.loads(read(ROOT / "32_API_REFERENCE" / "openapi.json"))
        self.assertIn("/api/v1/metrics/overview", document["paths"])


class DashboardTests(unittest.TestCase):
    def test_overview_page_is_the_landing_view(self):
        app = read(DASH_SRC / "app.tsx")
        self.assertIn("OverviewPage", app)
        self.assertIn("<Route index element={<OverviewPage />} />", app)

    def test_overview_auto_refreshes_and_formats_null_rates_honestly(self):
        page = read(DASH_SRC / "pages" / "overview.tsx")
        self.assertIn("setInterval", page)
        formatting = read(DASH_SRC / "domain" / "metrics-format.ts")
        self.assertIn("'—'", formatting)

    def test_nav_shows_the_pending_approvals_badge_failing_silently(self):
        layout = read(DASH_SRC / "components" / "layout.tsx")
        self.assertIn("approvals_pending", layout)
        self.assertIn(".catch(", layout)

    def test_no_chart_library_entered_the_dependency_tree(self):
        package = json.loads(read(ROOT / "apps" / "dashboard" / "package.json"))
        # ADR-023: the CSS bars stay; no charting library ever (ADR-031
        # added the shadcn component runtime, which is not one).
        deps = set(package["dependencies"]) | set(package.get("devDependencies", {}))
        for chart in ["recharts", "chart.js", "d3", "echarts", "victory", "nivo"]:
            self.assertNotIn(chart, deps)


class DocsTests(unittest.TestCase):
    def test_adr_023_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-023-metrics-supervision.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["metrics:read", "RLS", "null", "auto-refresh", "deferred"]:
            self.assertIn(marker, text)

    def test_phase13_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-13-metrics-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-023", read(plan))


if __name__ == "__main__":
    unittest.main()

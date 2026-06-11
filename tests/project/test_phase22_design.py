import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
DASHBOARD = ROOT / "apps" / "dashboard"
WIDGET = ROOT / "apps" / "widget"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr031Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-031-dashboard-ui-stack.md"

    def test_adr_exists_and_decides_the_stack(self):
        text = read(self.ADR)
        for marker in ["Tailwind", "shadcn", "deep ocean futurist", "zero dependencies"]:
            self.assertIn(marker, text)

    def test_phase22_plan_exists(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-22-futurist-design-plan.md").exists()
        )


class DashboardStackTests(unittest.TestCase):
    def test_tailwind_and_shadcn_tooling_present(self):
        pkg = json.loads(read(DASHBOARD / "package.json"))
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        for dep in ["tailwindcss", "@tailwindcss/vite", "class-variance-authority", "tailwind-merge", "lucide-react"]:
            self.assertIn(dep, deps)

    def test_theme_tokens_v2_live_in_one_place(self):
        styles = read(DASHBOARD / "src" / "styles.css")
        self.assertIn("@theme", styles)
        for token in ["#070a12", "#22d3ee", "#8b5cf6", "deep ocean futurist"]:
            self.assertIn(token, styles)

    def test_shadcn_components_are_copied_in_and_themed(self):
        ui = DASHBOARD / "src" / "components" / "ui"
        for component in ["button.tsx", "card.tsx", "badge.tsx", "input.tsx"]:
            self.assertTrue((ui / component).exists(), component)
        self.assertIn("cva", read(ui / "button.tsx"))
        self.assertTrue((DASHBOARD / "src" / "lib" / "utils.ts").exists())


class WidgetBoundaryTests(unittest.TestCase):
    def test_widget_stays_zero_dependency_with_v2_tokens(self):
        pkg = json.loads(read(WIDGET / "package.json"))
        self.assertNotIn("dependencies", pkg, "the widget stays zero-dependency")
        styles = read(WIDGET / "src" / "styles.css")
        for token in ["#070a12", "#22d3ee", "deep ocean futurist"]:
            self.assertIn(token, styles)
        pkg_all = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        self.assertNotIn("tailwindcss", pkg_all, "tailwind never enters the widget")


if __name__ == "__main__":
    unittest.main()

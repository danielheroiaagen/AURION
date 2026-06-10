import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class DesignTokenTests(unittest.TestCase):
    DASH_CSS = ROOT / "apps" / "dashboard" / "src" / "styles.css"
    WIDGET_CSS = ROOT / "apps" / "widget" / "src" / "styles.css"

    def test_both_surfaces_implement_the_same_token_palette(self):
        for css in [self.DASH_CSS, self.WIDGET_CSS]:
            text = read(css)
            for token in ["--bg: #0b0e14", "--accent: #5b8cff", "--accent-2: #7c5bff", "--brand-gradient"]:
                self.assertIn(token, text, css)

    def test_keyboard_focus_is_first_class(self):
        for css in [self.DASH_CSS, self.WIDGET_CSS]:
            self.assertIn(":focus-visible", read(css), css)

    def test_design_doc_is_implemented_not_placeholder(self):
        doc = read(ROOT / "20_DESIGN_SYSTEM" / "design-tokens.md")
        self.assertIn("#5b8cff", doc)
        self.assertIn("deep ocean", doc)

    def test_no_new_dependencies_entered_either_app(self):
        dash = json.loads(read(ROOT / "apps" / "dashboard" / "package.json"))
        self.assertEqual(set(dash["dependencies"]), {"react", "react-dom", "react-router-dom"})
        widget = json.loads(read(ROOT / "apps" / "widget" / "package.json"))
        self.assertNotIn("dependencies", widget)


class MicDiagnosticsTests(unittest.TestCase):
    SPEECH = ROOT / "apps" / "widget" / "src" / "speech.ts"

    def test_capture_failures_are_discriminated_results(self):
        speech = read(self.SPEECH)
        self.assertIn("ListenResult", speech)
        for reason in ["'not-allowed'", "'no-speech'", "'network'", "'unavailable'"]:
            self.assertIn(reason, speech)

    def test_every_failure_has_a_user_facing_message(self):
        speech = read(self.SPEECH)
        self.assertIn("LISTEN_FAILURE_MESSAGES", speech)
        main = read(ROOT / "apps" / "widget" / "src" / "main.ts")
        self.assertIn("LISTEN_FAILURE_MESSAGES", main)


class DemoToolingTests(unittest.TestCase):
    def test_demo_and_mic_check_tools_exist(self):
        demo = ROOT / "tools" / "demo" / "run-demo.mjs"
        self.assertTrue(demo.exists())
        text = read(demo)
        for marker in ["--profile", "full", "awaiting approval", "mintToken"]:
            self.assertIn(marker, text)
        self.assertTrue((ROOT / "tools" / "demo" / "mic-check.mjs").exists())

    def test_phase15_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-15-design-polish-plan.md"
        self.assertTrue(plan.exists())


if __name__ == "__main__":
    unittest.main()

import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class CiWorkflowTests(unittest.TestCase):
    def test_ci_workflow_runs_required_quality_gates(self):
        workflow = ROOT / ".github" / "workflows" / "ci.yml"

        self.assertTrue(workflow.exists())
        text = workflow.read_text(encoding="utf-8")

        self.assertIn("npm ci", text)
        self.assertIn("npm test", text)
        self.assertIn("npm --workspace @aurion/api run typecheck", text)
        self.assertIn("npm --workspace @aurion/api run build", text)
        self.assertIn("node-version: 22", text)
        self.assertIn("npm install -g npm@11", text)
        self.assertIn("npm --version", text)


if __name__ == "__main__":
    unittest.main()

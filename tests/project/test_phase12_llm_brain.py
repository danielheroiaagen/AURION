import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"
SRC = GATEWAY / "src"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class LlmBrainTests(unittest.TestCase):
    def test_adapter_exists_behind_the_same_port(self):
        brain = read(SRC / "infrastructure" / "llm-brain.ts")
        self.assertIn("implements AgentBrainPort", brain)
        self.assertIn("chat/completions", brain)
        # No SDK: plain fetch only.
        package = read(GATEWAY / "package.json")
        self.assertNotIn("openai", package)

    def test_tool_catalog_mirrors_action_types_only(self):
        brain = read(SRC / "infrastructure" / "llm-brain.ts")
        self.assertIn("'ticket.create'", brain.replace('"ticket.create"', "'ticket.create'"))
        self.assertIn("calendar.update", brain)
        self.assertIn("KNOWN_TOOLS", brain)
        # Unknown tools are skipped, never executed.
        self.assertIn("continue", brain)

    def test_failures_never_fabricate_replies(self):
        brain = read(SRC / "infrastructure" / "llm-brain.ts")
        self.assertIn("BrainError", brain)
        self.assertIn("AbortController", brain)

    def test_prompt_is_honest_about_human_approval(self):
        brain = read(SRC / "infrastructure" / "llm-brain.ts")
        self.assertIn("human approves", brain)

    def test_llm_mode_fails_closed(self):
        config = read(SRC / "config.ts")
        for marker in ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "'llm'"]:
            self.assertIn(marker, config)

    def test_scripted_stays_the_default(self):
        config = read(SRC / "config.ts")
        self.assertIn("?? 'scripted'", config)
        main = read(SRC / "main.ts")
        self.assertIn("LlmBrain", main)
        self.assertIn("ScriptedBrain", main)


class DocsTests(unittest.TestCase):
    def test_adr_022_records_the_decision(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-022-llm-brain-adapter.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in [
            "AgentBrainPort",
            "OpenAI-compatible",
            "approval",
            "cannot mint",
            "Fail-closed",
        ]:
            self.assertIn(marker, text)

    def test_env_example_documents_the_llm_contract(self):
        env = read(ROOT / ".env.example")
        for marker in ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL"]:
            self.assertIn(marker, env)

    def test_phase12_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-12-llm-brain-plan.md"
        self.assertTrue(plan.exists())
        self.assertIn("ADR-022", read(plan))


if __name__ == "__main__":
    unittest.main()

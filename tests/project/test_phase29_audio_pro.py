import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr038Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-038-speech-to-speech-decision.md"

    def test_adr_exists_and_decides_the_speech_to_speech_boundary(self):
        text = read(self.ADR)
        for marker in [
            "source of truth",
            "approval-gated",
            "premium conversational tier",
            "Backchannel",
            "TELEPHONY_BACKCHANNEL_MS",
        ]:
            self.assertIn(marker, text)

    def test_phase29_and_phase30_plans_exist(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-29-audio-pro-plan.md").exists()
        )
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-30-call-qa-plan.md").exists()
        )


class BackchannelTests(unittest.TestCase):
    def test_backchannel_is_configurable_and_defaults_on(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("TELEPHONY_BACKCHANNEL_MS", config)
        self.assertIn("backchannelMs", config)
        # Admits 0 as an explicit "disabled" (parsePositiveInt would not).
        self.assertIn("parseNonNegativeInt", config)
        env = read(ROOT / ".env.example")
        self.assertIn("TELEPHONY_BACKCHANNEL_MS=1500", env)
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("TELEPHONY_BACKCHANNEL_MS", compose)

    def test_bridge_fills_slow_turns_then_speaks_the_reply(self):
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        for marker in [
            "BACKCHANNELS",
            "pickBackchannel",
            "backchannelMs",
            "backchannel=yes",
        ]:
            self.assertIn(marker, bridge)

    def test_backchannel_has_call_flow_coverage(self):
        spec = read(GATEWAY / "test" / "telephony.spec.ts")
        self.assertIn("language-matched filler", spec)
        self.assertIn("does not fill a fast turn", spec)


if __name__ == "__main__":
    unittest.main()

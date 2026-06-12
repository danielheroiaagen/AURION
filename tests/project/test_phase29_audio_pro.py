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


class BrandVoiceTests(unittest.TestCase):
    def test_synthesis_port_accepts_a_voice_override(self):
        ports = read(GATEWAY / "src" / "application" / "ports.ts")
        self.assertIn("synthesize(text: string, voice?: string)", ports)
        for adapter in ("openai-speech.ts", "heygen-speech.ts"):
            text = read(GATEWAY / "src" / "infrastructure" / adapter)
            self.assertIn("voice || this.config.voice", text)

    def test_routes_carry_a_per_tenant_voice(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("readonly voice: string", config)
        self.assertIn("route.voice", config)
        main = read(GATEWAY / "src" / "main.ts")
        self.assertIn("voice: route.voice", main)

    def test_greeting_cache_is_keyed_by_voice_not_just_synthesizer(self):
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        self.assertIn("greetingKey", bridge)
        # The cache value is now a per-(voice,text) map, not a single entry.
        self.assertIn("Map<string, Buffer>", bridge)

    def test_brand_voice_has_call_flow_coverage(self):
        spec = read(GATEWAY / "test" / "telephony.spec.ts")
        self.assertIn("its own brand voice", spec)


class SemanticEndpointingTests(unittest.TestCase):
    def test_two_tier_silence_with_a_completeness_heuristic(self):
        tr = read(GATEWAY / "src" / "infrastructure" / "realtime-transcriber.ts")
        for marker in [
            "looksLikeCompleteTurn",
            "HARD_SILENCE_MULTIPLIER",
            "CONTINUATION_CUES",
            "input_audio_transcription.delta",
            "partialText",
        ]:
            self.assertIn(marker, tr)

    def test_endpointing_has_call_flow_coverage(self):
        spec = read(GATEWAY / "test" / "telephony.spec.ts")
        self.assertIn("does not cut off a mid-sentence pause", spec)
        self.assertIn("commits a finished sentence promptly", spec)


if __name__ == "__main__":
    unittest.main()

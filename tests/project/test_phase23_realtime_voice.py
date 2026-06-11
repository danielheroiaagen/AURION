import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr032Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-032-realtime-voice-v2.md"

    def test_adr_exists_and_decides_the_latency_work(self):
        text = read(self.ADR)
        for marker in [
            "gpt-5.4-mini",
            "synthesizeStream",
            "gpt-realtime-whisper",
            "Echo guard",
            "reasoning_effort",
        ]:
            self.assertIn(marker, text)

    def test_phase23_plan_exists(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-23-realtime-voice-v2-plan.md").exists()
        )


class LatencyLeversTests(unittest.TestCase):
    def test_reasoning_effort_lever_is_gone(self):
        brain = read(GATEWAY / "src" / "infrastructure" / "llm-brain.ts")
        self.assertNotIn("reasoning_effort:", brain)
        config = read(GATEWAY / "src" / "config.ts")
        self.assertNotIn("LLM_REASONING_EFFORT", config)

    def test_streaming_tts_ships_frames_as_pcm_renders(self):
        speech = read(GATEWAY / "src" / "infrastructure" / "openai-speech.ts")
        self.assertIn("synthesizeStream", speech)
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        self.assertIn("sayStreaming", bridge)

    def test_call_stt_runs_adapter_vad_for_realtime_whisper(self):
        transcriber = read(GATEWAY / "src" / "infrastructure" / "realtime-transcriber.ts")
        for marker in ["realtime-whisper", "input_audio_buffer.commit", "SPEECH_THRESHOLD"]:
            self.assertIn(marker, transcriber)
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("TELEPHONY_STT_MODEL", config)

    def test_echo_guard_never_turns_the_agents_own_voice(self):
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        self.assertIn("normalizeForEcho", bridge)
        self.assertIn("echo", bridge)

    def test_plumbing_documents_the_new_contract(self):
        env = read(ROOT / ".env.example")
        self.assertIn("TELEPHONY_STT_MODEL", env)
        self.assertNotIn("LLM_REASONING_EFFORT", env)
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("TELEPHONY_STT_MODEL", compose)


if __name__ == "__main__":
    unittest.main()

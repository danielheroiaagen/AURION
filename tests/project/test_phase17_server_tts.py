import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"
WIDGET = ROOT / "apps" / "widget"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr026Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-026-server-side-tts.md"

    def test_adr_exists_and_decides_the_port(self):
        text = read(self.ADR)
        for marker in ["SpeechSynthesisPort", "TTS_MODE", "fail", "audio.agent", "tts_enabled"]:
            self.assertIn(marker, text)

    def test_adr_keeps_the_key_out_of_the_browser(self):
        self.assertIn("never reaches the browser", read(self.ADR))

    def test_adr_defers_the_avatar_with_a_reason(self):
        text = read(self.ADR)
        self.assertIn("HeyGen", text)
        self.assertIn("deferred", text)

    def test_phase17_plan_exists(self):
        self.assertTrue((ROOT / "26_PROJECT_MANAGEMENT" / "phase-17-server-tts-plan.md").exists())


class WsContractTests(unittest.TestCase):
    DOC = ROOT / "27_VOICE_IVR" / "websocket-event-contracts.md"

    def test_voice_events_are_documented(self):
        text = read(self.DOC)
        for marker in ["audio.agent", "tts_enabled", "tts_failed"]:
            self.assertIn(marker, text)


class GatewayTtsTests(unittest.TestCase):
    def test_config_fails_closed_on_openai_mode(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("TTS_API_KEY is required", config)
        self.assertIn("TtsMode = 'off' | 'openai'", config.replace('"', "'"))

    def test_synthesizer_is_fetch_only_no_sdk(self):
        adapter = read(GATEWAY / "src" / "infrastructure" / "openai-speech.ts")
        self.assertIn("audio/speech", adapter)
        pkg = json.loads(read(GATEWAY / "package.json"))
        self.assertEqual(set(pkg["dependencies"]), {"ws"}, "gateway runtime deps must stay ws-only")

    def test_text_is_sent_before_voice_and_failures_have_a_stable_code(self):
        server = read(GATEWAY / "src" / "infrastructure" / "ws-server.ts")
        self.assertIn("tts_failed", server)
        self.assertLess(
            server.index("type: 'turn.agent'"),
            server.index("type: 'audio.agent'"),
            "the reply text must be emitted before its voice (ADR-026)",
        )
        self.assertNotIn("execute", server.lower(), "the gateway must never gain an execute path")


class WidgetTtsTests(unittest.TestCase):
    def test_widget_plays_finished_audio_with_explained_failures(self):
        player = read(WIDGET / "src" / "player.ts")
        for marker in ["playAgentAudio", "PLAYBACK_FAILURE_MESSAGES", "TTS_ERROR_MESSAGES"]:
            self.assertIn(marker, player)
        protocol = read(WIDGET / "src" / "protocol.ts")
        self.assertIn("audio.agent", protocol)

    def test_no_provider_secret_or_endpoint_in_the_widget(self):
        for source in (WIDGET / "src").glob("*.ts"):
            text = read(source)
            self.assertNotIn("TTS_API_KEY", text, source)
            self.assertNotIn("api.openai.com", text, source)
        widget_pkg = json.loads(read(WIDGET / "package.json"))
        self.assertNotIn("dependencies", widget_pkg, "the widget stays zero-dependency")

    def test_browser_synthesis_is_demoted_to_fallback(self):
        main = read(WIDGET / "src" / "main.ts")
        self.assertIn("gatewayTts", main)
        self.assertIn("tts_enabled", main)


class PlumbingTests(unittest.TestCase):
    def test_compose_passes_tts_config_to_the_gateway_only(self):
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("TTS_MODE", compose)
        self.assertIn("TTS_API_KEY", compose)

    def test_env_example_documents_tts_contract(self):
        env = read(ROOT / ".env.example")
        for var in ["TTS_MODE", "TTS_API_KEY", "TTS_MODEL", "TTS_VOICE"]:
            self.assertIn(var, env)


if __name__ == "__main__":
    unittest.main()

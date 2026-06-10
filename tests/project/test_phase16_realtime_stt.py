import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"
WIDGET = ROOT / "apps" / "widget"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr025Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-025-server-side-stt.md"

    def test_adr_exists_and_decides_the_port(self):
        text = read(self.ADR)
        for marker in ["TranscriptionPort", "STT_MODE", "fail", "audio.utterance", "audio.transcript"]:
            self.assertIn(marker, text)

    def test_adr_keeps_the_key_out_of_the_browser(self):
        self.assertIn("never reaches the browser", read(self.ADR))

    def test_phase16_plan_exists(self):
        self.assertTrue((ROOT / "26_PROJECT_MANAGEMENT" / "phase-16-realtime-stt-plan.md").exists())


class WsContractTests(unittest.TestCase):
    DOC = ROOT / "27_VOICE_IVR" / "websocket-event-contracts.md"

    def test_audio_events_are_documented(self):
        text = read(self.DOC)
        for marker in ["audio.utterance", "audio.transcript", "stt_enabled", "audio_too_large"]:
            self.assertIn(marker, text)

    def test_stable_error_codes_include_stt(self):
        text = read(self.DOC)
        for code in ["stt_disabled", "stt_failed"]:
            self.assertIn(code, text)


class GatewaySttTests(unittest.TestCase):
    def test_config_fails_closed_on_openai_mode(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("STT_API_KEY is required", config)
        self.assertIn("'off' | 'openai'", config.replace('"', "'"))

    def test_transcriber_is_fetch_only_no_sdk(self):
        adapter = read(GATEWAY / "src" / "infrastructure" / "openai-transcriber.ts")
        self.assertIn("audio/transcriptions", adapter)
        self.assertIn("FormData", adapter)
        pkg = json.loads(read(GATEWAY / "package.json"))
        self.assertEqual(set(pkg["dependencies"]), {"ws"}, "gateway runtime deps must stay ws-only")

    def test_audio_runs_the_same_turn_path_with_no_execute_authority(self):
        server = read(GATEWAY / "src" / "infrastructure" / "ws-server.ts")
        self.assertIn("runTurn", server)
        self.assertIn("stt_disabled", server)
        self.assertIn("audio_too_large", server)
        self.assertNotIn("execute", server.lower(), "the gateway must never gain an execute path")


class WidgetSttTests(unittest.TestCase):
    def test_widget_records_locally_and_ships_utterances(self):
        recorder = read(WIDGET / "src" / "recorder.ts")
        for marker in ["MediaRecorder", "getUserMedia", "RECORD_FAILURE_MESSAGES", "STT_ERROR_MESSAGES"]:
            self.assertIn(marker, recorder)
        client = read(WIDGET / "src" / "conversation-client.ts")
        self.assertIn("audio.utterance", client)

    def test_no_provider_secret_or_endpoint_in_the_widget(self):
        for source in (WIDGET / "src").glob("*.ts"):
            text = read(source)
            self.assertNotIn("STT_API_KEY", text, source)
            self.assertNotIn("api.openai.com", text, source)
        widget_pkg = json.loads(read(WIDGET / "package.json"))
        self.assertNotIn("dependencies", widget_pkg, "the widget stays zero-dependency")

    def test_browser_recognizer_is_demoted_to_fallback(self):
        main = read(WIDGET / "src" / "main.ts")
        self.assertIn("gatewayStt", main)
        self.assertIn("stt_enabled", main)


class PlumbingTests(unittest.TestCase):
    def test_compose_passes_stt_config_to_the_gateway_only(self):
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("STT_MODE", compose)
        self.assertIn("STT_API_KEY", compose)

    def test_env_example_documents_stt_contract(self):
        env = read(ROOT / ".env.example")
        for var in ["STT_MODE", "STT_API_KEY", "STT_MODEL"]:
            self.assertIn(var, env)


if __name__ == "__main__":
    unittest.main()

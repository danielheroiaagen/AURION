import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr029Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-029-operator-cloned-voice.md"

    def test_adr_exists_and_decides_the_voice(self):
        text = read(self.ADR)
        for marker in ["heygen", "TTS_VOICE", "ffmpeg", "audio/mpeg", "Fail-closed"]:
            self.assertIn(marker, text)

    def test_phase20_plan_exists(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-20-operator-voice-plan.md").exists()
        )


class HeyGenAdapterTests(unittest.TestCase):
    def test_adapter_is_fetch_only_no_sdk(self):
        adapter = read(GATEWAY / "src" / "infrastructure" / "heygen-speech.ts")
        self.assertIn("/v3/voices/speech", adapter)
        self.assertIn("audio_url", adapter)
        pkg = json.loads(read(GATEWAY / "package.json"))
        self.assertEqual(set(pkg["dependencies"]), {"ws"}, "gateway npm deps must stay ws-only")

    def test_config_fails_closed_on_heygen_mode(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("'off' | 'openai' | 'heygen'", config.replace('"', "'"))
        self.assertIn("TTS_VOICE (the HeyGen voice id) is required", config)


class TelephonyDecodeTests(unittest.TestCase):
    def test_gateway_image_ships_ffmpeg(self):
        dockerfile = read(ROOT / "docker" / "voice-gateway.Dockerfile")
        self.assertIn("ffmpeg", dockerfile)

    def test_boot_fails_closed_without_the_transcoder(self):
        main = read(GATEWAY / "src" / "main.ts")
        self.assertIn("ffmpegAvailable", main)
        transcoder = read(GATEWAY / "src" / "infrastructure" / "mp3-ulaw.ts")
        for marker in ["mulaw", "8000", "SpeechSynthesisError"]:
            self.assertIn(marker, transcoder)

    def test_compose_passes_tts_api_url(self):
        self.assertIn("TTS_API_URL", read(ROOT / "docker-compose.yml"))


if __name__ == "__main__":
    unittest.main()

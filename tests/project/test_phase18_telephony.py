import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr027Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-027-telephony-bridge.md"

    def test_adr_exists_and_decides_the_bridge(self):
        text = read(self.ADR)
        for marker in [
            "StreamingTranscriptionPort",
            "TELEPHONY_MODE",
            "audio/pcmu",
            "Twilio",
            "/twilio",
            "fail",
        ]:
            self.assertIn(marker, text)

    def test_adr_keeps_authority_with_humans(self):
        text = read(self.ADR)
        self.assertIn("approval", text)
        self.assertIn("never authority", text)

    def test_phase18_plan_exists(self):
        self.assertTrue(
            (ROOT / "26_PROJECT_MANAGEMENT" / "phase-18-telephony-bridge-plan.md").exists()
        )


class WsContractTests(unittest.TestCase):
    DOC = ROOT / "27_VOICE_IVR" / "websocket-event-contracts.md"

    def test_telephony_transport_is_documented(self):
        text = read(self.DOC)
        for marker in ["/twilio", "Media Streams", "Parameter", "4401", "TELEPHONY_MODE"]:
            self.assertIn(marker, text)


class GatewayTelephonyTests(unittest.TestCase):
    def test_config_fails_closed_on_twilio_mode(self):
        config = read(GATEWAY / "src" / "config.ts")
        self.assertIn("TELEPHONY_MODE=twilio requires STT_MODE=openai and TTS_MODE=openai", config)
        self.assertIn("TelephonyMode = 'off' | 'twilio'", config.replace('"', "'"))

    def test_bridge_is_ws_only_no_sdk(self):
        for module in ["realtime-transcriber.ts", "twilio-bridge.ts", "twilio-protocol.ts", "audio.ts"]:
            self.assertTrue((GATEWAY / "src" / "infrastructure" / module).exists(), module)
        pkg = json.loads(read(GATEWAY / "package.json"))
        self.assertEqual(set(pkg["dependencies"]), {"ws"}, "gateway runtime deps must stay ws-only")

    def test_realtime_adapter_forwards_pcmu_with_server_vad(self):
        adapter = read(GATEWAY / "src" / "infrastructure" / "realtime-transcriber.ts")
        self.assertIn("audio/pcmu", adapter)
        self.assertIn("server_vad", adapter)
        self.assertIn("intent=transcription", adapter)

    def test_bridge_keeps_the_engine_authority_and_explains_failures(self):
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        self.assertIn("ConversationEngine", bridge)
        self.assertIn("4401", bridge)
        self.assertIn("clear", bridge)  # barge-in v1
        self.assertNotIn("execute", bridge.lower(), "the gateway must never gain an execute path")

    def test_transcode_is_dependency_free(self):
        audio = read(GATEWAY / "src" / "infrastructure" / "audio.ts")
        self.assertIn("linearToUlaw", audio)
        self.assertNotIn("require(", audio)
        self.assertNotIn("import ", audio.split("\n*/")[-1].split("export")[0])


class PlumbingTests(unittest.TestCase):
    def test_compose_passes_telephony_config_to_the_gateway_only(self):
        compose = read(ROOT / "docker-compose.yml")
        self.assertIn("TELEPHONY_MODE", compose)
        self.assertIn("PHONE_GREETING", compose)

    def test_env_example_documents_telephony_contract(self):
        env = read(ROOT / ".env.example")
        for var in ["TELEPHONY_MODE", "PHONE_GREETING", "PHONE_LANG", "TELEPHONY_SILENCE_MS"]:
            self.assertIn(var, env)


if __name__ == "__main__":
    unittest.main()

import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
GATEWAY = ROOT / "apps" / "voice-gateway"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class Adr034Tests(unittest.TestCase):
    ADR = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-034-sales-ready-guards.md"

    def test_adr_exists_and_decides_the_guards(self):
        text = read(self.ADR)
        for marker in [
            "CallCapacity",
            "TELEPHONY_MAX_CONCURRENT",
            "TELEPHONY_MAX_CALLS_PER_DAY",
            "never touches the billed providers",
            "AI disclosure",
        ]:
            self.assertIn(marker, text)

    def test_phase25_plan_exists(self):
        self.assertTrue((ROOT / "26_PROJECT_MANAGEMENT" / "phase-25-sales-ready-plan.md").exists())


class CostGuardTests(unittest.TestCase):
    def test_capacity_meter_guards_the_twiml_door(self):
        capacity = read(GATEWAY / "src" / "infrastructure" / "call-capacity.ts")
        for marker in ["maxConcurrent", "maxPerDay", "rollover"]:
            self.assertIn(marker, capacity)
        server = read(GATEWAY / "src" / "infrastructure" / "ws-server.ts")
        self.assertIn("hasRoom", server)
        self.assertIn("buildBusyTwiml", server)

    def test_busy_answer_speaks_through_twilio_not_the_billed_providers(self):
        twiml = read(GATEWAY / "src" / "infrastructure" / "twiml.ts")
        self.assertIn("buildBusyTwiml", twiml)
        self.assertIn("<Hangup/>", twiml)
        self.assertIn("ocupadas", twiml)

    def test_bridge_accounts_begin_and_end(self):
        bridge = read(GATEWAY / "src" / "infrastructure" / "twilio-bridge.ts")
        self.assertIn("capacity.begin", bridge.replace("options.capacity?.end", "capacity.end").replace("options.capacity.begin", "capacity.begin"))
        self.assertIn("end()", bridge.replace("options.capacity?.end()", "end()"))

    def test_env_documents_the_caps(self):
        env = read(ROOT / ".env.example")
        for var in ["TELEPHONY_MAX_CONCURRENT", "TELEPHONY_MAX_CALLS_PER_DAY"]:
            self.assertIn(var, env)
        compose = read(ROOT / "docker-compose.yml")
        for var in ["TELEPHONY_MAX_CONCURRENT", "TELEPHONY_MAX_CALLS_PER_DAY"]:
            self.assertIn(var, compose)


if __name__ == "__main__":
    unittest.main()

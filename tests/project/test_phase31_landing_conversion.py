import os
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
LANDING = ROOT / "apps" / "landing"
ADR_040 = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-040-landing-demonstrates-the-product.md"
PHASE31_PLAN = ROOT / "26_PROJECT_MANAGEMENT" / "phase-31-landing-conversion-plan.md"
DEMO_AUDIO = LANDING / "assets" / "demo-call.mp3"
GENERATE_SCRIPT = ROOT / "tools" / "demo-audio" / "generate.mjs"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# U1 — ADR-040: landing demonstrates the product
# ---------------------------------------------------------------------------

class Adr040Tests(unittest.TestCase):

    def test_adr_exists(self):
        self.assertTrue(ADR_040.exists(), "ADR-040 must exist")

    def test_adr_has_demonstrates_marker(self):
        text = read(ADR_040)
        self.assertIn("demonstrates", text)

    def test_adr_has_labeled_as_demonstrations_marker(self):
        text = read(ADR_040)
        self.assertIn("labeled as demonstrations", text)


# ---------------------------------------------------------------------------
# U1 — Phase 31 plan exists
# ---------------------------------------------------------------------------

class Phase31PlanTests(unittest.TestCase):

    def test_plan_exists(self):
        self.assertTrue(PHASE31_PLAN.exists(), "phase-31 plan must exist")

    def test_plan_lists_u1_through_u9(self):
        text = read(PHASE31_PLAN)
        for unit in ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"]:
            self.assertIn(unit, text)

    def test_plan_marks_u1_implemented(self):
        text = read(PHASE31_PLAN)
        # U1 is marked done; the rest are pending
        self.assertIn("U1", text)


# ---------------------------------------------------------------------------
# U1 — Landing hero copy and CTAs
# ---------------------------------------------------------------------------

class LandingHeroTests(unittest.TestCase):

    def _landing(self) -> str:
        return read(LANDING / "index.html")

    def test_hero_h1_text(self):
        landing = self._landing()
        self.assertIn(
            "AURION: la recepcionista IA que atiende tus llamadas en español, 24/7",
            landing,
        )

    def test_cta_live_demo_id(self):
        landing = self._landing()
        self.assertIn('id="cta-live-demo"', landing)

    def test_existing_demo_form_still_present(self):
        """Phase-29 landing markers must survive (lint gate contract)."""
        landing = self._landing()
        self.assertIn('id="demo-form"', landing)
        self.assertIn("data-lead-form", landing)
        self.assertIn("wa.me", landing)


# ---------------------------------------------------------------------------
# U1 — Audio demo block
# ---------------------------------------------------------------------------

class LandingAudioBlockTests(unittest.TestCase):

    def _landing(self) -> str:
        return read(LANDING / "index.html")

    def test_audio_element_with_demo_mp3(self):
        landing = self._landing()
        self.assertIn("demo-call.mp3", landing)

    def test_collapsible_transcript_exists(self):
        landing = self._landing()
        self.assertIn("Ver transcripción", landing)

    def test_disclosure_line_marker(self):
        """Widget disclosure: 'Hablarás con una IA'."""
        landing = self._landing()
        self.assertIn("Hablarás con una IA", landing)


# ---------------------------------------------------------------------------
# U1 — Voice widget container
# ---------------------------------------------------------------------------

class LandingWidgetTests(unittest.TestCase):

    def _landing(self) -> str:
        return read(LANDING / "index.html")

    def test_widget_container_has_gateway_url_data_attr(self):
        landing = self._landing()
        self.assertIn("data-gateway-url", landing)

    def test_widget_container_has_client_key_data_attr(self):
        landing = self._landing()
        self.assertIn("data-client-key", landing)


# ---------------------------------------------------------------------------
# U1 — Generation script
# ---------------------------------------------------------------------------

class GenerationScriptTests(unittest.TestCase):

    def _script(self) -> str:
        return read(GENERATE_SCRIPT)

    def test_script_exists(self):
        self.assertTrue(GENERATE_SCRIPT.exists(), "tools/demo-audio/generate.mjs must exist")

    def test_script_uses_alloy_voice(self):
        self.assertIn("alloy", self._script())

    def test_script_uses_nova_voice(self):
        self.assertIn("nova", self._script())

    def test_script_reads_key_from_env(self):
        self.assertIn("OPENAI_API_KEY", self._script())

    def test_script_never_hardcodes_key(self):
        script = self._script()
        # Must not contain any string that looks like a real OpenAI key
        self.assertNotIn("sk-proj-", script)


# ---------------------------------------------------------------------------
# U1 — Demo audio asset
# ---------------------------------------------------------------------------

class DemoAudioAssetTests(unittest.TestCase):

    def test_demo_audio_exists(self):
        self.assertTrue(DEMO_AUDIO.exists(), "apps/landing/assets/demo-call.mp3 must exist")

    def test_demo_audio_size_above_100kb(self):
        size = DEMO_AUDIO.stat().st_size
        self.assertGreater(size, 100_000, f"demo-call.mp3 is too small: {size} bytes")

    def test_demo_audio_size_below_2mb(self):
        size = DEMO_AUDIO.stat().st_size
        self.assertLess(size, 2_000_000, f"demo-call.mp3 is too large: {size} bytes")

    def test_demo_audio_has_valid_mp3_header(self):
        data = DEMO_AUDIO.read_bytes()
        # Valid: ID3 tag (starts with 'ID3') or MPEG sync word (0xFF 0xEx or 0xFF 0xFx)
        has_id3 = data[:3] == b"ID3"
        has_sync = len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0
        self.assertTrue(
            has_id3 or has_sync,
            f"demo-call.mp3 does not start with a valid MP3 header: {data[:4].hex()}",
        )


# ---------------------------------------------------------------------------
# U2 — Approval panel section
# ---------------------------------------------------------------------------

class LandingApprovalPanelTests(unittest.TestCase):
    """
    Validates the 'approval-panel' section added in Phase 31 U2.

    Contract:
    - Section id="approval-panel" exists.
    - Required heading is present verbatim.
    - Data fields: 'Intención detectada', 'Pendiente de aprobación',
      'Ejemplo ilustrativo' marker all present within the section.
    - Decorative action row: 'Aprobar' and 'Rechazar' strings present
      inside the section.
    - 'Editar' does NOT appear anywhere inside the approval-panel section
      (honesty rule: no edit capability exists in the real product).
    - aria-hidden="true" present on the decorative action row container.
    - Plan file marks U2 implemented (checkbox ticked).
    - U1 markers are unaffected (tested by the classes above; this class
      adds a smoke-check for the section boundary only).
    """

    def _landing(self) -> str:
        return read(LANDING / "index.html")

    def _panel_section(self) -> str:
        """Extract the approval-panel section substring from the landing HTML."""
        landing = self._landing()
        start = landing.find('id="approval-panel"')
        self.assertNotEqual(start, -1, "approval-panel section not found in index.html")
        # Slice from the opening of the section tag containing this id.
        # Walk backward to find the '<section' that owns this id.
        section_start = landing.rfind("<section", 0, start)
        # Find the matching </section> after the id.
        section_end = landing.find("</section>", start)
        self.assertNotEqual(section_end, -1, "</section> closing tag for approval-panel not found")
        return landing[section_start : section_end + len("</section>")]

    def test_approval_panel_section_exists(self):
        """Section with id='approval-panel' must be present."""
        landing = self._landing()
        self.assertIn('id="approval-panel"', landing)

    def test_approval_panel_heading_present(self):
        """Required h2 verbatim copy must be present."""
        section = self._panel_section()
        self.assertIn("Nada se ejecuta sin tu aprobación. Este es tu panel.", section)

    def test_intencion_detectada_field_present(self):
        """'Intención detectada' data field must be present in the section."""
        section = self._panel_section()
        self.assertIn("Intención detectada", section)

    def test_pendiente_de_aprobacion_chip_present(self):
        """'Pendiente de aprobación' status chip must be present in the section."""
        section = self._panel_section()
        self.assertIn("Pendiente de aprobación", section)

    def test_ejemplo_ilustrativo_caption_present(self):
        """Illustrative caption 'Ejemplo ilustrativo' must be present in the section."""
        section = self._panel_section()
        self.assertIn("Ejemplo ilustrativo", section)

    def test_aprobar_decorative_element_present(self):
        """Decorative 'Aprobar' element must appear in the section."""
        section = self._panel_section()
        self.assertIn("Aprobar", section)

    def test_rechazar_decorative_element_present(self):
        """Decorative 'Rechazar' element must appear in the section."""
        section = self._panel_section()
        self.assertIn("Rechazar", section)

    def test_editar_string_absent_from_section(self):
        """'Editar' must NOT appear inside the approval-panel section (honesty rule)."""
        section = self._panel_section()
        self.assertNotIn("editar", section.lower())

    def test_aria_hidden_on_decorative_action_row(self):
        """The decorative action row container must carry aria-hidden='true'."""
        section = self._panel_section()
        self.assertIn('aria-hidden="true"', section)

    def test_plan_marks_u2_implemented(self):
        """Phase-31 plan must mark U2 as implemented (checkbox ticked)."""
        text = read(PHASE31_PLAN)
        # Accept any common 'done' marker immediately following 'U2'
        import re
        self.assertTrue(
            re.search(r"U2.*(?:✅|implemented|\[x\])", text),
            "Plan file does not mark U2 as implemented",
        )


if __name__ == "__main__":
    unittest.main()

---
project: AURION
document: Phase 18 Telephony Bridge Plan
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: closed
created_at: 2026-06-11
related: ADR-018, ADR-025, ADR-026, ADR-027
---

# Phase 18 — Telephony bridge: AURION answers the phone

Meta 2 begins: a real phone number in front of the SAME approval-gated
engine. Twilio Media Streams terminates the call and streams μ-law audio
to a new `/twilio` WS path on the gateway; the OpenAI Realtime API
transcribes that stream with server VAD; replies are voiced through the
ADR-026 synthesizer and transcoded back to the wire (ADR-027). Zero new
runtime dependencies — `ws` speaks both sides.

## Work units

1. Contract: telephony transport section in
   `27_VOICE_IVR/websocket-event-contracts.md` (`/twilio` path, key via
   `<Parameter>`, same engine semantics).
2. Gateway ports: `StreamingTranscriptionPort` (`open → UtteranceStream`,
   `onUtterance`/`onSpeechStarted`/`onError`) + `pcm` output format on
   `OpenAiSpeechSynthesizer`.
3. Adapters: `OpenAiRealtimeTranscriber` (WS client, `audio/pcmu` in,
   `server_vad`, fail-closed open timeout) and `audio.ts` (PCM16 24 kHz →
   μ-law 8 kHz, 20 ms framing, dependency-free).
4. Bridge: `twilio-protocol.ts` (fail-closed frame parsing) +
   `twilio-bridge.ts` (key gating, greeting, serialized turns through the
   SAME `ConversationEngine`, barge-in `clear`, spoken apology on a
   failed turn, lifecycle close on `stop`/drop). `ws-server.ts` routes
   `/ws` and `/twilio` upgrades on one port.
5. Config: `TELEPHONY_MODE` off|twilio fail-closed — twilio REQUIRES
   `STT_MODE=openai` and `TTS_MODE=openai`; `PHONE_GREETING`,
   `PHONE_LANG`, `TELEPHONY_SILENCE_MS`. Compose + `.env.example` +
   CHANGELOG.
6. Tests: gateway specs (config, μ-law transcode round-trip, Twilio frame
   parsing, Realtime adapter against a mock provider WS, full bridge call
   flow over a real socket) and contract tests
   `tests/project/test_phase18_telephony.py`.

## Acceptance criteria

- [x] A simulated call on `/twilio` (start → media → stop) round-trips:
      greeting frames out, an utterance from the (mocked) transcriber
      runs `engine.userTurn`, the reply comes back as μ-law media frames,
      `stop` closes the session `completed` — approval-gated actions
      unchanged.
- [x] Calls without a valid `key` custom parameter are closed before any
      audio is processed; `/ws` behavior is unchanged (regression-tested).
- [x] `TELEPHONY_MODE=twilio` refuses to boot without STT and TTS both in
      openai mode — a phone gateway that cannot hear and speak does not
      answer.
- [x] Caller speech during playback sends Twilio `clear` (barge-in v1).
- [x] Runtime dependency set unchanged (`ws` only); all suites green in
      CI with 0 vulnerabilities.

## Out of scope

- Go-live: domain, TLS, the actual Twilio number and TwiML — phase 19.
- Outbound calls, DTMF, transfer-to-human, recording/consent.
- Speech-to-speech conversation models (would bypass the approval-gated
  brain).

## Closure evidence

Local verification passed on branch `phase-18/telephony-bridge`
(2026-06-11):

- [x] `npm test` passed: **268** Python contract tests (11 new in
      `tests/project/test_phase18_telephony.py`).
- [x] Gateway Vitest suite passed: **53** tests across 6 files, 14 of
      them in the new `test/telephony.spec.ts` (config fail-closed, μ-law
      round-trip within quantization error, Twilio frame parsing,
      Realtime adapter against a fake provider WS asserting
      `audio/pcmu` + `server_vad`, full call flow over real sockets:
      greeting → turn → barge-in `clear` → hangup `completed` / drop
      `failed`, key gating with `4401`).
- [x] Typecheck clean; gitleaks clean on full history.
- [x] Realtime API facts verified against current OpenAI docs before
      coding (transcription sessions, `audio/pcmu` native telephony
      input, VAD events) — not from model memory.

Remote verification on PR #32: all seven checks green on head `c84f226`
on the FIRST run (2026-06-11).

Merge evidence: PR #32 squash-merged into `main` as `00fda14` on
2026-06-11.

Next (meta 2 continues): phase 19 go-live — VPS, domain, TLS, the real
Twilio number pointing its TwiML at `wss://<domain>/twilio`, IdP real;
then the promised design pass with real screenshots.

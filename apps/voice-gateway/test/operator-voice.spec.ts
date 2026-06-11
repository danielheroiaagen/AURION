import { describe, expect, it, vi } from 'vitest';

import { loadGatewayConfig } from '../src/config.js';
import { HeyGenSpeechSynthesizer } from '../src/infrastructure/heygen-speech.js';
import { ffmpegAvailable, mp3ToUlaw8k } from '../src/infrastructure/mp3-ulaw.js';
import { SpeechSynthesisError } from '../src/infrastructure/openai-speech.js';

const VALID_ENV = {
  AURION_API_URL: 'http://localhost:3000',
  VOICE_AGENT_TOKEN: 'aaa.bbb.ccc',
  VOICE_GATEWAY_CLIENT_KEYS: 'k'.repeat(32),
};

// Deliberately low-entropy fixtures: must never trip the secret scanner.
const HEYGEN_CONFIG = {
  apiUrl: 'https://heygen.test',
  apiKey: 'hg-testtesttest',
  model: '',
  voice: 'voice-id-testtest',
  timeoutMs: 5_000,
  maxTextChars: 1_000,
  speed: 1,
  lang: '',
};

describe('heygen TTS configuration (fail closed, ADR-029)', () => {
  it('loads heygen mode with the cloned voice id', () => {
    const config = loadGatewayConfig({
      ...VALID_ENV,
      TTS_MODE: 'heygen',
      TTS_API_KEY: 'hg-testtesttest',
      TTS_VOICE: 'voice-id-testtest',
    });
    expect(config.ttsMode).toBe('heygen');
    expect(config.tts?.apiUrl).toBe('https://api.heygen.com');
    expect(config.tts?.voice).toBe('voice-id-testtest');
  });

  it('refuses heygen mode without a key or a voice id — no sensible default exists', () => {
    expect(() => loadGatewayConfig({ ...VALID_ENV, TTS_MODE: 'heygen' })).toThrow(/TTS_API_KEY/);
    expect(() =>
      loadGatewayConfig({ ...VALID_ENV, TTS_MODE: 'heygen', TTS_API_KEY: 'hg-testtesttest' }),
    ).toThrow(/TTS_VOICE/);
  });

  it('treats an empty TTS_API_URL as unset (compose passes empty strings)', () => {
    const config = loadGatewayConfig({
      ...VALID_ENV,
      TTS_MODE: 'openai',
      TTS_API_KEY: 'sk-testtesttest',
      TTS_API_URL: '',
    });
    expect(config.tts?.apiUrl).toBe('https://api.openai.com/v1');
  });
});

describe('HeyGenSpeechSynthesizer (two fetches, one timeout, ADR-029)', () => {
  function fetchMockReturning(audioBytes: Buffer) {
    return vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/v3/voices/speech')) {
        return new Response(JSON.stringify({ data: { audio_url: 'https://cdn.heygen.test/x.wav' } }), {
          status: 200,
        });
      }
      return new Response(audioBytes, { status: 200 });
    });
  }

  it('sends pace and language tuning to the provider (livelier clone, fixed prosody)', async () => {
    const fetchMock = fetchMockReturning(Buffer.from('mp3'));
    await new HeyGenSpeechSynthesizer(
      { ...HEYGEN_CONFIG, speed: 1.15, lang: 'es' },
      fetchMock as unknown as typeof fetch,
    ).synthesize('hola');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.speed).toBe(1.15);
    expect(body.language).toBe('es');

    // Defaults stay clean: no tuning params at speed 1 / empty lang.
    const plain = fetchMockReturning(Buffer.from('mp3'));
    await new HeyGenSpeechSynthesizer(HEYGEN_CONFIG, plain as unknown as typeof fetch).synthesize(
      'hola',
    );
    const plainBody = JSON.parse(plain.mock.calls[0][1].body);
    expect(plainBody.speed).toBeUndefined();
    expect(plainBody.language).toBeUndefined();
  });

  it('posts the text with the voice id and downloads the mp3', async () => {
    const fetchMock = fetchMockReturning(Buffer.from('mp3-bytes'));
    const synthesizer = new HeyGenSpeechSynthesizer(
      HEYGEN_CONFIG,
      fetchMock as unknown as typeof fetch,
    );
    const speech = await synthesizer.synthesize('hola, soy daniel');

    expect(speech.mimeType).toBe('audio/mpeg');
    expect(speech.audio.toString()).toBe('mp3-bytes');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://heygen.test/v3/voices/speech');
    expect(init.headers['x-api-key']).toBe(HEYGEN_CONFIG.apiKey);
    expect(JSON.parse(init.body)).toEqual({ text: 'hola, soy daniel', voice_id: 'voice-id-testtest' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://cdn.heygen.test/x.wav');
  });

  it('raises SpeechSynthesisError on every failure shape — never silent', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('no', { status: 500 }));
    await expect(
      new HeyGenSpeechSynthesizer(HEYGEN_CONFIG, upstream as unknown as typeof fetch).synthesize('x'),
    ).rejects.toThrow(SpeechSynthesisError);

    const noUrl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await expect(
      new HeyGenSpeechSynthesizer(HEYGEN_CONFIG, noUrl as unknown as typeof fetch).synthesize('x'),
    ).rejects.toThrow(/no audio url/);

    const emptyAudio = fetchMockReturning(Buffer.alloc(0));
    await expect(
      new HeyGenSpeechSynthesizer(HEYGEN_CONFIG, emptyAudio as unknown as typeof fetch).synthesize('x'),
    ).rejects.toThrow(/no audio/);

    const offline = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      new HeyGenSpeechSynthesizer(HEYGEN_CONFIG, offline as unknown as typeof fetch).synthesize('x'),
    ).rejects.toThrow(/could not be reached/);
  });

  it('caps the synthesized text at maxTextChars', async () => {
    const fetchMock = fetchMockReturning(Buffer.from('mp3'));
    const synthesizer = new HeyGenSpeechSynthesizer(
      { ...HEYGEN_CONFIG, maxTextChars: 10 },
      fetchMock as unknown as typeof fetch,
    );
    await synthesizer.synthesize('x'.repeat(50));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toHaveLength(10);
  });
});

describe('mp3 → μ-law transcoder process plumbing (ADR-029)', () => {
  it('detects a missing transcoder binary', () => {
    expect(ffmpegAvailable('definitely-not-a-real-binary-aurion')).toBe(false);
  });

  it('pipes stdin through the child and resolves stdout', async () => {
    // process.execPath echoing stdin stands in for ffmpeg: the plumbing
    // under test is spawn/pipe/collect, not the codec.
    const input = Buffer.from('fake-mp3-bytes');
    const output = await mp3ToUlaw8k(input, process.execPath, [
      '-e',
      'process.stdin.pipe(process.stdout)',
    ]);
    expect(output.equals(input)).toBe(true);
  });

  it('raises SpeechSynthesisError when the child fails or emits nothing', async () => {
    await expect(
      mp3ToUlaw8k(Buffer.from('x'), process.execPath, ['-e', 'process.exit(1)']),
    ).rejects.toThrow(SpeechSynthesisError);
    await expect(
      mp3ToUlaw8k(Buffer.from('x'), 'definitely-not-a-real-binary-aurion'),
    ).rejects.toThrow(/could not be started|failed/);
  });
});

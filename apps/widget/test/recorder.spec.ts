import { describe, expect, it } from 'vitest';

import {
  RECORD_FAILURE_MESSAGES,
  STT_ERROR_MESSAGES,
  recordingAvailable,
  startRecording,
} from '../src/recorder';

/**
 * Push-to-talk capture (ADR-025): recording is local MediaRecorder — no
 * online recognizer — and every failure is a discriminated, explained result.
 */

// jsdom's Blob lacks arrayBuffer(); every browser with MediaRecorder has it.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}

class FakeMediaRecorder {
  static fail = false;
  mimeType = 'audio/webm;codecs=opus';
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  static isTypeSupported(mime: string): boolean {
    return mime.startsWith('audio/webm');
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    if (!FakeMediaRecorder.fail) {
      this.ondataavailable?.({ data: new Blob(['fake-opus-bytes'], { type: 'audio/webm' }) });
    }
    this.onstop?.();
  }
}

function fakeScope({ denied = false } = {}) {
  const tracks = [{ stopped: false, stop(): void { this.stopped = true; } }];
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  return {
    scope: {
      MediaRecorder: FakeMediaRecorder as never,
      navigator: {
        mediaDevices: {
          getUserMedia: () =>
            denied ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(stream),
        },
      },
    },
    tracks,
  };
}

describe('recorder availability and failures', () => {
  it('reports unavailable on platforms without MediaRecorder/getUserMedia', async () => {
    expect(recordingAvailable({})).toBe(false);
    expect(await startRecording({})).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports not-allowed when the mic permission is denied', async () => {
    const { scope } = fakeScope({ denied: true });
    expect(await startRecording(scope)).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('every failure reason has a specific on-screen message (phase 15 rule)', () => {
    for (const reason of ['unavailable', 'not-allowed', 'no-audio']) {
      expect(RECORD_FAILURE_MESSAGES[reason]).toBeTruthy();
    }
    for (const code of ['stt_disabled', 'audio_too_large', 'stt_failed']) {
      expect(STT_ERROR_MESSAGES[code]).toBeTruthy();
    }
  });
});

describe('push-to-talk capture', () => {
  it('records, stops the tracks, and yields base64 audio with its mime type', async () => {
    FakeMediaRecorder.fail = false;
    const { scope, tracks } = fakeScope();
    const started = await startRecording(scope);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    started.stop();
    const result = await started.result;
    expect(result).toMatchObject({ ok: true, mimeType: 'audio/webm;codecs=opus' });
    if (result.ok) {
      expect(atob(result.audioBase64)).toBe('fake-opus-bytes');
    }
    expect(tracks[0].stopped).toBe(true);
  });

  it('yields no-audio when nothing was captured', async () => {
    FakeMediaRecorder.fail = true;
    const { scope } = fakeScope();
    const started = await startRecording(scope);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    started.stop();
    await expect(started.result).resolves.toEqual({ ok: false, reason: 'no-audio' });
  });
});

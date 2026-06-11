import { describe, expect, it, vi } from 'vitest';

import {
  PLAYBACK_FAILURE_MESSAGES,
  TTS_ERROR_MESSAGES,
  playAgentAudio,
  playbackAvailable,
  type PlayerScope,
} from '../src/player';

/** A scope whose Audio behaves as scripted — playback is fully observable. */
function scopeWith(behavior: 'ends' | 'errors' | 'blocked') {
  const created: Array<{ src: string }> = [];
  const revoked: string[] = [];
  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly src: string) {
      created.push(this);
    }
    play(): Promise<void> {
      if (behavior === 'blocked') {
        return Promise.reject(new Error('NotAllowedError'));
      }
      queueMicrotask(() => (behavior === 'ends' ? this.onended?.() : this.onerror?.()));
      return Promise.resolve();
    }
  }
  const scope: PlayerScope = {
    Audio: FakeAudio as unknown as PlayerScope['Audio'],
    URL: {
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn((url: string) => void revoked.push(url)),
    },
    atob: (data: string) => globalThis.atob(data),
  };
  return { scope, created, revoked };
}

describe('agent audio playback (ADR-026: a lost voice is never silent)', () => {
  it('detects platforms that cannot play — the text fallback is the experience', async () => {
    expect(playbackAvailable({} as PlayerScope)).toBe(false);
    expect(await playAgentAudio('QQ==', 'audio/mpeg', {} as PlayerScope)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('plays decoded bytes as a blob and revokes the URL afterwards', async () => {
    const { scope, created, revoked } = scopeWith('ends');
    const result = await playAgentAudio(btoa('mp3-bytes'), 'audio/mpeg', scope);
    expect(result).toEqual({ ok: true });
    expect(created[0].src).toBe('blob:fake-url');
    const blob = (scope.URL!.createObjectURL as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Blob;
    expect(blob.type).toBe('audio/mpeg');
    expect(revoked).toEqual(['blob:fake-url']);
  });

  it('explains undecodable audio instead of throwing', async () => {
    const { scope } = scopeWith('ends');
    expect(await playAgentAudio('not-base64!!!', 'audio/mpeg', scope)).toEqual({
      ok: false,
      reason: 'decode',
    });
  });

  it('explains element errors and autoplay blocking — and still cleans up', async () => {
    const errored = scopeWith('errors');
    expect(await playAgentAudio('QQ==', 'audio/mpeg', errored.scope)).toEqual({
      ok: false,
      reason: 'decode',
    });
    expect(errored.revoked).toEqual(['blob:fake-url']);

    const blocked = scopeWith('blocked');
    expect(await playAgentAudio('QQ==', 'audio/mpeg', blocked.scope)).toEqual({
      ok: false,
      reason: 'blocked',
    });
    expect(blocked.revoked).toEqual(['blob:fake-url']);
  });

  it('has a specific message for every failure reason and TTS error code', () => {
    for (const reason of ['unavailable', 'decode', 'blocked']) {
      expect(PLAYBACK_FAILURE_MESSAGES[reason]).toBeTruthy();
    }
    expect(TTS_ERROR_MESSAGES.tts_failed).toBeTruthy();
  });
});

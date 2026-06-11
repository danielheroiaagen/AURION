import { spawn, spawnSync } from 'node:child_process';

import { SpeechSynthesisError } from './openai-speech.js';

/**
 * MP3 → μ-law 8 kHz for the telephony wire (ADR-029), via the ffmpeg
 * SYSTEM binary shipped in the gateway image. A pure-JS MP3 decoder is
 * not a serious option; npm dependencies stay `ws` only.
 */
export function ffmpegAvailable(command = 'ffmpeg'): boolean {
  try {
    return spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

const FFMPEG_ARGS = [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  'pipe:0',
  '-f',
  'mulaw',
  '-ar',
  '8000',
  '-ac',
  '1',
  'pipe:1',
] as const;

export function mp3ToUlaw8k(
  mp3: Buffer,
  command = 'ffmpeg',
  args: readonly string[] = FFMPEG_ARGS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', () =>
      reject(new SpeechSynthesisError('Audio transcoder could not be started.')),
    );
    child.on('close', (code) => {
      if (code === 0 && out.length > 0) {
        resolve(Buffer.concat(out));
        return;
      }
      const detail = Buffer.concat(err).toString('utf8').slice(0, 200);
      reject(new SpeechSynthesisError(`Audio transcoder failed (${code ?? 'killed'}): ${detail}`));
    });
    // A dying child closes stdin first; without this the EPIPE throws.
    child.stdin.on('error', () => undefined);
    child.stdin.end(mp3);
  });
}

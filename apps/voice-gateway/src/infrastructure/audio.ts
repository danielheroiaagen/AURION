/**
 * Dependency-free audio transcode for the telephony bridge (ADR-027).
 * The synthesizer speaks PCM16 24 kHz; the phone wire is G.711 μ-law
 * 8 kHz. Voice-grade decimation (mean of 3) plus the standard μ-law
 * encoder — no native modules, no new dependencies.
 */
const BIAS = 0x84;
const CLIP = 32_635;

export function linearToUlaw(sample: number): number {
  let value = sample;
  const sign = value < 0 ? 0x80 : 0;
  if (sign) {
    value = -value;
  }
  if (value > CLIP) {
    value = CLIP;
  }
  value += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (value & mask) === 0 && exponent > 0; exponent -= 1, mask >>= 1) {
    // walk down to the highest set bit
  }
  const mantissa = (value >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

export function ulawToLinear(byte: number): number {
  const value = ~byte & 0xff;
  const sign = value & 0x80;
  const exponent = (value >> 4) & 0x07;
  const mantissa = value & 0x0f;
  const magnitude = ((mantissa << 3) + BIAS) << exponent;
  return sign ? BIAS - magnitude : magnitude - BIAS;
}

/** PCM16 little-endian at `inputRate` (multiple of 8000) → μ-law 8 kHz. */
export function pcm16ToUlaw8k(pcm: Buffer, inputRate = 24_000): Buffer {
  const factor = Math.max(1, Math.round(inputRate / 8_000));
  const sampleCount = Math.floor(pcm.length / 2);
  const out = Buffer.alloc(Math.floor(sampleCount / factor));
  for (let i = 0; i < out.length; i += 1) {
    // Mean of the decimation window: cheap anti-aliasing, fine for voice.
    let sum = 0;
    for (let j = 0; j < factor; j += 1) {
      sum += pcm.readInt16LE((i * factor + j) * 2);
    }
    out[i] = linearToUlaw(Math.round(sum / factor));
  }
  return out;
}

/** Split μ-law audio into wire frames (default 160 bytes = 20 ms at 8 kHz). */
export function ulawFrames(ulaw: Buffer, frameBytes = 160): Buffer[] {
  const frames: Buffer[] = [];
  for (let offset = 0; offset < ulaw.length; offset += frameBytes) {
    frames.push(ulaw.subarray(offset, Math.min(offset + frameBytes, ulaw.length)));
  }
  return frames;
}

#!/usr/bin/env node
/**
 * Demo call audio generator for apps/landing/assets/demo-call.mp3.
 *
 * Generates the demo call segment-by-segment using the OpenAI TTS HTTP API,
 * then concatenates the MP3 buffers into a single file. Zero npm dependencies
 * — uses only Node built-ins (https, fs, path, url).
 *
 * TTS model: gpt-4o-mini-tts  (same default as the production voice gateway,
 *            see apps/voice-gateway/src/config.ts line ~320)
 * Voices:    alloy → AURION segments
 *            nova  → caller (Marta) segments
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node tools/demo-audio/generate.mjs
 *
 * To regenerate after dialogue changes, run the same command from the repo root.
 * The output is committed at apps/landing/assets/demo-call.mp3.
 *
 * The API key is read ONLY from the OPENAI_API_KEY environment variable.
 * It is NEVER logged, NEVER written to disk.
 */

import { createWriteStream, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const OUTPUT_DIR = join(REPO_ROOT, 'apps', 'landing', 'assets');
const OUTPUT_PATH = join(OUTPUT_DIR, 'demo-call.mp3');

// TTS model — mirrors the production gateway default (config.ts ~line 320).
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_API_URL = 'https://api.openai.com/v1/audio/speech';

// Dialogue: [voice, text]
// alloy = AURION, nova = Marta (caller)
const SEGMENTS = [
  ['alloy', 'Clínica Dental Sonrisa, le atiende AURION, su asistente virtual. ¿En qué puedo ayudarle?'],
  ['nova',  'Hola, buenas tardes. Quería pedir cita para una limpieza, si puede ser el jueves por la tarde.'],
  ['alloy', 'Por supuesto. El jueves por la tarde tenemos hueco a las cuatro y media o a las seis. ¿Cuál le viene mejor?'],
  ['nova',  'A las cuatro y media, perfecto.'],
  ['alloy', 'Anotado. ¿Me confirma su nombre y un teléfono de contacto, por favor?'],
  ['nova',  'Sí, Marta López, seis uno dos, tres cuatro cinco, seis siete ocho.'],
  ['alloy', 'Gracias, Marta. Dejo preparada la cita del jueves a las cuatro y media pendiente de confirmación por el equipo. Recibirá la confirmación por WhatsApp. ¿Puedo ayudarle en algo más?'],
  ['nova',  'No, eso es todo. ¡Muchas gracias!'],
  ['alloy', 'Gracias a usted por llamar. ¡Hasta pronto!'],
];

function getApiKey() {
  const key = process.env['OPENAI_API_KEY'];
  if (!key || !key.trim()) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }
  return key.trim();
}

/**
 * Call the OpenAI TTS API for a single segment.
 * Returns the raw MP3 buffer.
 */
function synthesize(apiKey, voice, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text,
      response_format: 'mp3',
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = request(TTS_API_URL, options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (chunk) => { errBody += chunk; });
        res.on('end', () => {
          reject(new Error(`TTS API returned ${res.statusCode}: ${errBody}`));
        });
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const apiKey = getApiKey();

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Generating ${SEGMENTS.length} segments with model "${TTS_MODEL}"…`);

  const buffers = [];
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [voice, text] = SEGMENTS[i];
    process.stdout.write(`  [${i + 1}/${SEGMENTS.length}] voice=${voice} "${text.slice(0, 48)}…" `);
    const buf = await synthesize(apiKey, voice, text);
    buffers.push(buf);
    console.log(`${buf.length} bytes`);
  }

  const combined = Buffer.concat(buffers);

  if (existsSync(OUTPUT_PATH)) {
    unlinkSync(OUTPUT_PATH);
  }

  const ws = createWriteStream(OUTPUT_PATH);
  ws.write(combined);
  ws.end();

  await new Promise((resolve, reject) => {
    ws.on('finish', resolve);
    ws.on('error', reject);
  });

  const stat = statSync(OUTPUT_PATH);
  console.log(`\nOutput: ${OUTPUT_PATH}`);
  console.log(`Size:   ${stat.size} bytes (${(stat.size / 1024).toFixed(1)} KB)`);

  if (stat.size < 100_000) {
    throw new Error(`Output file is suspiciously small: ${stat.size} bytes`);
  }
  if (stat.size > 2_000_000) {
    throw new Error(`Output file exceeds 2 MB budget: ${stat.size} bytes`);
  }

  const header = combined.slice(0, 4);
  const hasId3 = header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33; // 'ID3'
  const hasSync = header[0] === 0xFF && (header[1] & 0xE0) === 0xE0;
  if (!hasId3 && !hasSync) {
    throw new Error(`Output does not start with a valid MP3 header: ${header.toString('hex')}`);
  }

  console.log('MP3 header valid. Done.');
}

main().catch((err) => {
  console.error('generate.mjs failed:', err.message);
  process.exit(1);
});

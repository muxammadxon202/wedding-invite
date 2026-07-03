#!/usr/bin/env node
/**
 * generate-guests.mjs — builds the encrypted data/guests.json and prints
 * one personal invitation link per guest.
 *
 * Usage:
 *   node tools/generate-guests.mjs [inputFile] [--base https://you.github.io/repo/]
 *
 * Input (default tools/guests.input.json) — an array of guests:
 *   [{
 *     "token": "optional-fixed-token, otherwise generated",
 *     "nameRu": "Ксения",       "nameUz": "Kseniya",
 *     "lang": "ru",             "type": "family",
 *     "greetingRu": "Дорогая тётя Ксения",
 *     "greetingUz": "Hurmatli Kseniya xola",
 *     "weddingDate": "2026-09-26",   // optional per-guest override
 *     "weddingTime": "17:00"         // optional per-guest override
 *   }]
 *
 * Security model (mirrored by js/guest.js):
 *   token     — 128-bit CSPRNG value, base64url, lives only in the link
 *   lookupId  — SHA-256("wedding-lookup-v1|" + token) → first 32 hex chars
 *   key       — SHA-256("wedding-key-v1|" + token) → AES-256-GCM
 *   payload   — AES-GCM(guest record), fresh random 96-bit IV
 *
 * KEEP THE INPUT FILE PRIVATE — it contains plaintext names. It is
 * covered by .gitignore; only the encrypted guests.json is deployed.
 */

import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LOOKUP_PREFIX = 'wedding-lookup-v1|';
const KEY_PREFIX = 'wedding-key-v1|';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const base = baseIdx !== -1 ? args[baseIdx + 1] : './index.html';
const inputFile =
  args.find((a, i) => !a.startsWith('--') && i !== baseIdx + 1) ??
  path.join(here, 'guests.input.json');

const enc = new TextEncoder();

const toBase64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const sha256 = (text) => crypto.subtle.digest('SHA-256', enc.encode(text));

async function encryptGuest(token, record) {
  const keyBytes = await sha256(KEY_PREFIX + token);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(record)),
  );
  return { iv: toBase64url(iv), data: toBase64url(new Uint8Array(data)) };
}

const guestsIn = JSON.parse(await readFile(inputFile, 'utf8'));
if (!Array.isArray(guestsIn) || guestsIn.length === 0) {
  console.error('Input must be a non-empty JSON array of guests.');
  process.exit(1);
}

const out = { version: 1, guests: {} };
const links = [];

for (const g of guestsIn) {
  const token = g.token ?? toBase64url(crypto.getRandomValues(new Uint8Array(16)));
  const lookupId = toHex(await sha256(LOOKUP_PREFIX + token)).slice(0, 32);

  const record = {
    nameRu: g.nameRu ?? '',
    nameUz: g.nameUz ?? '',
    lang: g.lang === 'uz' ? 'uz' : 'ru',
    type: g.type ?? 'guest',
    greetingRu: g.greetingRu ?? '',
    greetingUz: g.greetingUz ?? '',
    ...(g.weddingDate ? { weddingDate: g.weddingDate } : {}),
    ...(g.weddingTime ? { weddingTime: g.weddingTime } : {}),
  };

  if (out.guests[lookupId]) {
    console.error(`Duplicate token detected for "${g.nameRu}". Skipping.`);
    continue;
  }
  out.guests[lookupId] = await encryptGuest(token, record);
  links.push({ name: g.nameRu || g.nameUz, token });
}

const outPath = path.join(here, '..', 'data', 'guests.json');
await writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');

console.log(`\n✓ Encrypted ${links.length} guest(s) → data/guests.json\n`);
console.log('Personal invitation links:\n');
const sep = base.includes('?') ? '&' : '?';
for (const { name, token } of links) {
  console.log(`  ${name.padEnd(24)} ${base}${sep}invite=${token}`);
}
console.log('\nRemember: tools/guests.input.json must stay private (gitignored).\n');

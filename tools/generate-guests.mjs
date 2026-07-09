#!/usr/bin/env node
/**
 * generate-guests.mjs — rebuilds data/guests.json from tools/guests.input.json
 * and prints one personal invitation link per guest.
 *
 * ⚠ WHOLESALE REBUILD — only safe when tools/guests.input.json on THIS
 * machine is the complete, authoritative guest list. If guests were added
 * from another machine (via this same script or tools/add-guest.mjs),
 * their plaintext isn't in your local input file and a rebuild here would
 * silently drop them from the deployed database, breaking their links.
 * For adding one guest at a time — safe from any machine — use
 * tools/add-guest.mjs instead; it merges into the existing database
 * without ever touching guests it doesn't know about.
 *
 * A shrink-guard below refuses to write a database with fewer guests
 * than what's already deployed, unless you pass --force.
 *
 * Usage:
 *   node tools/generate-guests.mjs [inputFile] [--base https://you.github.io/repo/] [--force]
 *
 * Input (default tools/guests.input.json) — an array of guests:
 *   [{
 *     "token": "optional-fixed-token, otherwise generated",
 *     "nameRu": "Ксения",       "nameUz": "Kseniya",
 *     "lang": "ru",             "type": "family",
 *     "greetingRu": "Дорогая тётя Ксения",
 *     "greetingUz": "Hurmatli Kseniya xola",
 *     "weddingDate": "2026-09-26",   // optional per-guest override
 *     "weddingTime": "17:00",        // optional per-guest override
 *     "hidePartner": true            // optional: hide the bride's name
 *   }]
 *
 * KEEP THE INPUT FILE PRIVATE — it contains plaintext names. It is
 * covered by .gitignore; only the encrypted guests.json is deployed.
 */

import { readFile } from 'node:fs/promises';
import {
  BASE as DEFAULT_BASE, DB_PATH, newToken, lookupIdFor, buildRecord,
  encryptGuest, saveDb, loadInputList, saveInputList,
} from './guest-db.mjs';

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const base = baseIdx !== -1 ? args[baseIdx + 1] : DEFAULT_BASE;
const force = args.includes('--force');
const inputFileArg = args.find((a, i) => !a.startsWith('--') && i !== baseIdx + 1);

const guestsIn = inputFileArg
  ? JSON.parse(await readFile(inputFileArg, 'utf8'))
  : await loadInputList();

if (!Array.isArray(guestsIn) || guestsIn.length === 0) {
  console.error('Input must be a non-empty JSON array of guests.');
  process.exit(1);
}

const out = { version: 1, guests: {} };
const links = [];
let tokensAdded = 0;

for (const g of guestsIn) {
  // Generate a token once, then PERSIST it in the input file — re-running
  // the script must never invalidate links that were already sent out.
  if (!g.token) {
    g.token = newToken();
    tokensAdded++;
  }
  const lookupId = await lookupIdFor(g.token);

  if (out.guests[lookupId]) {
    console.error(`Duplicate token detected for "${g.nameRu}". Skipping.`);
    continue;
  }
  out.guests[lookupId] = await encryptGuest(g.token, buildRecord(g));
  links.push({ name: g.nameRu || g.nameUz, token: g.token });
}

// Shrink-guard: refuse to overwrite a bigger deployed database with a
// smaller one — that's the signature of a stale/incomplete local input
// file about to erase guests added elsewhere.
let existingCount = 0;
try {
  const existing = JSON.parse(await readFile(DB_PATH, 'utf8'));
  existingCount = Object.keys(existing.guests || {}).length;
} catch { /* no existing file yet — nothing to protect */ }

if (!force && existingCount > links.length) {
  console.error(`\n✗ Refusing to overwrite: data/guests.json currently has ${existingCount} guest(s),`);
  console.error(`  but this input file only produces ${links.length}. Guests added from another`);
  console.error('  machine would be lost. If this is intentional, re-run with --force.\n');
  process.exit(1);
}

await saveDb(out);

if (tokensAdded > 0) {
  await saveInputList(guestsIn);
  console.log(`✓ Saved ${tokensAdded} new token(s) back to guests.input.json`);
}

console.log(`\n✓ Encrypted ${links.length} guest(s) → data/guests.json\n`);
console.log('Personal invitation links:\n');
const sep = base.includes('?') ? '&' : '?';
for (const { name, token } of links) {
  console.log(`  ${name.padEnd(24)} ${base}${sep}invite=${token}`);
}
console.log('\nRemember: tools/guests.input.json must stay private (gitignored).\n');

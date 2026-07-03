#!/usr/bin/env node
/**
 * add-guest.mjs — add one guest and get their personal link in one command.
 *
 * Usage:
 *   node tools/add-guest.mjs "Имя (RU)" "Ism (UZ)" [flags]
 *
 * Flags:
 *   --f              female greeting  → «Дорогая …» / «Hurmatli …»
 *   --m              male greeting    → «Дорогой …» / «Hurmatli …»
 *   --family         plural greeting  → «Дорогая семья …» / «Hurmatli … oilasi»
 *   --lang ru|uz     the language the page opens in (default uz)
 *   --greeting-ru "…"  custom Russian greeting (overrides --f/--m)
 *   --greeting-uz "…"  custom Uzbek greeting
 *
 * Examples:
 *   node tools/add-guest.mjs "Хотинжон" "Hotinjon" --f
 *   node tools/add-guest.mjs "Азиз" "Aziz" --m --lang ru
 *   node tools/add-guest.mjs "Каримовы" "Karimovlar" --family
 *
 * The script appends the guest to tools/guests.input.json, rebuilds the
 * encrypted data/guests.json (existing links stay valid — tokens are
 * persisted), and prints the ready-to-send link for the new guest.
 * After running it, commit & push so the live site knows the new guest:
 *   git add data/guests.json && git commit -m "Add guest" && git push
 */

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = 'https://muxammadxon202.github.io/wedding-invite/';

const here = path.dirname(fileURLToPath(import.meta.url));
const inputFile = path.join(here, 'guests.input.json');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return true;
};
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};

const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--lang' || a === '--greeting-ru' || a === '--greeting-uz') { i++; continue; }
  if (a.startsWith('--')) continue;
  positional.push(a);
}

const [nameRu, nameUzArg] = positional;
if (!nameRu) {
  console.error('Usage: node tools/add-guest.mjs "Имя (RU)" "Ism (UZ)" [--f|--m|--family] [--lang ru|uz]');
  process.exit(1);
}
const nameUz = nameUzArg ?? nameRu;

const isF = flag('--f');
const isM = flag('--m');
const isFamily = flag('--family');
const lang = flagValue('--lang') === 'ru' ? 'ru' : 'uz';

let greetingRu = flagValue('--greeting-ru');
let greetingUz = flagValue('--greeting-uz');

if (!greetingRu) {
  if (isFamily) greetingRu = `Дорогая семья ${nameRu}`;
  else if (isF) greetingRu = `Дорогая ${nameRu}`;
  else if (isM) greetingRu = `Дорогой ${nameRu}`;
  else greetingRu = `Хурматли ${nameRu}`;
}
if (!greetingUz) {
  greetingUz = isFamily ? `Hurmatli ${nameUz} oilasi` : `Hurmatli ${nameUz}`;
}

// Append to the private input list
let guests = [];
try {
  guests = JSON.parse(await readFile(inputFile, 'utf8'));
} catch { /* first guest ever — start a new list */ }

if (guests.some((g) => g.nameRu === nameRu && g.nameUz === nameUz)) {
  console.error(`Гость "${nameRu}" уже есть в списке — ссылка ниже (не добавлен повторно).`);
} else {
  guests.push({
    nameRu, nameUz, lang,
    type: isFamily ? 'family' : 'guest',
    greetingRu, greetingUz,
  });
  await writeFile(inputFile, JSON.stringify(guests, null, 2) + '\n', 'utf8');
}

// Rebuild the encrypted database (tokens persist, old links stay valid)
const gen = spawnSync(process.execPath, [path.join(here, 'generate-guests.mjs')], {
  stdio: ['ignore', 'ignore', 'inherit'],
});
if (gen.status !== 0) {
  console.error('generate-guests.mjs failed — see errors above.');
  process.exit(1);
}

// The generator persisted tokens — read the fresh one and print the link
const updated = JSON.parse(await readFile(inputFile, 'utf8'));
const me = updated.find((g) => g.nameRu === nameRu && g.nameUz === nameUz);

console.log('\n──────────────────────────────────────────────');
console.log(`  Гость:       ${nameRu} / ${nameUz}`);
console.log(`  Приветствие: ${greetingRu} · ${greetingUz}`);
console.log(`  Язык:        ${lang.toUpperCase()}`);
console.log('\n  Личная ссылка (отправьте гостю):');
console.log(`  ${BASE}?invite=${me.token}`);
console.log('──────────────────────────────────────────────');
console.log('\nНе забудьте опубликовать: git add data/guests.json && git commit -m "guest" && git push\n');

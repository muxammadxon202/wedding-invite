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
 *   --hide-partner   this guest's card shows the groom's name plus a
 *                    generic "любимая / umr yo'ldoshim" instead of the
 *                    bride's real name (for guests who shouldn't see it
 *                    before the wedding)
 *   --greeting-ru "…"  custom Russian greeting (overrides --f/--m)
 *   --greeting-uz "…"  custom Uzbek greeting
 *
 * Examples:
 *   node tools/add-guest.mjs "Хотинжон" "Hotinjon" --f
 *   node tools/add-guest.mjs "Азиз" "Aziz" --m --lang ru
 *   node tools/add-guest.mjs "Мемати" "Memati" --m --hide-partner
 *
 * SAFE TO RUN FROM ANY MACHINE: this script only ever encrypts and
 * merges the ONE new guest into data/guests.json — every other guest
 * already deployed (added from a different machine's tools/guests.input.json)
 * is left completely untouched. It never rebuilds the whole database.
 *
 * After running it, publish so the live site knows the new guest:
 *   git add data/guests.json tools/guests.input.json && git commit -m "guest" && git push
 * (tools/guests.input.json itself stays gitignored — only the token
 * assigned to it is written locally so it's stable on re-runs.)
 */

import {
  BASE, loadInputList, saveInputList, loadDb, saveDb, mergeGuestIntoDb,
  newToken, buildRecord,
} from './guest-db.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
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
  console.error('Usage: node tools/add-guest.mjs "Имя (RU)" "Ism (UZ)" [--f|--m|--family] [--lang ru|uz] [--hide-partner]');
  process.exit(1);
}
const nameUz = nameUzArg ?? nameRu;

const isF = flag('--f');
const isM = flag('--m');
const isFamily = flag('--family');
const isHidePartner = flag('--hide-partner');
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

// Append to the private input list (local record-keeping only)
const guests = await loadInputList();

let me = guests.find((g) => g.nameRu === nameRu && g.nameUz === nameUz);
if (me) {
  console.error(`Гость "${nameRu}" уже есть в списке — ссылка ниже (не добавлен повторно).`);
} else {
  me = {
    nameRu, nameUz, lang,
    type: isFamily ? 'family' : 'guest',
    greetingRu, greetingUz,
    ...(isHidePartner ? { hidePartner: true } : {}),
  };
  guests.push(me);
}

if (!me.token) me.token = newToken();
await saveInputList(guests);

// Encrypt just this guest and merge into the deployed database —
// every other guest already there (from any machine) stays untouched.
const record = buildRecord(me);
const db = await loadDb();
await mergeGuestIntoDb(db, me.token, record);
await saveDb(db);

console.log('\n──────────────────────────────────────────────');
console.log(`  Гость:       ${nameRu} / ${nameUz}`);
console.log(`  Приветствие: ${greetingRu} · ${greetingUz}`);
console.log(`  Язык:        ${lang.toUpperCase()}`);
if (isHidePartner) console.log('  Имя невесты: скрыто (umr yo\'ldoshim / любимая)');
console.log('\n  Личная ссылка (отправьте гостю):');
console.log(`  ${BASE}?invite=${me.token}`);
console.log('──────────────────────────────────────────────');
console.log('\nНе забудьте опубликовать: git add data/guests.json tools/guests.input.json && git commit -m "guest" && git push\n');

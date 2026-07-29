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
 *   --date YYYY-MM-DD  this guest's own event date (overrides the default)
 *   --time HH:mm       this guest's own event time (overrides the default)
 *   --event-ru "…"     overrides the "Wedding invitation" badge text (RU) —
 *                       for a different event tied to the same couple
 *   --event-uz "…"     same, Uzbek
 *   --venue-ru "…"     plain-text-only location (RU) — hides the address
 *                       line and map card/links entirely
 *   --venue-uz "…"     same, Uzbek
 *   --venue-title-ru "…" overrides the venue section heading (RU), e.g.
 *                       so it doesn't say "wedding venue" for another event
 *   --venue-title-uz "…" same, Uzbek
 *   --hide-schedule    hides the day-programme/timeline section
 *
 * Examples:
 *   node tools/add-guest.mjs "Хотинжон" "Hotinjon" --f
 *   node tools/add-guest.mjs "Азиз" "Aziz" --m --lang ru
 *   node tools/add-guest.mjs "Мемати" "Memati" --m --hide-partner
 *   node tools/add-guest.mjs "Музаффар холапошшо" "Muzaffar xolaposhsho" --m \
 *     --lang uz --date 2026-08-04 --time 18:00 \
 *     --event-ru "Приглашение на келин салом" --event-uz "Kelin salomga taklifnoma" \
 *     --venue-ru "Дом семьи Очиловых" --venue-uz "Ochilovlar xonadoni" --hide-schedule
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

const VALUE_FLAGS = new Set([
  '--lang', '--greeting-ru', '--greeting-uz', '--date', '--time',
  '--event-ru', '--event-uz', '--venue-ru', '--venue-uz',
  '--venue-title-ru', '--venue-title-uz',
]);

const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (VALUE_FLAGS.has(a)) { i++; continue; }
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
const isHideSchedule = flag('--hide-schedule');
const lang = flagValue('--lang') === 'ru' ? 'ru' : 'uz';
const weddingDate = flagValue('--date');
const weddingTime = flagValue('--time');
const eventLabelRu = flagValue('--event-ru');
const eventLabelUz = flagValue('--event-uz');
const venueNameRu = flagValue('--venue-ru');
const venueNameUz = flagValue('--venue-uz');
const venueTitleRu = flagValue('--venue-title-ru');
const venueTitleUz = flagValue('--venue-title-uz');

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
const isUpdate = !!me;
const fields = {
  nameRu, nameUz, lang,
  type: isFamily ? 'family' : 'guest',
  greetingRu, greetingUz,
  ...(isHidePartner ? { hidePartner: true } : {}),
  ...(weddingDate ? { weddingDate } : {}),
  ...(weddingTime ? { weddingTime } : {}),
  ...(eventLabelRu || eventLabelUz ? { eventLabelRu: eventLabelRu ?? '', eventLabelUz: eventLabelUz ?? '' } : {}),
  ...(venueNameRu || venueNameUz ? { venueNameRu: venueNameRu ?? '', venueNameUz: venueNameUz ?? '' } : {}),
  ...(venueTitleRu || venueTitleUz ? { venueTitleRu: venueTitleRu ?? '', venueTitleUz: venueTitleUz ?? '' } : {}),
  ...(isHideSchedule ? { hideSchedule: true } : {}),
};
if (isUpdate) {
  // Re-running with the same name updates the record in place (same
  // token, same link) — lets you amend greetings/overrides after the fact.
  Object.assign(me, fields);
  console.error(`Гость "${nameRu}" уже есть в списке — запись обновлена, ссылка не изменилась.`);
} else {
  me = fields;
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
if (me.weddingDate || me.weddingTime) console.log(`  Своя дата:   ${me.weddingDate ?? '(по умолчанию)'} ${me.weddingTime ?? ''}`.trim());
if (me.eventLabelRu || me.eventLabelUz) console.log(`  Др. событие: ${me.eventLabelRu} · ${me.eventLabelUz}`);
if (me.venueNameRu || me.venueNameUz) console.log(`  Своё место:  ${me.venueNameRu} · ${me.venueNameUz} (адрес/карта скрыты)`);
if (me.venueTitleRu || me.venueTitleUz) console.log(`  Загол. места: ${me.venueTitleRu} · ${me.venueTitleUz}`);
if (me.hideSchedule) console.log('  Программа:   скрыта');
console.log('\n  Личная ссылка (отправьте гостю):');
console.log(`  ${BASE}?invite=${me.token}`);
console.log('──────────────────────────────────────────────');
console.log('\nНе забудьте опубликовать: git add data/guests.json tools/guests.input.json && git commit -m "guest" && git push\n');

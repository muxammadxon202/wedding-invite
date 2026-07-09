/**
 * guest-db.mjs — shared crypto + storage helpers for guest management.
 *
 * Security model (mirrored by js/guest.js):
 *   token     — 128-bit CSPRNG value, base64url, lives only in the link
 *   lookupId  — SHA-256("wedding-lookup-v1|" + token) → first 32 hex chars
 *   key       — SHA-256("wedding-key-v1|" + token) → AES-256-GCM
 *   payload   — AES-GCM(guest record), fresh random 96-bit IV
 *
 * Multi-machine safety: mergeGuestIntoDb() only ever adds/overwrites the
 * ONE lookupId being touched — every other guest already in
 * data/guests.json (added from a different machine's tools/add-guest.mjs
 * run) is left completely untouched. Never do a wholesale rebuild unless
 * you are certain your local tools/guests.input.json is the complete,
 * authoritative list (see generate-guests.mjs's shrink-guard).
 */

import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const BASE = 'https://muxammadxon202.github.io/wedding-invite/';

const here = path.dirname(fileURLToPath(import.meta.url));
export const INPUT_PATH = path.join(here, 'guests.input.json');
export const DB_PATH = path.join(here, '..', 'data', 'guests.json');

const LOOKUP_PREFIX = 'wedding-lookup-v1|';
const KEY_PREFIX = 'wedding-key-v1|';
const enc = new TextEncoder();

export const toBase64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256 = (text) => crypto.subtle.digest('SHA-256', enc.encode(text));

export const newToken = () => toBase64url(crypto.getRandomValues(new Uint8Array(16)));

export async function lookupIdFor(token) {
  return toHex(await sha256(LOOKUP_PREFIX + token)).slice(0, 32);
}

export async function encryptGuest(token, record) {
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

/** Normalizes a raw guest input entry into the record that gets encrypted. */
export function buildRecord(g) {
  return {
    nameRu: g.nameRu ?? '',
    nameUz: g.nameUz ?? '',
    lang: g.lang === 'uz' ? 'uz' : 'ru',
    type: g.type ?? 'guest',
    greetingRu: g.greetingRu ?? '',
    greetingUz: g.greetingUz ?? '',
    ...(g.weddingDate ? { weddingDate: g.weddingDate } : {}),
    ...(g.weddingTime ? { weddingTime: g.weddingTime } : {}),
    // hidePartner: this guest's card shows the groom's name plus a
    // generic "umr yo'ldoshim / любимая" instead of the bride's real
    // name — used for guests who shouldn't see it before the wedding.
    ...(g.hidePartner ? { hidePartner: true } : {}),
  };
}

export async function loadInputList() {
  try {
    return JSON.parse(await readFile(INPUT_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export async function saveInputList(list) {
  await writeFile(INPUT_PATH, JSON.stringify(list, null, 2) + '\n', 'utf8');
}

export async function loadDb() {
  try {
    return JSON.parse(await readFile(DB_PATH, 'utf8'));
  } catch {
    return { version: 1, guests: {} };
  }
}

export async function saveDb(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

/** Encrypts one guest and merges it into an existing database — every
 *  other guest already present is left completely untouched. */
export async function mergeGuestIntoDb(db, token, record) {
  const lookupId = await lookupIdFor(token);
  db.guests[lookupId] = await encryptGuest(token, record);
  return lookupId;
}

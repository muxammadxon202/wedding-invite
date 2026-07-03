/**
 * guest.js — secure guest resolution for static hosting.
 *
 * How it works (mirrors tools/generate-guests.mjs):
 *  - Each guest owns a random 128-bit token, sent only in their URL:
 *      https://site/?invite=<token>
 *  - data/guests.json stores NO readable data. Per guest it holds:
 *      lookupId  = SHA-256("wedding-lookup-v1|" + token), first 32 hex chars
 *      payload   = AES-256-GCM(guestJSON) with key
 *                  SHA-256("wedding-key-v1|" + token)
 *  - Without a valid token nothing in the file can be decrypted, and the
 *    lookup hash reveals nothing about the key (different domain prefix).
 *
 * Any failure (bad token, tampered ciphertext, missing record) resolves
 * to null and the caller shows the elegant "not found" screen.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const LOOKUP_PREFIX = 'wedding-lookup-v1|';
const KEY_PREFIX = 'wedding-key-v1|';

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256(text) {
  return crypto.subtle.digest('SHA-256', enc.encode(text));
}

/**
 * Resolves the guest for the current URL.
 * @returns {Promise<object|null>} decrypted guest record or null
 */
export async function loadGuest() {
  try {
    const token = new URLSearchParams(location.search).get('invite');
    if (!token || !TOKEN_RE.test(token)) return null;
    if (!crypto.subtle) return null; // requires https or localhost

    const [lookupHash, keyBytes, res] = await Promise.all([
      sha256(LOOKUP_PREFIX + token),
      sha256(KEY_PREFIX + token),
      fetch('data/guests.json', { cache: 'no-store' }),
    ]);
    if (!res.ok) return null;

    const db = await res.json();
    const record = db && db.guests && db.guests[bytesToHex(lookupHash).slice(0, 32)];
    if (!record) return null;

    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64urlToBytes(record.iv) },
      key,
      base64urlToBytes(record.data),
    );
    return JSON.parse(dec.decode(plain));
  } catch {
    // Wrong key, tampered data, network failure — all end the same way.
    return null;
  }
}

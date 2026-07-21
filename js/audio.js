/**
 * audio.js — the wedding soundtrack, staged like a film cue rather than
 * background music. The mp3 (assets/music.mp3) is added by the couple
 * later; when it is missing the control simply never appears.
 *
 * Playback timeline:
 *   click "Open Invitation"  → start() unlocks the <audio> element
 *                              (satisfies the autoplay gesture policy)
 *   rings meet on screen      → riseAtRingTouch() fades the soundtrack in
 *   reduced-motion fallback   → riseImmediately() fades the soundtrack in
 */

import { CONFIG } from './config.js';
import { t, onChange } from './i18n.js';

const btn = document.getElementById('musicBtn');

let el = null;
let available = false;
let fadeRaf = 0;

function fadeTo(volume, ms) {
  cancelAnimationFrame(fadeRaf);
  const from = el.volume;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    el.volume = from + (volume - from) * (k * (2 - k)); // ease-out
    if (k < 1) {
      fadeRaf = requestAnimationFrame(step);
    } else if (volume === 0) {
      el.pause();
    }
  };
  fadeRaf = requestAnimationFrame(step);
}

function refreshButton(playing) {
  btn.setAttribute('aria-pressed', String(playing));
  btn.setAttribute('aria-label', t(playing ? 'a11y.musicOff' : 'a11y.musicOn'));
}

function revealButton() {
  if (btn.hidden) {
    btn.hidden = false;
    requestAnimationFrame(() => btn.classList.add('is-visible'));
  }
}

export const music = {
  /** Preflights the file so a missing mp3 never breaks the experience. */
  async init() {
    try {
      const res = await fetch(CONFIG.musicSrc, { method: 'HEAD' });
      available = res.ok;
    } catch {
      available = false;
    }
    if (!available) return;

    el = new Audio(CONFIG.musicSrc);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.addEventListener('error', () => {
      available = false;
      btn.hidden = true;
    });

    btn.addEventListener('click', () => {
      const playing = btn.getAttribute('aria-pressed') === 'true';
      if (playing) {
        fadeTo(0, 900);
        refreshButton(false);
      } else {
        el.play().catch(() => {});
        fadeTo(CONFIG.musicVolume, 1100);
        refreshButton(true);
      }
    });

    onChange(() => refreshButton(btn.getAttribute('aria-pressed') === 'true'));
  },

  /**
   * Called synchronously from the open-button click — the "user gesture"
   * browsers require to permit playback. Unlocks the <audio> element.
   */
  start() {
    if (!available || !el) return;
    el.play().catch(() => {});
  },

  /**
   * Called as the two rings visually meet — the soundtrack fades in
   * gently, as if their touch is what starts the music. No chime.
   */
  riseAtRingTouch() {
    if (!available || !el) return;
    el.play().catch(() => {});
    fadeTo(CONFIG.musicVolume, 2600);
    revealButton();
    refreshButton(true);
  },

  /** Reduced-motion fallback — no rings play, so just fade in gently. */
  riseImmediately() {
    if (!available || !el) return;
    el.play().catch(() => {});
    fadeTo(CONFIG.musicVolume, 2600);
    revealButton();
    refreshButton(true);
  },

  /** Reveals the control after the intro when music exists but never rose. */
  showControl() {
    if (available) revealButton();
  },
};

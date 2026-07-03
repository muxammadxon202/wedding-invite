/**
 * audio.js — the wedding soundtrack, staged like a film cue rather than
 * background music. The mp3 (assets/music.mp3) is added by the couple
 * later; when it is missing the control simply never appears.
 *
 * Playback timeline:
 *   click "Open Invitation"  → start() unlocks <audio> + WebAudio silently
 *                              (satisfies autoplay policy, nothing audible yet)
 *   rings touch on screen    → riseAtRingTouch() plays a short synthesized
 *                              ring-chime, then the soundtrack fades in
 *   reduced-motion fallback  → riseImmediately() fades the soundtrack in
 *                              with no chime (there is no ring animation
 *                              to anchor it to)
 */

import { CONFIG } from './config.js';
import { t, onChange } from './i18n.js';

const btn = document.getElementById('musicBtn');

let el = null;
let available = false;
let fadeRaf = 0;
let actx = null;

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

/* ---------- ring-touch chime (synthesized, no extra asset) ---------- */

function ensureAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!actx) actx = new AudioCtx();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}

/** A brief, bright metallic "ting" — two gold bands meeting. ~0.32s. */
function playRingChime() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);

  [
    { freq: 2600, gain: 0.22, decay: 0.32 },
    { freq: 3900, gain: 0.13, decay: 0.24 },
    { freq: 5200, gain: 0.07, decay: 0.16 },
  ].forEach(({ freq, gain, decay }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  });
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
   * Called synchronously from the open-button click. Unlocks the <audio>
   * element and the WebAudio context while nothing is audible yet — this
   * is the "user gesture" browsers require, spent early so the real cue
   * later (riseAtRingTouch) never needs a fresh gesture of its own.
   */
  start() {
    ensureAudioContext();
    if (!available || !el) return;
    el.play().catch(() => {});
  },

  /**
   * The emotional cue: called the instant the two rings visually meet.
   * Plays a soft ring-touch chime, then lets the soundtrack rise —
   * as if their touch is what starts the music.
   */
  riseAtRingTouch() {
    playRingChime();
    if (!available || !el) return;
    setTimeout(() => {
      el.play().catch(() => {});
      fadeTo(CONFIG.musicVolume, 2600);
      revealButton();
      refreshButton(true);
    }, 260);
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

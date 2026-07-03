/**
 * intro.js — the cinematic opening sequence.
 *
 * Timeline after the guest clicks "Open Invitation" (~4.2s total):
 *   0.00s  button morphs into light, golden burst from its position
 *          (music.start() silently unlocks playback — nothing audible yet)
 *   0.10s  butterflies fly away (physics, depth)
 *   0.60s  petals (sakura + chamomile) begin falling on the ambient layer
 *   0.70s  intro modal dissolves, rings overlay fades in and plays:
 *          rings rotate in from the sides, meet, touch, gleam sweeps,
 *          flare + flash at the touch point, bloom rises
 *   3.20s  the rings touch — a soft chime rings out, then the soundtrack
 *          fades in underneath it, as if their meeting starts the music
 *   3.90s  overlay dissolves, the invitation fades in underneath
 *
 * Under prefers-reduced-motion the whole sequence collapses to a
 * simple elegant crossfade, and the soundtrack fades in immediately
 * (there is no ring animation to anchor the chime to).
 */

import { music } from './audio.js';
import { REDUCED_MOTION } from './particles.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function playIntro({ introField, ambientField, onReveal }) {
  const intro = document.getElementById('intro');
  const cinema = document.getElementById('cinema');
  const openBtn = document.getElementById('openBtn');

  openBtn.disabled = true;
  music.start();

  if (REDUCED_MOTION) {
    intro.classList.add('is-leaving');
    music.riseImmediately();
    await wait(250);
    finish({ intro, cinema, introField, onReveal });
    return;
  }

  // 1. Button morph + golden burst from its centre
  openBtn.classList.add('is-morphing');
  const r = openBtn.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  introField.burstAt(cx, cy, 44);

  // 2. Butterflies explode outward from the light, staggered like a flock
  await wait(120);
  introField.explodeFrom(cx, cy);

  // 3–7. Petals + ambient sparkles start beneath the overlay
  await wait(480);
  ambientField.start();
  ambientField.startPetals();

  // Intro dissolves while the rings overlay appears
  await wait(100);
  intro.classList.add('is-leaving');
  cinema.hidden = false;
  requestAnimationFrame(() => {
    cinema.classList.add('is-visible', 'play');
  });

  // 8. The rings touch at 2.5s into their animation (matches the flash/
  // spark-burst keyframes in animations.css) — that instant is the chime
  // cue, with the soundtrack rising right behind it. Runs on its own
  // timer so it never blocks the rest of the sequence below.
  setTimeout(() => music.riseAtRingTouch(), 2500);

  // 9. Flash peaks ~3.5s in; hold the overlay a beat past it
  await wait(3200);
  cinema.classList.add('is-leaving');
  await wait(650);
  finish({ intro, cinema, introField, onReveal });
}

function finish({ intro, cinema, introField, onReveal }) {
  introField.destroy();
  intro.remove();
  cinema.remove();
  onReveal();
}

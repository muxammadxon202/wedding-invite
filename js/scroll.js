/**
 * scroll.js — scroll-reveal (IntersectionObserver) and a feather-light
 * parallax for decorative ornaments. Transform-only, rAF-throttled,
 * fully disabled under prefers-reduced-motion.
 */

import { REDUCED_MOTION } from './particles.js';

export function initScrollEffects() {
  const revealed = document.querySelectorAll('.reveal');

  if (REDUCED_MOTION) {
    revealed.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
  );
  revealed.forEach((el) => io.observe(el));

  // Parallax: hero sprigs drift slower than the page. The computed
  // matrix is kept as the base so the CSS rotation survives.
  const layers = [...document.querySelectorAll('.hero__sprig')].map((el, i) => {
    const computed = getComputedStyle(el).transform;
    return {
      el,
      speed: i === 0 ? -0.12 : -0.09,
      base: computed === 'none' ? '' : computed,
    };
  });

  if (!layers.length) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    for (const l of layers) {
      l.el.style.transform = `${l.base} translateY(${Math.round(y * l.speed)}px)`;
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
}

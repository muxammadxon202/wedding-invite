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

  // Path-timeline marker: a small heart glides along the winding gold
  // thread behind the schedule, tracking how far the guest has scrolled
  // through that section. getTotalLength()/getPointAtLength() work off
  // the path's own coordinate space, independent of its rendered pixel
  // size — safe to read as soon as the element exists in the DOM.
  const pathContainer = document.getElementById('pathTimeline');
  const curve = document.getElementById('pathCurve');
  const marker = document.getElementById('pathMarker');
  const markerReady = !!(pathContainer && curve && marker && curve.getTotalLength);
  const curveLength = markerReady ? curve.getTotalLength() : 0;

  if (!layers.length && !markerReady) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    for (const l of layers) {
      l.el.style.transform = `${l.base} translateY(${Math.round(y * l.speed)}px)`;
    }
    if (markerReady) {
      const rect = pathContainer.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.85;   // marker at path start when section just enters view
      const end = vh * 0.15;     // marker at path end as section is about to leave
      const span = rect.height + (start - end);
      const progress = Math.min(1, Math.max(0, (start - rect.top) / span));
      const pt = curve.getPointAtLength(progress * curveLength);
      marker.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    }
  };
  update(); // place the marker correctly before the first scroll event
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

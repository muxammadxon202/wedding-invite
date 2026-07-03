/**
 * countdown.js — drives every [data-countdown] block on the page
 * from a single 1-second interval. When the moment arrives, the grid
 * is replaced with a celebratory line.
 */

import { t, onChange } from './i18n.js';

let target = null;
let timer = null;
let finished = false;

const pad = (n) => String(n).padStart(2, '0');

function render() {
  const now = Date.now();
  const diff = target.getTime() - now;

  if (diff <= 0) {
    if (!finished) {
      finished = true;
      document.querySelectorAll('[data-countdown]').forEach((box) => {
        const grid = box.querySelector('.countdown__grid');
        if (!grid) return;
        const done = document.createElement('p');
        done.className = 'countdown__done';
        done.textContent = t('cd.today');
        grid.replaceWith(done);
      });
      clearInterval(timer);
    }
    return;
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000) % 24;
  const minutes = Math.floor(diff / 60_000) % 60;
  const seconds = Math.floor(diff / 1_000) % 60;

  document.querySelectorAll('[data-countdown]').forEach((box) => {
    const set = (name, value) => {
      const el = box.querySelector(`[data-cd="${name}"]`);
      if (el && el.textContent !== value) el.textContent = value;
    };
    set('days', String(days));
    set('hours', pad(hours));
    set('minutes', pad(minutes));
    set('seconds', pad(seconds));
  });
}

export function initCountdowns(momentDate) {
  target = momentDate;
  render();
  timer = setInterval(render, 1000);

  // If the language flips after the wedding day message is shown, refresh it.
  onChange(() => {
    if (finished) {
      document.querySelectorAll('.countdown__done').forEach((el) => {
        el.textContent = t('cd.today');
      });
    }
  });
}

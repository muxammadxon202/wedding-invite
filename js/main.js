/**
 * main.js — entry point. Resolves the guest, localizes the page,
 * builds dynamic sections, and wires the cinematic opening.
 */

import { CONFIG, weddingMoment } from './config.js';
import { t, getLang, setLang, restoreLang, onChange, applyDom } from './i18n.js';
import { loadGuest } from './guest.js';
import { initCountdowns } from './countdown.js';
import { ParticleField } from './particles.js';
import { music } from './audio.js';
import { playIntro } from './intro.js';
import { initScrollEffects } from './scroll.js';

const $ = (id) => document.getElementById(id);

/* ---------- language switch ---------- */

function wireLanguageSwitch() {
  const buttons = document.querySelectorAll('.lang-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  onChange((lang) => {
    buttons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });
  });
}

/* ---------- localized dynamic content ---------- */

// Hand-rolled date names: browser CLDR data for uz-Latn is unreliable
// (Chrome renders "2026 M09 26"), so both languages format deterministically.
const DATE_NAMES = {
  ru: {
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    // Nominative case — for standalone labels like the calendar card
    // header, where "августа" (genitive, used in "3 августа") reads wrong.
    monthsNom: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
      'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    weekdays: ['воскресенье', 'понедельник', 'вторник', 'среда',
      'четверг', 'пятница', 'суббота'],
  },
  uz: {
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    weekdays: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba',
      'payshanba', 'juma', 'shanba'],
  },
};

function formatDate(dateObj, lang) {
  const d = dateObj.getDate();
  const m = DATE_NAMES[lang].months[dateObj.getMonth()];
  const y = dateObj.getFullYear();
  return lang === 'uz' ? `${d}-${m}, ${y}-yil` : `${d} ${m} ${y}`;
}

function formatWeekday(dateObj, lang) {
  return DATE_NAMES[lang].weekdays[dateObj.getDay()];
}

function greetingFor(guest, lang) {
  if (guest) {
    const g = lang === 'uz' ? guest.greetingUz : guest.greetingRu;
    if (g) return g;
  }
  return t('intro.fallbackGreeting');
}

/** Second half of the couple's name, or a generic stand-in for guests
 * whose invite has `hidePartner` set (they shouldn't see the bride's
 * real name before the wedding). */
function partnerNameFor(guest, lang) {
  return (guest && guest.hidePartner) ? t('hero.partnerHidden') : CONFIG.couple.second[lang];
}

/** Full "Groom & Bride" display string, respecting hidePartner. */
function coupleDisplay(guest, lang) {
  return `${CONFIG.couple.first[lang]} ${t('common.and')} ${partnerNameFor(guest, lang)}`;
}

/* ---------- add to calendar (.ics download) ---------- */

const pad2 = (n) => String(n).padStart(2, '0');

const icsTimestamp = (d) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
  `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

const icsEscape = (s) => s.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

/** Builds a data: URL for a standalone .ics file — works offline, no
 * external calendar API, and every mobile OS offers to open it with
 * the guest's own calendar app. Respects hidePartner in the title. */
function buildIcsDataUrl(guest, moment, lang) {
  const start = moment;
  const end = new Date(start.getTime() + 5 * 60 * 60 * 1000); // 5h default
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Invite//RU',
    'BEGIN:VEVENT',
    `UID:${start.getTime()}-wedding-invite@muxammadxon202.github.io`,
    `DTSTAMP:${icsTimestamp(new Date())}`,
    `DTSTART:${icsTimestamp(start)}`,
    `DTEND:${icsTimestamp(end)}`,
    `SUMMARY:${icsEscape(`${coupleDisplay(guest, lang)} — ${t('hero.eyebrow')}`)}`,
    `LOCATION:${icsEscape(`${CONFIG.venue.name[lang]}, ${CONFIG.venue.address[lang]}`)}`,
    `DESCRIPTION:${icsEscape(greetingFor(guest, lang))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
}

function renderDynamic(guest, moment) {
  const lang = getLang();

  document.title = `${t('meta.title')} · ${coupleDisplay(guest, lang)}`;

  const greeting = greetingFor(guest, lang);
  const introGreeting = $('introGreeting');
  if (introGreeting) introGreeting.textContent = `${greeting},`;
  $('mainGreeting').textContent = greeting;

  $('heroNames').replaceChildren(
    document.createTextNode(CONFIG.couple.first[lang] + ' '),
    Object.assign(document.createElement('span'), { className: 'hero__amp', textContent: '&' }),
    document.createTextNode(' ' + partnerNameFor(guest, lang)),
  );
  $('heroDate').textContent = formatDate(moment, lang);
  $('dateLine').textContent =
    `${formatDate(moment, lang)} · ${formatWeekday(moment, lang)} · ${
      (guest && guest.weddingTime) || CONFIG.weddingTime}`;

  $('venueName').textContent = CONFIG.venue.name[lang];
  $('venueAddress').textContent = CONFIG.venue.address[lang];
  $('closingNames').textContent = coupleDisplay(guest, lang);

  // Add-to-calendar card: date shown per guest's own wedding moment,
  // click generates a fresh .ics with the current language/guest baked in
  const calMonth = $('calMonth');
  const calDay = $('calDay');
  if (calMonth && calDay) {
    calDay.textContent = String(moment.getDate());
    const nomMonths = DATE_NAMES[lang].monthsNom || DATE_NAMES[lang].months;
    calMonth.textContent = nomMonths[moment.getMonth()].toUpperCase();
  }
  const calBtn = $('addCalendarBtn');
  if (calBtn) {
    calBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = buildIcsDataUrl(guest, moment, lang);
      a.download = 'wedding.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  }

  // Wax-seal monogram on the open button — first letters, per language
  const sealMono = $('openSealMono');
  if (sealMono) {
    sealMono.textContent = `${CONFIG.couple.first[lang][0]}&${CONFIG.couple.second[lang][0]}`;
  }

  // Schedule path-timeline: icon badge + time/name/sub per moment
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  $('scheduleList').replaceChildren(
    ...CONFIG.schedule.map((item, i) => {
      const li = document.createElement('li');
      li.className = 'path-item';
      li.dataset.stagger = '';
      li.style.setProperty('--i', i);

      const iconWrap = document.createElement('span');
      iconWrap.className = 'path-item__icon';
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttributeNS(XLINK_NS, 'xlink:href', `#${item.icon}`);
      use.setAttribute('href', `#${item.icon}`);
      svg.append(use);
      iconWrap.append(svg);

      const body = document.createElement('div');
      body.className = 'path-item__body';
      const time = Object.assign(document.createElement('p'), {
        className: 'path-item__time', textContent: item.time,
      });
      const name = Object.assign(document.createElement('p'), {
        className: 'path-item__name', textContent: t(`schedule.${item.key}`),
      });
      const sub = Object.assign(document.createElement('p'), {
        className: 'path-item__sub', textContent: t(`schedule.${item.key}.sub`),
      });
      body.append(time, name, sub);

      li.append(iconWrap, body);
      return li;
    }),
  );

  // Contacts
  $('contactsList').replaceChildren(
    ...CONFIG.contacts.map((c, i) => {
      const li = document.createElement('li');
      li.className = 'contact-card';
      li.dataset.stagger = '';
      li.style.setProperty('--i', i);
      const name = Object.assign(document.createElement('p'), {
        className: 'contact-card__name', textContent: c.name[lang],
      });
      const phone = Object.assign(document.createElement('a'), {
        className: 'contact-card__phone', textContent: c.phone, href: `tel:${c.tel}`,
      });
      li.append(name, phone);
      return li;
    }),
  );
}

/* ---------- venue map (loaded on demand to keep the page featherlight) ---------- */

function wireMap() {
  const { lat, lng, links } = CONFIG.venue;
  // Prefer the couple's own share links; fall back to coordinates.
  $('mapGoogle').href = (links && links.google) || `https://maps.google.com/?q=${lat},${lng}`;
  $('mapYandex').href = (links && links.yandex) || `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`;

  $('mapLoadBtn').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://yandex.ru/map-widget/v1/?ll=${lng}%2C${lat}&z=16&pt=${lng},${lat},pm2ywm`;
    iframe.title = CONFIG.venue.name[getLang()];
    iframe.loading = 'lazy';
    iframe.setAttribute('allowfullscreen', '');
    const card = $('mapCard');
    card.append(iframe);
    $('mapFacade').remove();
  });
}

/* ---------- not found ---------- */

function showNotFound() {
  $('intro').remove();
  $('cinema').remove();
  $('invitation').remove();
  document.getElementById('ambientCanvas').remove();
  $('notFound').hidden = false;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
}

/* ---------- reveal after the cinematic ---------- */

function revealInvitation() {
  const main = $('invitation');
  document.body.classList.remove('intro-active', 'is-loading');
  document.body.classList.add('on-light');
  document.body.style.background = 'var(--ivory)';
  main.hidden = false;
  window.scrollTo(0, 0);
  requestAnimationFrame(() => main.classList.add('is-visible'));
  initScrollEffects();
  music.showControl();
}

/* ---------- boot ---------- */

async function boot() {
  wireLanguageSwitch();
  $('footerYear').textContent = String(new Date().getFullYear());

  const guest = await loadGuest();

  if (!guest) {
    applyDom();
    restoreLang();
    showNotFound();
    return;
  }

  // Language priority: guest's saved choice → language set in their record
  if (!restoreLang() && (guest.lang === 'ru' || guest.lang === 'uz')) {
    setLang(guest.lang, { persist: false });
  }

  const moment = weddingMoment(guest);
  applyDom();
  renderDynamic(guest, moment);
  onChange(() => renderDynamic(guest, moment));

  initCountdowns(moment);
  wireMap();
  music.init();

  // Dark stage: smoke + dense golden dust + bokeh + sparkles + a full
  // twelve-variety petal shower + butterfly flock with near fly-bys
  const introField = new ParticleField($('introCanvas'), {
    theme: 'dark', dust: 270, sparkles: 64, smoke: 17, bokeh: 11,
    sakura: 30, chamomile: 16, roses: 80, butterflies: true,
  });
  // Ambient layer behind the invitation: petal shower + dust + soft fog
  const ambientField = new ParticleField($('ambientCanvas'), {
    theme: 'light', dust: 115, sparkles: 30, smoke: 10, bokeh: 8,
    sakura: 56, chamomile: 32, roses: 85,
  });

  document.body.classList.add('intro-active', 'is-ready');
  document.body.classList.remove('is-loading');
  introField.start();

  $('openBtn').addEventListener('click', () => {
    playIntro({ introField, ambientField, onReveal: revealInvitation });
  }, { once: true });
}

boot();

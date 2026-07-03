/**
 * config.js — the single place to edit wedding details.
 * Everything the couple may want to change lives here.
 */
export const CONFIG = {
  couple: {
    ru: 'Мухаммадхон и Зилолахон',
    uz: 'Muhammadxon va Zilolaxon',
    // Hero heading parts (rendered as "First <amp> Second")
    first: { ru: 'Мухаммадхон', uz: 'Muhammadxon' },
    second: { ru: 'Зилолахон', uz: 'Zilolaxon' },
  },

  // Default celebration date/time (guests may carry their own).
  weddingDate: '2026-08-03',   // YYYY-MM-DD
  weddingTime: '18:00',        // HH:mm, 24h
  utcOffset: '+05:00',         // Asia/Samarkand

  venue: {
    name: { ru: 'Банкетный зал «Visol»', uz: '«Visol» bazmgohi' },
    address: {
      ru: 'Самаркандская область, г. Челек',
      uz: 'Samarqand viloyati, Chelak shahri',
    },
    lat: 39.9086247,
    lng: 66.8613885,
    // Exact share links from the couple — used for the external buttons.
    links: {
      google: 'https://maps.app.goo.gl/jHG6uEXwXGfvjQQr5',
      yandex: 'https://yandex.uz/maps/-/CTeeiF4-',
    },
  },

  // Day programme: times here, translated labels in i18n.js
  schedule: [
    { time: '17:00', key: 'gathering' },
    { time: '18:00', key: 'ceremony' },
    { time: '19:00', key: 'banquet' },
    { time: '23:00', key: 'farewell' },
  ],

  contacts: [
    { name: { ru: 'Азиз', uz: 'Aziz' }, phone: '+998 90 123-45-67', tel: '+998901234567' },
    { name: { ru: 'Дилноза', uz: 'Dilnoza' }, phone: '+998 91 765-43-21', tel: '+998917654321' },
  ],

  musicSrc: 'assets/music/2.mp3',
  musicVolume: 0.65,
};

/** Builds the countdown target Date from guest overrides or defaults. */
export function weddingMoment(guest) {
  const date = (guest && guest.weddingDate) || CONFIG.weddingDate;
  const time = (guest && guest.weddingTime) || CONFIG.weddingTime;
  return new Date(`${date}T${time}:00${CONFIG.utcOffset}`);
}

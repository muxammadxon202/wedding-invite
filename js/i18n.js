/**
 * i18n.js — all UI strings for both languages plus a tiny runtime:
 * t(key), setLang(), getLang(), onChange(), applyDom().
 * Switching languages re-renders instantly without a reload.
 */

export const STRINGS = {
  ru: {
    'meta.title': 'Свадебное приглашение',
    'a11y.skip': 'Перейти к приглашению',
    'a11y.langLabel': 'Выбор языка',
    'a11y.musicOn': 'Включить музыку',
    'a11y.musicOff': 'Выключить музыку',
    'a11y.addToCalendar': 'Добавить дату свадьбы в календарь',
    'common.and': 'и',
    'hero.partnerHidden': 'любимая',

    'intro.badge': 'Свадебное приглашение',
    'intro.fallbackGreeting': 'Дорогие гости',
    'intro.lead': 'Приглашаем вас разделить с нами самый важный день нашей жизни',
    'intro.open': 'Открыть приглашение',

    'date.addToCalendar': 'Добавить в календарь',

    'cd.title': 'До торжества осталось',
    'cd.aria': 'Обратный отсчёт до свадьбы',
    'cd.days': 'дней',
    'cd.hours': 'часов',
    'cd.minutes': 'минут',
    'cd.seconds': 'секунд',
    'cd.today': 'Этот день настал!',

    'hero.eyebrow': 'Приглашение на свадьбу',

    'invite.p1': 'В нашей жизни наступает особенный день — день, когда два сердца соединятся в одно. Мы будем счастливы разделить эти мгновения с самыми близкими и дорогими людьми.',
    'invite.p2': 'Ваше присутствие сделает наш праздник по-настоящему незабываемым.',

    'date.eyebrow': 'Сохраните дату',
    'date.title': 'Когда',

    'schedule.eyebrow': 'Как пройдёт день',
    'schedule.title': 'Программа дня',
    'schedule.gathering': 'Сбор гостей',
    'schedule.gathering.sub': 'Welcome-зона',
    'schedule.ceremony': 'Церемония',
    'schedule.ceremony.sub': 'Самые важные слова',
    'schedule.banquet': 'Банкет',
    'schedule.banquet.sub': 'Ужин, тосты и танцы',
    'schedule.cake': 'Торт',
    'schedule.cake.sub': 'Церемония разрезания торта',
    'schedule.farewell': 'Завершение вечера',
    'schedule.farewell.sub': 'Тёплые объятия на прощание',

    'venue.eyebrow': 'Ждём вас',
    'venue.title': 'Место проведения',
    'venue.showMap': 'Показать карту',
    'venue.google': 'Открыть в Google Maps',
    'venue.yandex': 'Открыть в Яндекс Картах',

    'contacts.eyebrow': 'Вопросы',
    'contacts.title': 'Будем на связи',
    'contacts.sub': 'Если у вас появятся вопросы, мы с радостью ответим.',

    'closing.text': 'Мы очень ждём встречи и будем счастливы видеть вас среди самых близких!',
    'closing.sign': 'С любовью,',

    'nf.title': 'Приглашение не найдено',
    'nf.text': 'Проверьте, пожалуйста, ссылку из личного сообщения — или свяжитесь с нами, и мы отправим её ещё раз.',

    'footer.made': 'Сделано с любовью',
  },

  uz: {
    'meta.title': 'Toʻy taklifnomasi',
    'a11y.skip': 'Taklifnomaga oʻtish',
    'a11y.langLabel': 'Tilni tanlash',
    'a11y.musicOn': 'Musiqani yoqish',
    'a11y.musicOff': 'Musiqani oʻchirish',
    'a11y.addToCalendar': 'Toʻy sanasini kalendarga qoʻshish',
    'common.and': 'va',
    'hero.partnerHidden': "umr yoʻldoshim",

    'intro.badge': 'Toʻy taklifnomasi',
    'intro.fallbackGreeting': 'Aziz mehmonlar',
    'intro.lead': 'Sizni hayotimizdagi eng muhim kunni biz bilan birga oʻtkazishga taklif qilamiz',
    'intro.open': 'Taklifnomani ochish',

    'date.addToCalendar': 'Kalendarga qoʻshish',

    'cd.title': 'Toʻygacha qoldi',
    'cd.aria': 'Toʻygacha teskari hisob',
    'cd.days': 'kun',
    'cd.hours': 'soat',
    'cd.minutes': 'daqiqa',
    'cd.seconds': 'soniya',
    'cd.today': 'Bu kun keldi!',

    'hero.eyebrow': 'Toʻyga taklifnoma',

    'invite.p1': 'Hayotimizda alohida kun yaqinlashmoqda — ikki qalb bir boʻladigan kun. Ushbu baxtli lahzalarni eng yaqin va aziz insonlarimiz bilan baham koʻrishdan behad mamnunmiz.',
    'invite.p2': 'Sizning tashrifingiz bayramimizni chinakam unutilmas qiladi.',

    'date.eyebrow': 'Sanani saqlab qoʻying',
    'date.title': 'Qachon',

    'schedule.eyebrow': 'Kun qanday oʻtadi',
    'schedule.title': 'Kun dasturi',
    'schedule.gathering': 'Mehmonlarni kutib olish',
    'schedule.gathering.sub': 'Welcome-zona',
    'schedule.ceremony': 'Nikoh marosimi',
    'schedule.ceremony.sub': 'Eng muhim soʻzlar',
    'schedule.banquet': 'Bazm',
    'schedule.banquet.sub': 'Kechki ovqat, tabriklar va raqslar',
    'schedule.cake': 'Tort kesish',
    'schedule.cake.sub': 'Kelin-kuyov tortni birga kesishadi',
    'schedule.farewell': 'Kechaning yakuni',
    'schedule.farewell.sub': 'Iliq xayrlashuv',

    'venue.eyebrow': 'Sizni kutamiz',
    'venue.title': 'Toʻy manzili',
    'venue.showMap': 'Xaritani koʻrsatish',
    'venue.google': 'Google Maps’da ochish',
    'venue.yandex': 'Yandex Xaritada ochish',

    'contacts.eyebrow': 'Savollar',
    'contacts.title': 'Aloqada boʻlamiz',
    'contacts.sub': 'Savollaringiz boʻlsa, mamnuniyat bilan javob beramiz.',

    'closing.text': 'Uchrashuvni intiqlik bilan kutamiz va sizni eng yaqin insonlar davrasida koʻrishdan baxtiyor boʻlamiz!',
    'closing.sign': 'Hurmat va muhabbat bilan,',

    'nf.title': 'Taklifnoma topilmadi',
    'nf.text': 'Iltimos, shaxsiy xabardagi havolani tekshiring yoki biz bilan bogʻlaning — uni qayta yuboramiz.',

    'footer.made': 'Mehr bilan tayyorlandi',
  },
};

const STORAGE_KEY = 'wedding.lang';
let current = 'ru';
const listeners = new Set();

export function t(key) {
  return STRINGS[current][key] ?? STRINGS.ru[key] ?? key;
}

export function getLang() {
  return current;
}

/** Restores saved language; returns true if the user chose one earlier. */
export function restoreLang() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
  if (saved === 'ru' || saved === 'uz') {
    setLang(saved, { persist: false });
    return true;
  }
  return false;
}

export function setLang(lang, { persist = true } = {}) {
  if (lang !== 'ru' && lang !== 'uz') return;
  current = lang;
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }
  }
  document.documentElement.lang = lang;
  applyDom();
  listeners.forEach((fn) => fn(lang));
}

export function onChange(fn) {
  listeners.add(fn);
}

/** Applies the dictionary to all annotated nodes. */
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

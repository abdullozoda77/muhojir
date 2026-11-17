import { t } from "./i18n.js";

const MSK = "Europe/Moscow";
const YEKT = "Asia/Yekaterinburg";
const DYU = "Asia/Dushanbe";

export const PRAYER_CITIES = {
  "Москва": [55.76, 37.62, MSK],
  "Санкт-Петербург": [59.94, 30.31, MSK],
  "Екатеринбург": [56.84, 60.61, YEKT],
  "Новосибирск": [55.03, 82.92, "Asia/Novosibirsk"],
  "Казань": [55.79, 49.12, MSK],
  "Краснодар": [45.04, 38.98, MSK],
  "Самара": [53.2, 50.15, "Europe/Samara"],
  "Нижний Новгород": [56.33, 44.0, MSK],
  "Ростов-на-Дону": [47.24, 39.71, MSK],
  "Тюмень": [57.15, 65.53, YEKT],
  "Челябинск": [55.16, 61.4, YEKT],
  "Уфа": [54.74, 55.97, YEKT],
  "Красноярск": [56.01, 92.89, "Asia/Krasnoyarsk"],
  "Пермь": [58.01, 56.25, YEKT],
  "Воронеж": [51.67, 39.18, MSK],
  "Волгоград": [48.71, 44.51, "Europe/Volgograd"],
  "Омск": [54.99, 73.37, "Asia/Omsk"],
  "Саратов": [51.53, 46.03, "Europe/Saratov"],
  "Тольятти": [53.51, 49.42, "Europe/Samara"],
  "Иркутск": [52.29, 104.28, "Asia/Irkutsk"],
  "Ярославль": [57.63, 39.87, MSK],
  "Хабаровск": [48.48, 135.08, "Asia/Vladivostok"],
  "Владивосток": [43.12, 131.89, "Asia/Vladivostok"],
  "Оренбург": [51.77, 55.1, YEKT],
  "Томск": [56.48, 84.95, "Asia/Tomsk"],
  "Кемерово": [55.35, 86.09, "Asia/Novokuznetsk"],
  "Новокузнецк": [53.76, 87.12, "Asia/Novokuznetsk"],
  "Рязань": [54.63, 39.74, MSK],
  "Астрахань": [46.35, 48.04, "Europe/Astrakhan"],
  "Пенза": [53.2, 45.0, MSK],
  "Липецк": [52.61, 39.59, MSK],
  "Киров": [58.6, 49.66, "Europe/Kirov"],
  "Тула": [54.19, 37.62, MSK],
  "Калининград": [54.71, 20.51, "Europe/Kaliningrad"],
  "Курск": [51.73, 36.19, MSK],
  "Ставрополь": [45.04, 41.97, MSK],
  "Сочи": [43.6, 39.73, MSK],
  "Тверь": [56.86, 35.9, MSK],
  "Барнаул": [53.35, 83.78, "Asia/Barnaul"],
  "Ульяновск": [54.32, 48.4, "Europe/Ulyanovsk"],
  "Набережные Челны": [55.74, 52.4, MSK],
  "Иваново": [57.0, 40.97, MSK],
  "Брянск": [53.24, 34.36, MSK],
  "Белгород": [50.6, 36.59, MSK],
  "Сургут": [61.25, 73.4, YEKT],
  "Нижневартовск": [60.94, 76.57, YEKT],
  "Новый Уренгой": [66.08, 76.63, YEKT],
  "Якутск": [62.03, 129.73, "Asia/Yakutsk"],
  "Калуга": [54.51, 36.26, MSK],
  "Владимир": [56.13, 40.41, MSK],
  "Смоленск": [54.78, 32.05, MSK],
  "Чебоксары": [56.15, 47.25, MSK],
  "Махачкала": [42.98, 47.5, MSK],
  "Архангельск": [64.54, 40.54, MSK],
  "Мурманск": [68.97, 33.07, MSK],
  "Вологда": [59.22, 39.89, MSK],
  "Череповец": [59.13, 37.9, MSK],
  "Магнитогорск": [53.41, 58.98, YEKT],
  "Подольск": [55.43, 37.54, MSK],
  "Балашиха": [55.8, 37.94, MSK],
  "Химки": [55.89, 37.43, MSK],
  "Мытищи": [55.91, 37.73, MSK],
  "Люберцы": [55.68, 37.89, MSK],
  "Королёв": [55.92, 37.82, MSK],
  "Красногорск": [55.82, 37.33, MSK],
  "Одинцово": [55.68, 37.28, MSK],
  "Домодедово": [55.44, 37.77, MSK],
  "Серпухов": [54.91, 37.41, MSK],
  "Коломна": [55.1, 38.77, MSK],
  "Электросталь": [55.78, 38.45, MSK],
  "Душанбе": [38.56, 68.79, DYU],
  "Хуҷанд": [40.28, 69.62, DYU],
  "Бохтар": [37.84, 68.78, DYU],
  "Кӯлоб": [37.91, 69.78, DYU],
};

export const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export const PRAYER_NAMES = {
  fajr: () => t("Бомдод"),
  sunrise: () => t("Тулӯи офтоб"),
  dhuhr: () => t("Пешин"),
  asr: () => t("Аср"),
  maghrib: () => t("Шом"),
  isha: () => t("Хуфтан"),
};

const FAJR_ANGLE = 16;
const ISHA_ANGLE = 15;
const ASR_SHADOW = 2;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const fix = (a, b) => ((a % b) + b) % b;

function julian(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

function sun(jd) {
  const d = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * d, 360);
  const q = fix(280.459 + 0.98564736 * d, 360);
  const l = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * d;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(l)), Math.cos(rad(l)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(l)))), eqt: q / 15 - ra };
}

export function prayerTimes(day, lat, lng) {
  const jd = julian(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()) - lng / (15 * 24);
  const noon = (t) => fix(12 - sun(jd + t / 24).eqt, 24);
  const angleTime = (angle, t, before) => {
    const { decl } = sun(jd + t / 24);
    const cos = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    const span = deg(Math.acos(cos)) / 15;
    return noon(t) + (before ? -span : span);
  };
  const asrTime = (t) => {
    const { decl } = sun(jd + t / 24);
    const angle = -deg(Math.atan(1 / (ASR_SHADOW + Math.tan(rad(Math.abs(lat - decl))))));
    return angleTime(angle, t);
  };

  let h = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    h = {
      fajr: angleTime(FAJR_ANGLE, h.fajr, true),
      sunrise: angleTime(0.833, h.sunrise, true),
      dhuhr: noon(h.dhuhr) + 2 / 60,
      asr: asrTime(h.asr),
      maghrib: angleTime(0.833, h.maghrib),
      isha: angleTime(ISHA_ANGLE, h.isha),
    };
  }

  if (Number.isFinite(h.sunrise) && Number.isFinite(h.maghrib)) {
    const night = 24 - (h.maghrib - h.sunrise);
    const fajrMax = (FAJR_ANGLE / 60) * night;
    const ishaMax = (ISHA_ANGLE / 60) * night;
    if (!Number.isFinite(h.fajr) || h.sunrise - h.fajr > fajrMax) h.fajr = h.sunrise - fajrMax;
    if (!Number.isFinite(h.isha) || h.isha - h.maghrib > ishaMax) h.isha = h.maghrib + ishaMax;
  }

  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return Object.fromEntries(
    PRAYERS.map((k) => [k, Number.isFinite(h[k]) ? new Date(midnight + (h[k] - lng / 15) * 3600000) : null]),
  );
}

export function localDay(timeZone, offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays));
}

export function clock(time, timeZone) {
  if (!time) return "—";
  return new Intl.DateTimeFormat("ru-RU", { timeZone, hour: "2-digit", minute: "2-digit" }).format(time);
}

export function nextPrayer(place, now = new Date()) {
  const [lat, lng, timeZone] = place;
  for (const offset of [0, 1]) {
    const times = prayerTimes(localDay(timeZone, offset), lat, lng);
    const key = PRAYERS.find((k) => k !== "sunrise" && times[k] && times[k] > now);
    if (key) return { key, time: times[key] };
  }
  return null;
}

const STORE = "muhojir:prayer-city";

export function savedPrayerCity(fallback) {
  let saved = null;
  try {
    saved = localStorage.getItem(STORE);
  } catch {
    saved = null;
  }
  if (saved && PRAYER_CITIES[saved]) return saved;
  return PRAYER_CITIES[fallback] ? fallback : "Москва";
}

export function savePrayerCity(city) {
  try {
    localStorage.setItem(STORE, city);
  } catch {
    return;
  }
}

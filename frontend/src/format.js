import { lang, t } from "./i18n.js";

// 8500 -> "8 500"
export function num(value) {
  if (value === null || value === undefined || value === "") return "";
  return Math.round(Number(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function rub(value) {
  return `${num(value)} ₽`;
}

const PERIOD = { month: "моҳ", day: "рӯз", hour: "соат" };

export function salary(job) {
  const { salary_from: from, salary_to: to } = job;
  if (!from && !to) return t("Маош баъди мусоҳиба");
  const range = from && to ? `${num(from)} – ${num(to)}` : from ? t("аз {0}", num(from)) : t("то {0}", num(to));
  return `${range} ₽ / ${t(PERIOD[job.salary_period] || "моҳ")}`;
}

// "2026-10-28" or an ISO datetime -> "28.10.2026"
export function date(value) {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ago(value) {
  if (!value) return "";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return t("Имрӯз");
  if (days === 1) return t("Дирӯз");
  if (days < 30) return t("{0} рӯз пеш", days);
  return date(value);
}

export function daysText(days) {
  if (days < 0) return t("{0} рӯз пеш гузашт", -days);
  if (days === 0) return t("Имрӯз тамом мешавад");
  return t("{0} рӯз монд", days);
}

// Share of the document's life already used, 0-100 (for progress bars). Without an issue date: unknown.
export function usedPercent(doc) {
  if (!doc.issued_at) return null;
  const start = new Date(`${doc.issued_at}T00:00:00`).getTime();
  const end = new Date(`${doc.expires_at}T00:00:00`).getTime();
  const pct = ((Date.now() - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

const MONTHS_TG = ["Январ", "Феврал", "Март", "Апрел", "Май", "Июн", "Июл", "Август", "Сентябр", "Октябр", "Ноябр", "Декабр"];

// "2026-10" -> "Октябр 2026" (Tajik month names are not built into browsers, so they are listed here).
export function monthTitle(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (lang === "ru") return new Date(y, m - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return `${MONTHS_TG[m - 1]} ${y}`;
}

const WEEKDAYS_TG = ["Якшанбе", "Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе"];

// "Панҷшанбе, 1 октябр" — today's date for the greeting banner.
export function todayTitle(now = new Date()) {
  if (lang === "ru") return now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return `${WEEKDAYS_TG[now.getDay()]}, ${now.getDate()} ${MONTHS_TG[now.getMonth()].toLowerCase()}`;
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Moon, Sun, Sunrise, Sunset, CloudSun, MoonStar } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { t, useLang } from "../i18n.js";
import { PRAYERS, PRAYER_CITIES, PRAYER_NAMES, clock, localDay, nextPrayer, prayerTimes, savePrayerCity, savedPrayerCity } from "../prayer.js";
import { PageHeader } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

const WEEKDAYS_TG = ["Якш", "Дшб", "Сшб", "Чшб", "Пшб", "Ҷумъа", "Шнб"];
const WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const ICONS = { fajr: MoonStar, sunrise: Sunrise, dhuhr: Sun, asr: CloudSun, maghrib: Sunset, isha: Moon };

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function left(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? t("{0} соату {1} дақиқа", h, m) : t("{0} дақиқа", m);
}

export default function Prayer() {
  const { user } = useAuth();
  const lang = useLang();
  const [city, setCity] = useState(() => savedPrayerCity(user?.city));
  const now = useNow();
  const place = PRAYER_CITIES[city];
  const [lat, lng, timeZone] = place;
  const day = localDay(timeZone);
  const today = useMemo(() => prayerTimes(day, lat, lng), [day.getTime(), lat, lng]);
  const next = nextPrayer(place, now);
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = localDay(timeZone, i);
      return { day: d, times: prayerTimes(d, lat, lng) };
    }),
    [day.getTime(), lat, lng, timeZone],
  );
  const weekday = (d) => {
    const short = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return `${lang === "ru" ? WEEKDAYS_RU[d.getUTCDay()] : WEEKDAYS_TG[d.getUTCDay()]}, ${short}`;
  };

  const choose = (value) => {
    setCity(value);
    savePrayerCity(value);
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Дин")} title={t("Вақти намоз")} text={t("Вақтҳои намоз барои шаҳри шумо дар Русия ва Тоҷикистон, бо вақти маҳаллӣ.")} icon={MoonStar} />

      <Reveal>
        <section className="card flex flex-col gap-6 p-5 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <label className="flex max-w-xs flex-1 flex-col gap-1.5">
              <span className="label">{t("Шаҳр")}</span>
              <span className="relative block">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant" aria-hidden />
                <select className="input pl-11" value={city} onChange={(e) => choose(e.target.value)}>
                  {Object.keys(PRAYER_CITIES).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </span>
            </label>
            {next && (
              <div className="flex flex-col md:items-end">
                <span className="text-label-md text-on-surface-variant">{t("Намози навбатӣ")}</span>
                <span className="font-display text-[32px] font-semibold leading-tight md:text-[40px]">
                  {PRAYER_NAMES[next.key]()} · {clock(next.time, timeZone)}
                </span>
                <span className="text-body-sm text-primary">{t("баъд аз {0}", left(next.time - now))}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PRAYERS.map((k) => {
              const Icon = ICONS[k];
              const active = next?.key === k && next.time.getTime() === today[k]?.getTime();
              return (
                <div key={k} className={`flex flex-col gap-2 rounded-xl p-4 ring-1 ring-inset ${active ? "bg-ink text-on-ink ring-ink" : "ring-outline-variant"} ${k === "sunrise" && !active ? "opacity-70" : ""}`}>
                  <Icon className={`h-5 w-5 ${active ? "" : "text-primary"}`} aria-hidden />
                  <span className={`text-label-md ${active ? "" : "text-on-surface-variant"}`}>{PRAYER_NAMES[k]()}</span>
                  <span className="text-[24px] font-semibold tabular-nums leading-none">{clock(today[k], timeZone)}</span>
                </div>
              );
            })}
          </div>
          {PRAYERS.some((k) => !today[k]) && (
            <p className="text-body-sm text-on-surface-variant">{t("Дар ин шаҳр ҳоло шаби қутбӣ ё рӯзи қутбӣ аст — баъзе вақтҳоро аз масҷиди наздик пурсед.")}</p>
          )}
        </section>
      </Reveal>

      <Reveal>
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 text-[18px] font-semibold md:px-8 md:pt-6">{t("Ҳафтаи оянда")}</h2>
          <div className="no-scrollbar overflow-x-auto px-2 pb-3 md:px-5">
            <table className="w-full min-w-[560px] text-body-md">
              <thead>
                <tr className="text-left text-label-md text-on-surface-variant">
                  <th className="px-3 py-3 font-medium">{t("Рӯз")}</th>
                  {PRAYERS.map((k) => <th key={k} className="px-3 py-3 font-medium">{PRAYER_NAMES[k]()}</th>)}
                </tr>
              </thead>
              <tbody>
                {week.map(({ day: d, times }, i) => (
                  <tr key={d.getTime()} className={`border-t border-outline-variant ${i === 0 ? "font-semibold" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2.5">{i === 0 ? t("Имрӯз") : weekday(d)}</td>
                    {PRAYERS.map((k) => <td key={k} className={`px-3 py-2.5 tabular-nums ${k === "sunrise" ? "text-on-surface-variant" : ""}`}>{clock(times[k], timeZone)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-body-sm text-on-surface-variant">
            {t("Ҳисоб: Бомдод 16°, Хуфтан 15°, Аср аз рӯи мазҳаби ҳанафӣ — мисли Идораи рӯҳонии мусулмонони Русия. Вақт метавонад аз ҷадвали масҷиди шумо 1–3 дақиқа фарқ кунад.")}
          </p>
          <Link to="/places?category=mosque" className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            <Moon className="h-4 w-4" aria-hidden />
            {t("Масҷидҳои наздик")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

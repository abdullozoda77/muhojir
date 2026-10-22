import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, BellPlus, BookOpen, CalendarDays, Check, ExternalLink, Info, Plane, PlaneLanding, PlaneTakeoff, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { lang, t } from "../i18n.js";
import { monthTitle, num, rub } from "../format.js";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

// Air tickets between Tajikistan and Russia, both ways. Prices come from Aviasales (the cheapest found in the last
// days); the ticket is bought on aviasales.ru. Logged-in visitors can ask to be told when a route gets cheaper.

const cityName = (a) => (lang === "ru" ? a.city : a.city_tg || a.city);

// The next 12 months as "2026-11".
function nextMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

// Choices for one side: a city with several airports also gets "all airports" (its city code, e.g. MOW).
function places(airports) {
  const out = [];
  const seen = new Set();
  for (const a of airports) {
    const several = airports.filter((x) => x.city_code === a.city_code).length > 1;
    if (several && !seen.has(a.city_code)) {
      seen.add(a.city_code);
      out.push({ value: a.city_code, label: `${cityName(a)} — ${t("ҳамаи фурудгоҳҳо")} (${a.city_code})` });
    }
    out.push({ value: a.code, label: several ? `${cityName(a)}, ${a.name} (${a.code})` : `${cityName(a)} (${a.code})` });
  }
  return out;
}

function time(iso) {
  return iso ? iso.slice(11, 16) : "";
}

// "2026-11-05" -> "5 нояб., чт" in Russian; "05.11" in Tajik (browsers have no Tajik month names).
function dayLabel(day) {
  const d = new Date(`${day}T00:00:00`);
  if (lang === "ru") return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" });
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function duration(minutes) {
  if (!minutes) return null;
  return t("{0} соат {1} дақ.", Math.floor(minutes / 60), minutes % 60);
}

// Days of the month with the cheapest price of each; the cheapest day is marked.
function Calendar({ calendar }) {
  const days = Object.entries(calendar);
  if (!days.length) return null;
  const min = Math.min(...days.map(([, p]) => p));
  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="flex items-center gap-3 text-[20px] leading-tight font-display font-extrabold text-navy dark:text-on-surface">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        {t("Нархҳо аз рӯи рӯз")}
      </h2>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map(([day, price]) => (
          <div key={day} className={`flex min-w-[96px] shrink-0 flex-col items-center gap-1 rounded-[20px] px-3 py-3 text-center ${price === min ? "bg-tertiary-fixed text-on-tertiary-fixed ring-2 ring-tertiary" : "bg-surface-container-low ring-1 ring-inset ring-outline-variant/40"}`}>
            <span className="text-label-sm text-on-surface-variant">{dayLabel(day)}</span>
            <span className="font-display text-[16px] font-extrabold">{num(price)} ₽</span>
            {price === min && <span className="text-label-sm">{t("Арзонтарин")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketRow({ ticket }) {
  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white dark:bg-primary dark:text-on-primary">
          <Plane className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[17px] font-bold">
            {ticket.origin_airport} → {ticket.destination_airport} · {dayLabel(ticket.departure_at.slice(0, 10))}, {time(ticket.departure_at)}
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {[ticket.airline_name, ticket.flight_number && `${ticket.airline}-${ticket.flight_number}`, duration(ticket.duration)].filter(Boolean).join(" · ")}
          </span>
          <span className={`text-label-md ${ticket.transfers ? "text-warning" : "text-tertiary"}`}>
            {ticket.transfers ? t("{0} пайвастшавӣ", ticket.transfers) : t("Бе пайвастшавӣ")}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 md:justify-end">
        <span className="font-display text-[24px] font-extrabold text-navy dark:text-on-surface">{rub(ticket.price)}</span>
        {ticket.link && (
          <a href={ticket.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-secondary px-5 text-label-md text-on-secondary shadow-[0_8px_20px_-8px_rgb(var(--c-secondary)/0.8)] hover:bg-secondary-container">
            {t("Харидан")}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

// "Tell me when it is cheaper than ...": saved for the chosen route and month; checked every morning.
function PriceAlert({ origin, destination, month, cheapest }) {
  const { user } = useAuth();
  const { data: watches, reload } = useApi(user ? "/flights/watches/" : null);
  const [price, setPrice] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);
  useEffect(() => {
    setPrice(cheapest ? String(Math.round((cheapest * 0.9) / 100) * 100) : "");
    setState("idle");
  }, [origin, destination, month, cheapest]);

  if (!user) {
    return (
      <div className="card flex flex-col gap-4 p-6">
        <h2 className="flex items-center gap-3 text-[20px] leading-tight font-display font-extrabold text-navy dark:text-on-surface">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
            <BellPlus className="h-5 w-5" aria-hidden />
          </span>
          {t("Огоҳӣ дар бораи чиптаи арзон")}
        </h2>
        <p className="text-body-sm text-on-surface-variant">{t("Ворид шавед, то вақте нарх арзон мешавад, ба шумо хабар диҳем.")}</p>
        <Link to="/login" className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-navy px-5 text-label-md text-white hover:brightness-125 dark:bg-primary dark:text-on-primary">{t("Ворид шудан")}</Link>
      </div>
    );
  }

  const save = async () => {
    setState("busy");
    setError(null);
    try {
      await api("/flights/watches/", { method: "POST", body: { origin, destination, month, max_price: Number(price) } });
      setState("done");
      reload();
    } catch (err) {
      setError(err);
      setState("idle");
    }
  };
  const remove = async (id) => {
    await api(`/flights/watches/${id}/`, { method: "DELETE" }).catch(() => {});
    reload();
  };

  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="flex items-center gap-3 text-[20px] leading-tight font-display font-extrabold text-navy dark:text-on-surface">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
          <BellPlus className="h-5 w-5" aria-hidden />
        </span>
        {t("Огоҳӣ дар бораи чиптаи арзон")}
      </h2>
      {origin && destination && month ? (
        <>
          <p className="text-body-sm text-on-surface-variant">
            {t("Ҳар саҳар нархро месанҷем ва агар чиптаи {0} → {1} дар {2} аз нархи шумо арзон шавад, хабар медиҳем.", origin, destination, monthTitle(month))}
          </p>
          <div className="flex gap-2">
            <input className="input" type="number" min="1000" step="100" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("Нархи ҳадди аксар, ₽")} aria-label={t("Нархи ҳадди аксар, ₽")} />
            {state === "done" ? (
              <span className="inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-full bg-tertiary-fixed px-5 text-label-md text-on-tertiary-fixed">
                <Check className="h-4 w-4" aria-hidden />
                {t("Сабт шуд")}
              </span>
            ) : (
              <Button onClick={save} loading={state === "busy"} disabled={!price} className="shrink-0">
                {t("Огоҳ кунед")}
              </Button>
            )}
          </div>
          <ErrorBox error={error} />
        </>
      ) : (
        <p className="text-body-sm text-on-surface-variant">{t("Аввал роҳ ва моҳро интихоб кунед.")}</p>
      )}
      {watches?.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface-variant">{t("Огоҳиҳои ман")}</span>
          {watches.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 rounded-[18px] bg-surface-container-low py-2 pl-4 pr-2">
              <span className="text-body-sm">
                <strong>{w.origin} → {w.destination}</strong> · {monthTitle(w.month)} · {t("то {0}", rub(w.max_price))}
                {!w.is_active && ` · ${t("тамом шуд")}`}
              </span>
              <button type="button" onClick={() => remove(w.id)} aria-label={t("Нест кардан")} className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-error">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TravelTips() {
  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-[28px] bg-navy p-6 text-white shadow-[0_18px_36px_-18px_rgb(16_38_92/0.8)]">
      <div aria-hidden className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
      <div className="flag-line absolute inset-x-0 bottom-0 h-[5px]" />
      <h2 className="relative flex items-center gap-3 font-display text-[20px] font-extrabold">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
          <Info className="h-5 w-5" aria-hidden />
        </span>
        {t("Пеш аз сафар")}
      </h2>
      {[
        t("Шиносномаи хориҷӣ бояд ҳадди ақал то охири сафар эътибор дошта бошад."),
        t("Дар ҳавопаймо ё дар сарҳад корти муҳоҷиратиро пур кунед: мақсади сафар — «работа»."),
        t("Дар Русия дар давоми 15 рӯз бақайдгирӣ (регистрация) кунед, барои патент — 30 рӯз."),
        t("Нархҳо тахминӣ ҳастанд ва зуд иваз мешаванд — нархи дақиқ дар сайти фурӯш."),
      ].map((text, i) => (
        <div key={text} className="relative flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-label-sm font-bold text-navy">{i + 1}</span>
          <p className="text-body-sm text-white/80">{text}</p>
        </div>
      ))}
      <Link to="/guides" className="relative mb-1 inline-flex min-h-[44px] items-center gap-2 self-start rounded-full bg-white px-5 text-label-md text-navy hover:bg-white/90">
        <BookOpen className="h-4 w-4" aria-hidden />
        {t("Роҳнамои ҳуҷҷатҳо")}
      </Link>
    </div>
  );
}

export default function Tickets() {
  const [params, setParams] = useSearchParams();
  const { data: airports, error: airportsError } = useApi("/flights/airports/");
  const months = useMemo(nextMonths, []);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tj = useMemo(() => (airports || []).filter((a) => a.country === "TJ"), [airports]);
  const ru = useMemo(() => (airports || []).filter((a) => a.country === "RU"), [airports]);
  const tjCodes = useMemo(() => new Set(tj.flatMap((a) => [a.code, a.city_code])), [tj]);

  const from = params.get("from") || "DYU";
  const to = params.get("to") || "MOW";
  const month = params.get("month") || months[0];
  const direct = params.get("direct") === "true";
  const toRussia = !airports || tjCodes.has(from);

  const set = (changes) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  const swap = () => set({ from: to, to: from });
  const setDirection = (wantToRussia) => {
    if (wantToRussia !== toRussia) swap();
  };

  useEffect(() => {
    if (!airports) return;
    let alive = true;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ origin: from, destination: to, month });
    if (direct) q.set("direct", "true");
    api(`/flights/prices/?${q}`)
      .then((data) => alive && setResult(data))
      .catch((err) => alive && (setError(err), setResult(null)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [airports, from, to, month, direct]);

  const fromOptions = places(toRussia ? tj : ru);
  const toOptions = places(toRussia ? ru : tj);
  const cheapest = result?.results?.length ? Math.min(...result.results.map((r) => r.price)) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Тоҷикистон ⇄ Русия")} icon={Plane} title={t("Чиптаҳои ҳавопаймо")} text={t("Арзонтарин чиптаҳо байни шаҳрҳои Тоҷикистон ва Русия — ба ҳар ду тараф.")} />

      <div className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="inline-flex self-start rounded-full bg-surface-container-low p-1 ring-1 ring-outline-variant/60" role="group" aria-label={t("Самт")}>
          {[
            [true, PlaneTakeoff, t("Ба Русия")],
            [false, PlaneLanding, t("Ба Тоҷикистон")],
          ].map(([value, Icon, label]) => (
            <button key={label} type="button" onClick={() => setDirection(value)} aria-pressed={toRussia === value} className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 text-label-md transition-colors ${toRussia === value ? "bg-navy text-white dark:bg-primary dark:text-on-primary" : "text-on-surface-variant"}`}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_1fr]">
          <label>
            <span className="label">{t("Аз куҷо")}</span>
            <select className="input" value={from} onChange={(e) => set({ from: e.target.value })}>
              {fromOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={swap} aria-label={t("Ҷойҳоро иваз кардан")} className="flex h-[52px] w-[52px] items-center justify-center self-end rounded-full bg-navy text-white transition-transform hover:rotate-180 dark:bg-primary dark:text-on-primary">
            <ArrowLeftRight className="h-5 w-5" aria-hidden />
          </button>
          <label>
            <span className="label">{t("Ба куҷо")}</span>
            <select className="input" value={to} onChange={(e) => set({ to: e.target.value })}>
              {toOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">{t("Моҳ")}</span>
            <select className="input" value={month} onChange={(e) => set({ month: e.target.value })}>
              {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
            </select>
          </label>
        </div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-2.5 self-start rounded-full bg-surface-container-low px-4 ring-1 ring-inset ring-outline-variant/40">
          <input type="checkbox" className="h-5 w-5 rounded text-primary focus:ring-primary" checked={direct} onChange={(e) => set({ direct: e.target.checked ? "true" : "" })} />
          <span className="text-label-md">{t("Танҳо парвози бе пайвастшавӣ")}</span>
        </label>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <ErrorBox error={airportsError || error} />
          {loading || !airports ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-40" />)
          ) : result && !result.enabled ? (
            <EmptyState icon={Plane} title={t("Нархҳоро дар Aviasales бинед")} text={t("Нархҳои зинда дар ин сайт ҳоло танзим нашудаанд. Тугмаро пахш кунед — ҷустуҷӯи ҳамин роҳ дар Aviasales кушода мешавад.")}>
              <a href={result.search_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-secondary px-6 text-label-lg text-on-secondary">
                {t("Ҷустуҷӯ дар Aviasales")}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </EmptyState>
          ) : result && result.results.length === 0 ? (
            <EmptyState icon={Plane} title={t("Барои ин моҳ нарх ёфт нашуд")} text={t("Моҳи дигар ё фурудгоҳи дигарро интихоб кунед, ё дар Aviasales бинед.")}>
              <a href={result.search_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-navy px-6 text-label-lg text-white dark:bg-primary dark:text-on-primary">
                {t("Ҷустуҷӯ дар Aviasales")}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </EmptyState>
          ) : result ? (
            <>
              <Calendar calendar={result.calendar} />
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[22px] font-display font-extrabold text-navy dark:text-on-surface">{t("Арзонтарин чиптаҳо")}</h2>
                <a href={result.search_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-md text-primary">
                  {t("Ҳама дар Aviasales")}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <Stagger key={`${from}${to}${month}${direct}`} className="flex flex-col divide-y divide-outline-variant/50 rounded-[32px] bg-surface-container-lowest p-1 ring-1 ring-outline-variant/60">
                {result.results.map((ticket, i) => (
                  <StaggerItem key={`${ticket.departure_at}-${ticket.price}-${i}`}>
                    <TicketRow ticket={ticket} />
                  </StaggerItem>
                ))}
              </Stagger>
              <p className="px-1 text-body-sm text-on-surface-variant">{t("Нархҳо аз Aviasales: арзонтарин чиптаҳое, ки дар рӯзҳои охир ёфт шудаанд. Нархи дақиқ ҳангоми харид маълум мешавад.")}</p>
            </>
          ) : null}
        </div>
        <aside className="grid gap-4 md:grid-cols-2 xl:col-span-4 xl:flex xl:flex-col">
          <PriceAlert origin={from} destination={to} month={month} cheapest={cheapest} />
          <TravelTips />
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, BellPlus, BookOpen, CalendarDays, Check, ChevronDown, ExternalLink, Info, Minus, Plane, PlaneLanding, PlaneTakeoff, Plus, SlidersHorizontal, Trash2, Users, X } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { lang, t } from "../i18n.js";
import { monthTitle, num, rub } from "../format.js";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

const cityName = (a) => (lang === "ru" ? a.city : a.city_tg || a.city);

function nextMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

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

const WEEKDAYS = { tg: ["Якш", "Душ", "Сеш", "Чор", "Пан", "Ҷум", "Шан"], ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] };

function dayLabel(day, withWeekday = false) {
  const d = new Date(`${day}T00:00:00`);
  const text = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return withWeekday ? `${text}, ${weekday(day)}` : text;
}

function weekday(day) {
  return WEEKDAYS[lang === "ru" ? "ru" : "tg"][new Date(`${day}T00:00:00`).getDay()];
}

function monthDays(month) {
  const [y, m] = month.split("-").map(Number);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter((d) => d >= today);
}

function paxCode({ adults, children, infants }) {
  return `${adults}${children || infants ? children : ""}${infants ? infants : ""}`;
}

function aviasalesDay(origin, destination, day, pax) {
  return `https://www.aviasales.ru/search/${origin}${day.slice(8, 10)}${day.slice(5, 7)}${destination}${paxCode(pax)}`;
}

function withPax(url, pax) {
  return url ? url.replace(/(\/search\/[A-Z]{3}\d{4}[A-Z]{3})\d{1,3}/, `$1${paxCode(pax)}`) : url;
}

function totalPrice(price, { adults, children, infants }) {
  return price * (adults + children) + Math.round(price * 0.1) * infants;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const TIMES = [
  ["night", 0, 5, () => t("Шаб"), "00–05"],
  ["morning", 5, 12, () => t("Саҳар"), "05–12"],
  ["day", 12, 18, () => t("Рӯз"), "12–18"],
  ["evening", 18, 24, () => t("Бегоҳ"), "18–24"],
];
const SORTS = [
  ["price", () => t("Арзонтарин")],
  ["early", () => t("Барвақттарин")],
  ["fast", () => t("Тезтарин")],
];

function hourOf(ticket) {
  return Number(ticket.departure_at.slice(11, 13));
}

function weekdayOf(ticket) {
  return new Date(`${ticket.departure_at.slice(0, 10)}T00:00:00`).getDay();
}

function list(value) {
  return value ? value.split(",").filter(Boolean) : [];
}

function toggle(values, value) {
  return (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]).join(",");
}

function duration(minutes) {
  if (!minutes) return null;
  return t("{0} соат {1} дақ.", Math.floor(minutes / 60), minutes % 60);
}

function Calendar({ calendar, month, day, onPick, weekdays }) {
  const days = monthDays(month);
  const prices = Object.values(calendar);
  if (!days.length) return null;
  const min = prices.length ? Math.min(...prices) : null;
  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="flex items-center gap-3 text-[17px] font-semibold leading-tight">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex-1">{t("Рӯзро интихоб кунед")}</span>
        {day && (
          <button type="button" onClick={() => onPick("")} className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-label-md text-primary ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            {t("Ҳамаи рӯзҳо")}
          </button>
        )}
      </h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((d) => {
          const price = calendar[d];
          const picked = d === day;
          const cheapest = price != null && price === min;
          const off = weekdays.length > 0 && !weekdays.includes(String(new Date(`${d}T00:00:00`).getDay()));
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(picked ? "" : d)}
              aria-pressed={picked}
              disabled={off}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 text-center ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                picked ? "bg-ink text-on-ink ring-ink" : cheapest ? "bg-tertiary-fixed text-on-tertiary-fixed ring-tertiary hover:brightness-105" : "ring-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <span className={`text-label-sm ${picked ? "text-on-ink/80" : "text-on-surface-variant"}`}>{weekday(d)}</span>
              <span className="text-[15px] font-semibold tabular-nums">{Number(d.slice(8))}</span>
              <span className={`text-label-sm tabular-nums ${price == null && !picked ? "text-outline" : ""}`}>{price == null ? "—" : num(price)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-body-sm text-on-surface-variant">{t("Нарх — арзонтарин чипта дар ҳамон рӯз (бо филтрҳо), барои як нафар, ₽. «—» — нарх ҳоло маълум нест.")}</p>
    </div>
  );
}

function TicketRow({ ticket, pax }) {
  const people = pax.adults + pax.children + pax.infants;
  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
          <Plane className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold">
            {ticket.origin_airport} → {ticket.destination_airport} · {dayLabel(ticket.departure_at.slice(0, 10), true)}, {time(ticket.departure_at)}
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
        <span className="flex flex-col items-start md:items-end">
          <span className="text-[22px] font-semibold tracking-tight tabular-nums">{rub(ticket.price)}</span>
          {people > 1 && <span className="text-body-sm tabular-nums text-on-surface-variant">{t("≈ {0} барои {1} нафар", rub(totalPrice(ticket.price, pax)), people)}</span>}
        </span>
        {ticket.link && (
          <a href={withPax(ticket.link, pax)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90">
            {t("Харидан")}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

const PAX_ROWS = [
  ["adults", () => t("Калонсолон"), () => t("аз 12 сола"), 1],
  ["children", () => t("Кӯдакон"), () => t("2–11 сола"), 0],
  ["infants", () => t("Тифлон"), () => t("то 2 сола, бе ҷой"), 0],
];

function Passengers({ pax, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const people = pax.adults + pax.children + pax.infants;
  const can = (key, step) => {
    const next = { ...pax, [key]: pax[key] + step };
    return next[key] >= (key === "adults" ? 1 : 0) && next.adults + next.children + next.infants <= 9 && next.infants <= next.adults;
  };
  return (
    <div ref={box} className="relative">
      <span className="label">{t("Мусофирон")}</span>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="input flex items-center gap-2 text-left">
        <Users className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
        <span className="flex-1 truncate">{t("{0} нафар", people)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 flex w-72 flex-col gap-1 rounded-2xl bg-surface-container-lowest p-3 shadow-xl ring-1 ring-outline-variant">
          {PAX_ROWS.map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{label()}</span>
                <span className="text-body-sm text-on-surface-variant">{hint()}</span>
              </span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => onChange({ ...pax, [key]: pax[key] - 1 })} disabled={!can(key, -1)} aria-label={t("Кам кардан")} className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low disabled:opacity-35">
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-5 text-center text-[15px] font-semibold tabular-nums">{pax[key]}</span>
                <button type="button" onClick={() => onChange({ ...pax, [key]: pax[key] + 1 })} disabled={!can(key, 1)} aria-label={t("Зиёд кардан")} className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low disabled:opacity-35">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </span>
            </div>
          ))}
          <p className="px-2 pt-1 text-body-sm text-on-surface-variant">{t("Нархҳо барои як нафар; ҳамаи мусофирон дар сайти Aviasales ҳисоб мешаванд.")}</p>
          <button type="button" onClick={() => setOpen(false)} className="mt-1 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-ink px-4 text-label-md text-on-ink hover:bg-ink/90">
            {t("Тайёр")}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md ring-1 ring-inset transition-colors ${
        active ? "bg-ink text-on-ink ring-ink" : "text-on-surface-variant ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Filters({ f, set, airlines, priceRange, active, onReset }) {
  const [lo, hi] = priceRange;
  return (
    <div className="card flex flex-col gap-5 p-5 md:p-6">
      <h2 className="flex items-center gap-3 text-[17px] font-semibold leading-tight">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex-1">{t("Филтрҳо")}</span>
        {active > 0 && (
          <button type="button" onClick={onReset} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-label-md text-primary ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            <X className="h-4 w-4" aria-hidden />
            {t("Тоза кардан ({0})", active)}
          </button>
        )}
      </h2>

      <div className="grid gap-5 md:grid-cols-2">
        <FilterRow label={t("Пайвастшавӣ")}>
          {[
            ["", t("Ҳама")],
            ["0", t("Бе пайвастшавӣ")],
            ["1", t("То 1 пайвастшавӣ")],
          ].map(([value, label]) => (
            <FilterChip key={value} active={f.stops === value} onClick={() => set({ stops: value, direct: "" })}>
              {label}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label={t("Тартиб")}>
          {SORTS.map(([value, label]) => (
            <FilterChip key={value} active={f.sort === value} onClick={() => set({ sort: value === "price" ? "" : value })}>
              {label()}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label={t("Рӯзҳои ҳафта")}>
          {WEEK.map((d) => (
            <FilterChip key={d} active={f.weekdays.includes(String(d))} onClick={() => set({ wd: toggle(f.weekdays, String(d)), day: "" })}>
              {WEEKDAYS[lang === "ru" ? "ru" : "tg"][d]}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label={t("Вақти парвоз")}>
          {TIMES.map(([value, , , label, hours]) => (
            <FilterChip key={value} active={f.times.includes(value)} onClick={() => set({ time: toggle(f.times, value) })}>
              {label()} <span className="tabular-nums opacity-70">{hours}</span>
            </FilterChip>
          ))}
        </FilterRow>

        {airlines.length > 1 && (
          <FilterRow label={t("Ширкати ҳавопаймоӣ")}>
            {airlines.map(([code, name]) => (
              <FilterChip key={code} active={f.airlines.includes(code)} onClick={() => set({ airline: toggle(f.airlines, code) })}>
                {name}
              </FilterChip>
            ))}
          </FilterRow>
        )}

        {hi > lo && (
          <div className="flex flex-col gap-2">
            <span className="flex items-center justify-between text-label-md text-on-surface-variant">
              {t("Нархи ҳадди аксар")}
              <span className="tabular-nums text-on-surface">{f.max && f.max < hi ? rub(f.max) : t("ҳама")}</span>
            </span>
            <input
              type="range"
              min={lo}
              max={hi}
              step={100}
              value={f.max && f.max < hi ? Math.max(f.max, lo) : hi}
              onChange={(e) => set({ max: Number(e.target.value) >= hi ? "" : e.target.value })}
              aria-label={t("Нархи ҳадди аксар")}
              className="h-9 w-full cursor-pointer accent-primary"
            />
            <span className="flex justify-between text-body-sm tabular-nums text-on-surface-variant">
              <span>{rub(lo)}</span>
              <span>{rub(hi)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

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
        <h2 className="flex items-center gap-3 text-[17px] font-semibold leading-tight">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
            <BellPlus className="h-5 w-5" aria-hidden />
          </span>
          {t("Огоҳӣ дар бораи чиптаи арзон")}
        </h2>
        <p className="text-body-sm text-on-surface-variant">{t("Ворид шавед, то вақте нарх арзон мешавад, ба шумо хабар диҳем.")}</p>
        <Link to="/login" className="inline-flex min-h-[44px] items-center justify-center self-start rounded-xl bg-ink px-5 text-label-md text-on-ink hover:bg-ink/90">{t("Ворид шудан")}</Link>
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
      <h2 className="flex items-center gap-3 text-[17px] font-semibold leading-tight">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
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
              <span className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-tertiary-fixed px-4 text-label-md text-on-tertiary-fixed">
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
            <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl py-1.5 pl-4 pr-1.5 ring-1 ring-inset ring-outline-variant">
              <span className="text-body-sm">
                <strong>{w.origin} → {w.destination}</strong> · {monthTitle(w.month)} · {t("то {0}", rub(w.max_price))}
                {!w.is_active && ` · ${t("тамом шуд")}`}
              </span>
              <button type="button" onClick={() => remove(w.id)} aria-label={t("Нест кардан")} className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AIRLINES = [
  { name: "Somon Air", url: "https://somonair.com/ru/booking", text: () => t("Ширкати ҳавопаймоии тоҷикӣ") },
  { name: "Tajik Air", url: "https://www.tajikair.tj/", text: () => t("Ширкати ҳавопаймоии давлатӣ") },
];

function AirlineLinks({ searchUrl }) {
  const links = [...AIRLINES, ...(searchUrl ? [{ name: "Aviasales", url: searchUrl, text: () => t("Ҳамаи ширкатҳо дар як ҷо") }] : [])];
  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="flex items-center gap-3 text-[17px] font-semibold leading-tight">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
          <Plane className="h-5 w-5" aria-hidden />
        </span>
        {t("Харид аз ширкатҳои ҳавопаймоӣ")}
      </h2>
      <div className="flex flex-col gap-2">
        {links.map((a) => (
          <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold">{a.name}</span>
              <span className="text-body-sm text-on-surface-variant">{a.text()}</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-outline transition-colors group-hover:text-on-surface" aria-hidden />
          </a>
        ))}
      </div>
      <p className="text-body-sm text-on-surface-variant">{t("Роҳ ва санаро дар сайти ширкат интихоб кунед — нархи дақиқ ҳамон ҷост.")}</p>
    </div>
  );
}

function TravelTips() {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="flex items-center gap-3 text-[17px] font-semibold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
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
        <div key={text} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-outline">{i + 1}</span>
          <p className="text-body-sm text-on-surface-variant">{text}</p>
        </div>
      ))}
      <Link to="/guides" className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
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
  const stops = params.get("stops") ?? (params.get("direct") === "true" ? "0" : "");
  const direct = stops === "0";
  const day = (params.get("day") || "").startsWith(month) ? params.get("day") : "";
  const count = (key, min, fallback) => Math.min(9, Math.max(min, Number(params.get(key)) || fallback));
  const adults = count("adults", 1, 1);
  const children = Math.min(count("children", 0, 0), 9 - adults);
  const pax = { adults, children, infants: Math.min(count("infants", 0, 0), adults, 9 - adults - children) };
  const f = {
    stops,
    weekdays: list(params.get("wd")),
    times: list(params.get("time")),
    airlines: list(params.get("airline")),
    max: Number(params.get("max")) || 0,
    sort: params.get("sort") || "price",
  };
  const [limit, setLimit] = useState(30);
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
  const swap = () => set({ from: to, to: from, day: "", airline: "", max: "" });
  const setPax = (next) => set({ adults: next.adults > 1 ? next.adults : "", children: next.children || "", infants: next.infants || "" });
  const resetFilters = () => set({ stops: "", direct: "", wd: "", time: "", airline: "", max: "", sort: "", day: "" });
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
  const all = result?.results || [];

  const airlines = useMemo(() => [...new Map(all.map((r) => [r.airline, r.airline_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [all]);
  const priceRange = all.length ? [Math.floor(Math.min(...all.map((r) => r.price)) / 100) * 100, Math.ceil(Math.max(...all.map((r) => r.price)) / 100) * 100] : [0, 0];

  const fitting = all.filter(
    (r) =>
      (f.stops !== "1" || r.transfers <= 1) &&
      (!f.times.length || TIMES.some(([key, from_, to_]) => f.times.includes(key) && hourOf(r) >= from_ && hourOf(r) < to_)) &&
      (!f.airlines.length || f.airlines.includes(r.airline)) &&
      (!f.max || r.price <= f.max),
  );
  const calendar = {};
  for (const r of fitting) {
    const d = r.departure_at.slice(0, 10);
    if (calendar[d] == null || r.price < calendar[d]) calendar[d] = r.price;
  }
  const order = {
    price: (a, b) => a.price - b.price,
    early: (a, b) => a.departure_at.localeCompare(b.departure_at),
    fast: (a, b) => (a.duration || 1e9) - (b.duration || 1e9) || a.price - b.price,
  };
  const matching = fitting
    .filter((r) => (day ? r.departure_at.startsWith(day) : !f.weekdays.length || f.weekdays.includes(String(weekdayOf(r)))))
    .sort(day && f.sort === "price" ? order.early : order[f.sort] || order.price);
  const shown = matching.slice(0, limit);
  const activeFilters = [f.stops, f.weekdays.length, f.times.length, f.airlines.length, f.max, f.sort !== "price"].filter(Boolean).length;
  useEffect(() => setLimit(30), [from, to, month, day, params]);
  const searchUrl = result && day ? aviasalesDay(from, to, day, pax) : withPax(result?.search_url, pax);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Тоҷикистон ⇄ Русия")} icon={Plane} title={t("Чиптаҳои ҳавопаймо")} text={t("Арзонтарин чиптаҳо байни шаҳрҳои Тоҷикистон ва Русия — ба ҳар ду тараф.")} />

      <div className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="inline-flex self-start rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant" role="group" aria-label={t("Самт")}>
          {[
            [true, PlaneTakeoff, t("Ба Русия")],
            [false, PlaneLanding, t("Ба Тоҷикистон")],
          ].map(([value, Icon, label]) => (
            <button key={label} type="button" onClick={() => setDirection(value)} aria-pressed={toRussia === value} className={`flex min-h-[38px] items-center gap-2 rounded-lg px-4 text-label-md transition-colors ${toRussia === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label>
            <span className="label">{t("Аз куҷо")}</span>
            <select className="input" value={from} onChange={(e) => set({ from: e.target.value, day: "" })}>
              {fromOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={swap} aria-label={t("Ҷойҳоро иваз кардан")} className="flex h-12 w-12 items-center justify-center self-end rounded-xl text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-all duration-300 hover:rotate-180 hover:bg-surface-container-low hover:text-on-surface">
            <ArrowLeftRight className="h-5 w-5" aria-hidden />
          </button>
          <label>
            <span className="label">{t("Ба куҷо")}</span>
            <select className="input" value={to} onChange={(e) => set({ to: e.target.value, day: "" })}>
              {toOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>
            <span className="label">{t("Моҳ")}</span>
            <select className="input" value={month} onChange={(e) => set({ month: e.target.value, day: "" })}>
              {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
            </select>
          </label>
          <Passengers pax={pax} onChange={setPax} />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <ErrorBox error={airportsError || error} />
          {loading || !airports ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-40" />)
          ) : result && !result.enabled ? (
            <EmptyState icon={Plane} title={t("Нархҳоро дар Aviasales бинед")} text={t("Нархҳои зинда дар ин сайт ҳоло танзим нашудаанд. Тугмаро пахш кунед — ҷустуҷӯи ҳамин роҳ дар Aviasales кушода мешавад.")}>
              <a href={result.search_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
                {t("Ҷустуҷӯ дар Aviasales")}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </EmptyState>
          ) : result && result.results.length === 0 ? (
            <EmptyState icon={Plane} title={t("Барои ин моҳ нарх ёфт нашуд")} text={t("Моҳи дигар ё фурудгоҳи дигарро интихоб кунед, ё дар Aviasales бинед.")}>
              <a href={result.search_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
                {t("Ҷустуҷӯ дар Aviasales")}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </EmptyState>
          ) : result ? (
            <>
              <Filters f={f} set={set} airlines={airlines} priceRange={priceRange} active={activeFilters} onReset={resetFilters} />
              <Calendar calendar={calendar} month={month} day={day} weekdays={f.weekdays} onPick={(d) => set({ day: d })} />
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="flex flex-wrap items-baseline gap-x-2 text-[19px] font-semibold">
                  {day ? t("Чиптаҳо барои {0}", dayLabel(day, true)) : activeFilters ? t("Чиптаҳои ёфтшуда") : t("Арзонтарин чиптаҳо")}
                  <span className="text-body-sm font-normal tabular-nums text-on-surface-variant">{matching.length}</span>
                </h2>
                <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-label-md text-primary">
                  {t("Ҳама дар Aviasales")}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
              {shown.length ? (
                <>
                  <Stagger key={`${from}${to}${month}${direct}${day}${params.get("wd")}${params.get("time")}${params.get("airline")}${f.sort}`} className="card flex flex-col divide-y divide-outline-variant p-1">
                    {shown.map((ticket, i) => (
                      <StaggerItem key={`${ticket.departure_at}-${ticket.price}-${i}`}>
                        <TicketRow ticket={ticket} pax={pax} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                  {matching.length > shown.length && (
                    <button type="button" onClick={() => setLimit(limit + 30)} className="inline-flex min-h-[44px] items-center justify-center gap-2 self-center rounded-xl px-5 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
                      {t("Боз нишон додан ({0})", matching.length - shown.length)}
                    </button>
                  )}
                </>
              ) : (
                <EmptyState icon={Plane} title={activeFilters ? t("Бо ин филтрҳо чипта ёфт нашуд") : t("Барои ин рӯз нарх ёфт нашуд")} text={activeFilters ? t("Баъзе филтрҳоро тоза кунед ё рӯзи дигарро интихоб кунед.") : t("Рӯзи дигарро интихоб кунед ё чиптаҳои ҳамин рӯзро дар Aviasales бинед.")}>
                  {activeFilters > 0 && (
                    <Button variant="plain" onClick={resetFilters}>
                      {t("Тоза кардан ({0})", activeFilters)}
                    </Button>
                  )}
                  <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
                    {t("Ҷустуҷӯ дар Aviasales")}
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                </EmptyState>
              )}
              <p className="px-1 text-body-sm text-on-surface-variant">{t("Нархҳо аз Aviasales: арзонтарин чиптаҳое, ки дар рӯзҳои охир ёфт шудаанд. Нархи дақиқ ҳангоми харид маълум мешавад.")}</p>
            </>
          ) : null}
        </div>
        <aside className="grid gap-4 md:grid-cols-2 xl:col-span-4 xl:flex xl:flex-col">
          <AirlineLinks searchUrl={searchUrl} />
          <PriceAlert origin={from} destination={to} month={month} cheapest={cheapest} />
          <TravelTips />
        </aside>
      </div>
    </div>
  );
}

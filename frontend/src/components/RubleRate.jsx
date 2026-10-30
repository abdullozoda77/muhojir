import { useState } from "react";
import { ArrowLeftRight, Banknote, TrendingDown, TrendingUp } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date, num, rub } from "../format.js";
import { Skeleton } from "./ui.jsx";

const AMOUNTS = { rub: [5000, 10000, 50000, 100000], tjs: [500, 1000, 5000, 10000] };

const tjs = (value) =>
  `${Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t("сомонӣ")}`;

function Sparkline({ points }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * 100).toFixed(2)},${(34 - ((p.value - min) / span) * 30).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-12 w-full text-primary" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const rubles = (value) =>
  `${Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;

export default function RubleRate() {
  const { data, loading } = useApi("/rates/");
  const [typed, setTyped] = useState("10000");
  const [from, setFrom] = useState("rub");

  if (loading) return <Skeleton className="h-56" />;
  const nbt = data?.latest?.nbt;
  const cbr = data?.latest?.cbr;
  const main = nbt || cbr;
  if (!main) return null;

  const points = data.history.filter((h) => h.nbt).map((h) => ({ day: h.day, value: h.nbt }));
  const first = points[0]?.value;
  const change = nbt && first && points.length > 1 ? ((nbt.value - first) / first) * 100 : null;
  const Trend = change >= 0 ? TrendingUp : TrendingDown;
  const amount = Number(typed) || 0;
  const swap = () => {
    const next = from === "rub" ? "tjs" : "rub";
    const converted = from === "rub" ? amount * main.value : amount / main.value;
    setFrom(next);
    setTyped(amount ? String(Math.round(converted)) : String(AMOUNTS[next][1]));
  };

  return (
    <section className="card grid gap-6 p-5 md:grid-cols-2 md:gap-10 md:p-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-label-md text-on-surface-variant">
              <Banknote className="h-4 w-4 text-primary" aria-hidden />
              {t("Қурби расмӣ")}
            </p>
            <p className="mt-1 font-display text-[26px] font-semibold tabular-nums leading-tight md:text-[30px]">
              {from === "rub" ? `1 000 ₽ = ${tjs(main.value * 1000)}` : `${tjs(100)} = ${rubles(100 / main.value)}`}
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              {nbt ? t("Бонки миллии Тоҷикистон, {0}", date(nbt.day)) : t("Банки марказии Русия, {0}", date(cbr.day))}
            </p>
          </div>
          {change !== null && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label-md tabular-nums ${change >= 0 ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"}`}>
              <Trend className="h-4 w-4" aria-hidden />
              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            </span>
          )}
        </div>
        <Sparkline points={points} />
        {points.length > 1 && (
          <p className="-mt-2 flex justify-between text-label-sm text-on-surface-variant">
            <span>{date(points[0].day)}</span>
            <span>{date(points.at(-1).day)}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-xl bg-surface-container-low p-1" role="group" aria-label={t("Самти табдил")}>
          {[["rub", t("Рубл → сомонӣ")], ["tjs", t("Сомонӣ → рубл")]].map(([code, name], i) => (
            <button key={code} type="button" onClick={() => from !== code && swap()} aria-pressed={from === code} className={`min-h-[36px] rounded-lg px-2 text-label-md transition-colors ${i ? "order-3" : ""} ${from === code ? "bg-ink text-on-ink shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
              {name}
            </button>
          ))}
          <button type="button" onClick={swap} aria-label={t("Иваз кардан")} title={t("Иваз кардан")} className="group order-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant transition-colors hover:bg-primary-fixed hover:text-on-primary-fixed hover:ring-primary/30">
            <ArrowLeftRight className={`h-4 w-4 transition-transform duration-300 ${from === "tjs" ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
        <label className="block">
          <span className="label">{from === "rub" ? t("Маблағ бо рубл") : t("Маблағ бо сомонӣ")}</span>
          <span className="relative block">
            <input className="input pr-20 text-[20px] font-semibold tabular-nums" inputMode="numeric" value={typed ? num(typed) : ""} onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder={num(AMOUNTS[from][1])} />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">{from === "rub" ? "₽" : t("сомонӣ")}</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AMOUNTS[from].map((value) => (
            <button key={value} type="button" onClick={() => setTyped(String(value))} aria-pressed={amount === value} className={`min-h-[36px] rounded-lg px-3 text-label-md tabular-nums transition-colors ${amount === value ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low"}`}>
              {from === "rub" ? rub(value) : `${num(value)} ${t("сомонӣ")}`}
            </button>
          ))}
        </div>
        <div className="grid gap-2 text-body-sm sm:grid-cols-2">
          <div className="rounded-xl bg-primary-fixed/60 p-3">
            <p className="text-on-surface-variant">{t("{0} бо қурби расмӣ", from === "rub" ? rub(amount) : tjs(amount))}</p>
            <p className="font-semibold tabular-nums">{from === "rub" ? tjs(main.value * amount) : rubles(amount / main.value)}</p>
          </div>
          {nbt && cbr && (
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-on-surface-variant">{t("Банки марказии Русия")}</p>
              <p className="font-semibold tabular-nums">{from === "rub" ? `1 000 ₽ = ${tjs(cbr.value * 1000)}` : `${tjs(100)} = ${rubles(100 / cbr.value)}`}</p>
            </div>
          )}
        </div>
        <p className="text-label-sm text-on-surface-variant">{t("Қурби расмӣ танҳо барои муқоиса аст: хизматҳои интиқол қурби худро доранд.")}</p>
      </div>
    </section>
  );
}

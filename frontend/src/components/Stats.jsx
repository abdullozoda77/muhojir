import { useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import { lang, t } from "../i18n.js";

const MONTHS_TG = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const STEPS = ["bg-surface-container-high", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];

const monthName = (m) => (lang === "ru" ? MONTHS_RU : MONTHS_TG)[m];

const dayText = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${monthName(d.getMonth())}`;
};

export function StatTile({ icon: Icon, value, label, hint, accent = "text-primary" }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
      <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${accent}`} aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      <span className="font-display text-[28px] font-semibold leading-none tabular-nums text-on-surface">{value ?? "—"}</span>
      {hint && <span className="truncate text-body-sm text-on-surface-variant">{hint}</span>}
    </div>
  );
}

export function Ring({ value, total, size = 132, stroke = 12, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const part = total ? Math.min(1, value / total) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${value} / ${total}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-container-high" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - part)}
          className="stroke-tertiary transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function step(count, max) {
  if (!count) return 0;
  if (max <= 4) return Math.min(4, count);
  return Math.min(4, Math.ceil((count / max) * 4));
}

export function Heatmap({ days, unit }) {
  const box = useRef(null);
  const [tip, setTip] = useState(null);
  const weeks = Math.ceil(days.length / 7);
  const max = Math.max(1, ...days.map((d) => d.count));
  const months = useMemo(() => {
    const labels = [];
    let last = -1;
    for (let w = 0; w < weeks; w += 1) {
      const d = new Date(`${days[w * 7].date}T00:00:00`);
      if (d.getMonth() !== last && (w > 0 || d.getDate() <= 7)) {
        labels.push({ w, text: monthName(d.getMonth()) });
        last = d.getMonth();
      } else if (w === 0) {
        last = d.getMonth();
      }
    }
    return labels;
  }, [days, weeks]);

  const show = (e, day) => {
    const cell = e.currentTarget.getBoundingClientRect();
    const frame = box.current.getBoundingClientRect();
    setTip({ day, x: cell.left - frame.left + cell.width / 2, y: cell.top - frame.top });
  };

  return (
    <div ref={box} className="relative flex w-full flex-col gap-2" style={{ maxWidth: weeks * 24 }} onMouseLeave={() => setTip(null)}>
      <div className="grid gap-[3px] text-[10px] text-on-surface-variant" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-hidden>
        {months.map((m) => (
          <span key={m.w} className="whitespace-nowrap" style={{ gridColumnStart: m.w + 1 }}>{m.text}</span>
        ))}
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} role="list">
        {days.map((day) => (
            <button
              key={day.date}
              type="button"
              role="listitem"
              aria-label={`${dayText(day.date)}: ${day.count} ${unit}`}
              onMouseEnter={(e) => show(e, day)}
              onFocus={(e) => show(e, day)}
              onClick={(e) => show(e, day)}
              className={`aspect-square w-full rounded-[3px] outline-none transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-primary ${STEPS[step(day.count, max)]}`}
            />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-on-surface-variant" aria-hidden>
        <span>{t("Кам")}</span>
        {STEPS.map((s) => <span key={s} className={`h-2.5 w-2.5 rounded-[3px] ${s}`} />)}
        <span>{t("Бисёр")}</span>
      </div>
      {tip && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-label-sm text-on-ink shadow-lg" style={{ left: Math.min(Math.max(tip.x, 60), (box.current?.offsetWidth || 0) - 60), top: tip.y - 6 }}>
          <span className="tabular-nums font-semibold">{tip.day.count}</span> {unit} · {dayText(tip.day.date)}
        </div>
      )}
    </div>
  );
}

export function levelStars(level) {
  return (level.done * 2 >= level.total && level.done > 0 ? 1 : 0) + (level.done >= level.total ? 1 : 0) + (level.passed ? 1 : 0);
}

function Stars({ count, size = "h-3.5 w-3.5", lit = true }) {
  return (
    <span className="flex items-end justify-center gap-0.5">
      {[0, 1, 2].map((i) => {
        const on = i < count;
        return (
          <Star
            key={i}
            className={`${size} shrink-0 transition-all duration-500 ${i === 1 ? "-translate-y-1" : ""} ${on ? `fill-amber-400 text-amber-400 ${lit ? "drop-shadow-[0_0_6px_rgba(251,191,36,0.65)]" : ""}` : "fill-surface-container-high text-outline-variant"}`}
            strokeWidth={1.5}
            style={{ transitionDelay: `${i * 120}ms` }}
            aria-hidden
          />
        );
      })}
    </span>
  );
}

export function LevelBars({ levels, title }) {
  const [active, setActive] = useState(null);
  const current = active === null ? null : levels[active];
  const total = levels.reduce((sum, l) => sum + levelStars(l), 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-transparent px-3 py-2 ring-1 ring-inset ring-amber-400/20">
        <span className="flex items-center gap-2 text-label-md text-on-surface">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" aria-hidden />
          {t("Ситораҳо")}
        </span>
        <span className="font-display text-[18px] font-semibold tabular-nums text-on-surface">
          {total}<span className="text-on-surface-variant"> / {levels.length * 3}</span>
        </span>
      </div>
      <div className="relative flex h-36 items-end gap-2 border-b border-outline-variant" onMouseLeave={() => setActive(null)}>
        {[25, 50, 75].map((p) => (
          <span key={p} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-outline-variant/60" style={{ bottom: `${p}%` }} aria-hidden />
        ))}
        {levels.map((level, i) => {
          const part = level.total ? level.done / level.total : 0;
          return (
            <button
              key={level.level}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${title(level)}: ${level.done}/${level.total}, ${t("{0} ситора", levelStars(level))}`}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              <span className={`absolute bottom-0 top-0 w-full max-w-[34px] rounded-t-[6px] transition-colors ${active === i ? "bg-surface-container-high" : "bg-surface-container-low"} group-focus-visible:ring-2 group-focus-visible:ring-primary`} aria-hidden />
              <span
                className={`relative w-full max-w-[34px] rounded-t-[6px] transition-[height,opacity] duration-700 ease-out ${level.passed ? "bg-gradient-to-t from-tertiary to-tertiary/70" : "bg-gradient-to-t from-primary to-primary/70"} ${active === null || active === i ? "opacity-100" : "opacity-50"}`}
                style={{ height: `${Math.max(part * 100, level.done ? 4 : 0)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2" aria-hidden>
        {levels.map((level, i) => (
          <span key={level.level} className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg py-1.5 transition-colors ${active === i ? "bg-surface-container-low" : ""}`}>
            <Stars count={levelStars(level)} size="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="text-label-sm tabular-nums text-on-surface-variant">{level.level}</span>
          </span>
        ))}
      </div>
      <div className="min-h-[52px] rounded-xl bg-surface-container-low px-3 py-2 text-body-sm" aria-live="polite">
        {current ? (
          <span className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-on-surface">{t("Сатҳи {0}", current.level)} · {title(current)}</span>
              <span className="text-on-surface-variant tabular-nums">
                {t("{0} аз {1} дарс", current.done, current.total)}
                {current.average !== null && ` · ${t("миёна {0}%", current.average)}`}
                {current.exam_percent !== null && ` · ${t("имтиҳон {0}%", current.exam_percent)}`}
              </span>
            </span>
            <Stars count={levelStars(current)} size="h-4 w-4" />
          </span>
        ) : (
          <span className="flex flex-col gap-1.5 text-on-surface-variant">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-tertiary" />{t("Сатҳ супорида шуд")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />{t("Дар ҷараён")}</span>
            </span>
            <span className="text-[12px]">{t("★ нисфи дарсҳо · ★★ ҳамаи дарсҳо · ★★★ имтиҳон супорида шуд")}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function ShareBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ key, icon: Icon, label, count }) => (
        <li key={key} className="flex items-center gap-3" title={`${label}: ${count}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center justify-between gap-2 text-label-md">
              <span className="truncate">{label}</span>
              <span className="tabular-nums text-on-surface-variant">{count}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <span className="block h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${(count / max) * 100}%` }} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StatCard({ title, icon: Icon, aside, children, className = "" }) {
  return (
    <section className={`card flex min-w-0 flex-col gap-4 p-5 md:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          {Icon && <Icon className="h-5 w-5 text-on-surface-variant" aria-hidden />}
          {title}
        </h2>
        {aside && <span className="text-label-md tabular-nums text-on-surface-variant">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

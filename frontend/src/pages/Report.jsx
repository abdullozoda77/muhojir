import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { rub } from "../format.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

const MONTHS = () => [t("Янв"), t("Фев"), t("Мар"), t("Апр"), t("Май"), t("Июн"), t("Июл"), t("Авг"), t("Сен"), t("Окт"), t("Ноя"), t("Дек")];
const MONTH_NAMES = () => [t("Январ"), t("Феврал"), t("Март"), t("Апрел"), t("Май"), t("Июн"), t("Июл"), t("Август"), t("Сентябр"), t("Октябр"), t("Ноябр"), t("Декабр")];

const FILL = "fill-[#2a78d6] dark:fill-[#3987e5]";
const SWATCH = "bg-[#2a78d6] dark:bg-[#3987e5]";

const trim = (value) => `${Number(value.toFixed(1))}`;
const short = (value) => (value >= 1_000_000 ? `${trim(value / 1_000_000)}M` : value >= 1000 ? `${trim(value / 1000)}k` : `${value}`);

function niceScale(value) {
  const raw = Math.max(value, 1000) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * power).find((v) => v >= raw);
  const count = Math.ceil(Math.max(value, 1000) / step);
  return { max: step * count, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

function MonthChart({ months }) {
  const [hover, setHover] = useState(null);
  const names = MONTH_NAMES();
  const labels = MONTHS();
  const rows = months.map((m) => ({ ...m, paid: Number(m.paid) }));
  const { max, ticks } = niceScale(Math.max(...rows.map((r) => r.paid)));
  const W = 720, H = 240, left = 44, right = 8, top = 12, bottom = 28;
  const plotW = W - left - right, plotH = H - top - bottom;
  const col = plotW / 12;
  const bar = Math.min(28, col - 16);
  const y = (v) => top + plotH - (v / max) * plotH;
  const active = hover !== null ? rows[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label={t("Диаграммаи моҳона: пардохти патент ва ҳуҷҷатҳо")} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-outline" : "stroke-outline-variant"} strokeWidth="1" strokeDasharray={v === 0 ? undefined : "2 4"} />
            <text x={left - 8} y={y(v) + 4} textAnchor="end" className="fill-on-surface-variant text-[11px] tabular-nums">{short(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const h = r.paid ? Math.max(2, (r.paid / max) * plotH) : 0;
          const x = left + i * col + (col - bar) / 2;
          const yTop = top + plotH - h;
          const radius = Math.min(4, h, bar / 2);
          return (
            <g key={r.month}>
              {i === hover && <rect x={left + i * col + 2} y={top} width={col - 4} height={plotH} rx="6" className="fill-on-surface/5" />}
              {h > 0 && (
                <path className={FILL}
                  d={`M${x},${top + plotH} V${yTop + radius} Q${x},${yTop} ${x + radius},${yTop} H${x + bar - radius} Q${x + bar},${yTop} ${x + bar},${yTop + radius} V${top + plotH} Z`} />
              )}
              <text x={left + i * col + col / 2} y={H - 8} textAnchor="middle" className={`text-[11px] ${i === hover ? "fill-on-surface font-semibold" : "fill-on-surface-variant"}`}>{labels[i]}</text>
              <rect x={left + i * col} y={top} width={col} height={plotH + bottom} fill="transparent"
                onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} />
            </g>
          );
        })}
      </svg>
      {active && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-xl bg-surface-container-lowest p-3 text-body-sm shadow-lg ring-1 ring-outline-variant"
          style={hover < 6 ? { left: `${((left + (hover + 1) * col) / W) * 100}%` } : { right: `${((W - left - hover * col) / W) * 100}%` }}>
          <p className="mb-1 text-label-md">{names[hover]}</p>
          <p className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${SWATCH}`} aria-hidden />
            <span className="flex-1 tabular-nums text-on-surface">{rub(active.paid)}</span>
          </p>
          {active.payments > 0 && <p className="mt-0.5 text-on-surface-variant">{t("{0} пардохт", active.payments)}</p>}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <span className="text-[19px] font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-[24px]">{value}</span>
    </div>
  );
}

export default function Report() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const report = useApi(`/money/report/?year=${year}`);
  const data = report.data;
  const names = MONTH_NAMES();

  const busyMonths = useMemo(() => (data?.months || []).filter((m) => Number(m.paid)), [data]);
  const average = busyMonths.length && data ? Number(data.total) / busyMonths.length : 0;
  const years = data?.years || [thisYear];
  const older = years.find((y) => y < year);
  const newer = [...years].reverse().find((y) => y > year);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Пули ман")} icon={BarChart3} title={t("Ҳисоботи моҳона")} text={t("Чанд барои патент ва ҳуҷҷатҳо пардохтед — моҳ ба моҳ. Маълумот аз «Архиви чекҳо» гирифта мешавад.")}>
        <Link to="/payments" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-lg text-on-surface ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
          <ReceiptText className="h-5 w-5 text-primary" aria-hidden />
          {t("Архиви чекҳо")}
        </Link>
      </PageHeader>

      <div className="flex items-center gap-2">
        <Button variant="plain" icon={ChevronLeft} disabled={!older} onClick={() => setYear(older)} aria-label={t("Соли гузашта")} />
        <span className="min-w-[72px] text-center text-[20px] font-semibold tabular-nums">{year}</span>
        <Button variant="plain" icon={ChevronRight} disabled={!newer} onClick={() => setYear(newer)} aria-label={t("Соли оянда")} />
      </div>

      <ErrorBox error={report.error} />
      {report.loading && !data ? (
        <Skeleton className="h-80" />
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label={t("Ҳамагӣ дар {0}", year)} value={rub(data.total)} />
            <Tile label={t("Миёна дар як моҳ")} value={average ? rub(Math.round(average)) : "—"} />
            <Tile label={t("Шумораи пардохтҳо")} value={data.payments} />
          </div>

          <section className="card flex flex-col gap-4 p-4 md:p-6">
            <h2 className="text-[18px] font-semibold">{t("Патент ва ҳуҷҷатҳо — моҳ ба моҳ")}</h2>
            {busyMonths.length ? (
              <MonthChart months={data.months} />
            ) : (
              <EmptyState icon={ReceiptText} title={t("Дар ин сол ҳоло пардохт нест")} text={t("Дар «Ҳуҷҷатҳои ман» дар корти патент «Пардохти патентро сабт кардан»-ро пахш кунед.")}>
                <Link to="/documents" className="inline-flex min-h-[48px] items-center rounded-xl bg-ink px-6 text-label-lg text-on-ink transition-all hover:bg-ink/90">{t("Ҳуҷҷатҳои ман")}</Link>
              </EmptyState>
            )}
          </section>

          {busyMonths.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card overflow-hidden">
                <table className="w-full text-left text-body-sm">
                  <caption className="px-4 pt-4 text-left text-[18px] font-semibold md:px-6">{t("Ҷадвал")}</caption>
                  <thead className="text-label-md text-on-surface-variant">
                    <tr className="border-b border-outline-variant">
                      <th className="px-4 py-3 font-medium md:px-6">{t("Моҳ")}</th>
                      <th className="px-4 py-3 text-right font-medium">{t("Пардохт")}</th>
                      <th className="px-4 py-3 text-right font-medium md:px-6">{t("Маблағ")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant tabular-nums">
                    {busyMonths.map((m) => (
                      <tr key={m.month}>
                        <td className="px-4 py-2.5 md:px-6">{names[m.month - 1]}</td>
                        <td className="px-4 py-2.5 text-right">{m.payments}</td>
                        <td className="px-4 py-2.5 text-right md:px-6">{rub(m.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="card flex flex-col gap-3 self-start p-4 md:p-6">
                <h2 className="text-[18px] font-semibold">{t("Аз рӯи ҳуҷҷат")}</h2>
                {data.documents.map((d) => (
                  <div key={d.title} className="flex flex-col gap-1">
                    <span className="flex justify-between gap-3 text-body-sm"><span>{d.title}</span><span className="tabular-nums">{rub(d.paid)}</span></span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                      <span className={`block h-full rounded-full ${SWATCH}`} style={{ width: `${(Number(d.paid) / Number(data.total)) * 100}%` }} />
                    </span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

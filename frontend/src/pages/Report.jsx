import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronRight, Plus, ReceiptText, Send, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date, num, rub } from "../format.js";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";

const MONTHS = () => [t("Янв"), t("Фев"), t("Мар"), t("Апр"), t("Май"), t("Июн"), t("Июл"), t("Авг"), t("Сен"), t("Окт"), t("Ноя"), t("Дек")];
const MONTH_NAMES = () => [t("Январ"), t("Феврал"), t("Март"), t("Апрел"), t("Май"), t("Июн"), t("Июл"), t("Август"), t("Сентябр"), t("Октябр"), t("Ноябр"), t("Декабр")];

const SERIES = [
  { key: "sent", label: () => t("Ба Ватан фиристодам"), fill: "fill-[#2a78d6] dark:fill-[#3987e5]", swatch: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  { key: "patent", label: () => t("Патент ва ҳуҷҷатҳо"), fill: "fill-[#eb6834] dark:fill-[#d95926]", swatch: "bg-[#eb6834] dark:bg-[#d95926]" },
];

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
  const rows = months.map((m) => ({ ...m, sent: Number(m.sent), patent: Number(m.patent), fees: Number(m.fees) }));
  const { max, ticks } = niceScale(Math.max(...rows.flatMap((r) => [r.sent, r.patent])));
  const W = 720, H = 260, left = 44, right = 8, top = 12, bottom = 28;
  const plotW = W - left - right, plotH = H - top - bottom;
  const col = plotW / 12;
  const bar = Math.min(18, (col - 10) / 2);
  const y = (v) => top + plotH - (v / max) * plotH;
  const active = hover !== null ? rows[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label={t("Диаграммаи моҳона: пули фиристода ва пардохти патент")} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-outline" : "stroke-outline-variant"} strokeWidth="1" strokeDasharray={v === 0 ? undefined : "2 4"} />
            <text x={left - 8} y={y(v) + 4} textAnchor="end" className="fill-on-surface-variant text-[11px] tabular-nums">{short(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x0 = left + i * col + (col - bar * 2 - 2) / 2;
          return (
            <g key={r.month}>
              {i === hover && <rect x={left + i * col + 2} y={top} width={col - 4} height={plotH} rx="6" className="fill-on-surface/5" />}
              {SERIES.map((s, k) => {
                const value = r[s.key];
                if (!value) return null;
                const h = Math.max(2, (value / max) * plotH);
                const x = x0 + k * (bar + 2);
                const yTop = top + plotH - h;
                const radius = Math.min(4, h, bar / 2);
                return (
                  <path key={s.key} className={s.fill}
                    d={`M${x},${top + plotH} V${yTop + radius} Q${x},${yTop} ${x + radius},${yTop} H${x + bar - radius} Q${x + bar},${yTop} ${x + bar},${yTop + radius} V${top + plotH} Z`} />
                );
              })}
              <text x={left + i * col + col / 2} y={H - 8} textAnchor="middle" className={`text-[11px] ${i === hover ? "fill-on-surface font-semibold" : "fill-on-surface-variant"}`}>{labels[i]}</text>
              <rect x={left + i * col} y={top} width={col} height={plotH + bottom} fill="transparent"
                onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} />
            </g>
          );
        })}
      </svg>
      {active && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-[190px] rounded-xl bg-surface-container-lowest p-3 text-body-sm shadow-lg ring-1 ring-outline-variant"
          style={hover < 6 ? { left: `${((left + (hover + 1) * col) / W) * 100}%` } : { right: `${((W - left - hover * col) / W) * 100}%` }}>
          <p className="mb-1.5 text-label-md">{names[hover]}</p>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${s.swatch}`} aria-hidden />
              <span className="flex-1 text-on-surface-variant">{s.label()}</span>
              <span className="tabular-nums text-on-surface">{rub(active[s.key])}</span>
            </p>
          ))}
          {active.fees > 0 && <p className="mt-1 text-on-surface-variant">{t("Комиссия")}: <span className="tabular-nums text-on-surface">{rub(active.fees)}</span></p>}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-label-md text-on-surface-variant">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-2">
          <span className={`h-3 w-3 rounded-sm ${s.swatch}`} aria-hidden />
          {s.label()}
        </span>
      ))}
    </div>
  );
}

function Tile({ label, value, note, swatch }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
        {swatch && <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} aria-hidden />}
        {label}
      </span>
      <span className="text-[19px] font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-[24px]">{rub(value)}</span>
      {note && <span className="text-body-sm text-on-surface-variant">{note}</span>}
    </div>
  );
}

function AddTransfer({ open, onClose, onSaved, services }) {
  const today = new Date().toLocaleDateString("sv-SE");
  const empty = { amount: "", fee: "", service: "korona", recipient: "", sent_at: today, note: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const err = (key) => error?.data?.[key];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/money/remittances/", { method: "POST", body: { ...form, fee: form.fee || 0 } });
      setForm(empty);
      onSaved();
    } catch (er) {
      setError(er);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={t("Пул фиристодам")} subtitle={t("Ин танҳо барои ҳисоби худи шумост — ҳеҷ кас намебинад.")} icon={Send}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Маблағ, ₽")} required error={err("amount")}>
            <input className="input" type="number" inputMode="decimal" min="1" step="0.01" required value={form.amount} onChange={set("amount")} placeholder="20000" />
          </Field>
          <Field label={t("Комиссия, ₽")} error={err("fee")}>
            <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.fee} onChange={set("fee")} placeholder="0" />
          </Field>
        </div>
        <Field label={t("Бо чӣ фиристодед")} error={err("service")}>
          <select className="input" value={form.service} onChange={set("service")}>
            {services.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Ба кӣ")} error={err("recipient")}>
            <input className="input" maxLength={100} value={form.recipient} onChange={set("recipient")} placeholder={t("Масалан: модар")} />
          </Field>
          <Field label={t("Сана")} error={err("sent_at")}>
            <input className="input" type="date" max={today} value={form.sent_at} onChange={set("sent_at")} />
          </Field>
        </div>
        <Field label={t("Эзоҳ")} error={err("note")}>
          <input className="input" maxLength={255} value={form.note} onChange={set("note")} />
        </Field>
        <ErrorBox error={error && !error.data ? error : null} />
        <Button type="submit" icon={Plus} loading={busy}>{t("Илова кардан")}</Button>
      </form>
    </Drawer>
  );
}

export default function Report() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [adding, setAdding] = useState(false);
  const report = useApi(`/money/report/?year=${year}`);
  const list = useApi(`/money/remittances/?year=${year}`);
  const services = useApi("/money/services/");
  const data = report.data;
  const names = MONTH_NAMES();

  const reload = () => {
    report.reload();
    list.reload();
  };
  const remove = async (r) => {
    if (!window.confirm(t("Ин сабтро нест кунем?"))) return;
    await api(`/money/remittances/${r.id}/`, { method: "DELETE" }).catch(() => {});
    reload();
  };

  const busyMonths = useMemo(() => (data?.months || []).filter((m) => Number(m.sent) || Number(m.patent)), [data]);
  const total = data ? Number(data.totals.sent) + Number(data.totals.patent) + Number(data.totals.fees) : 0;
  const average = busyMonths.length && data ? Number(data.totals.sent) / busyMonths.length : 0;
  const years = data?.years || [thisYear];
  const older = years.find((y) => y < year);
  const newer = [...years].reverse().find((y) => y > year);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Пули ман")} icon={BarChart3} title={t("Ҳисоботи моҳона")} text={t("Чанд пул ба Ватан фиристодед ва чанд барои патент ва ҳуҷҷатҳо пардохтед — моҳ ба моҳ.")}>
        <Button icon={Plus} onClick={() => setAdding(true)}>{t("Пул фиристодам")}</Button>
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("Ба Ватан фиристодам")} value={data.totals.sent} swatch={SERIES[0].swatch} note={average ? t("Миёна {0} дар як моҳ", rub(Math.round(average))) : null} />
            <Tile label={t("Патент ва ҳуҷҷатҳо")} value={data.totals.patent} swatch={SERIES[1].swatch} />
            <Tile label={t("Комиссияи интиқол")} value={data.totals.fees} />
            <Tile label={t("Ҳамагӣ")} value={total} />
          </div>

          <section className="card flex flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold">{t("Моҳ ба моҳ")}</h2>
              <Legend />
            </div>
            {busyMonths.length ? (
              <MonthChart months={data.months} />
            ) : (
              <EmptyState icon={BarChart3} title={t("Дар ин сол ҳоло чизе нест")} text={t("Пули фиристодаро илова кунед. Пардохтҳои патент аз «Архиви чекҳо» худ ба худ меоянд.")}>
                <Button icon={Plus} onClick={() => setAdding(true)}>{t("Пул фиристодам")}</Button>
              </EmptyState>
            )}
          </section>

          {busyMonths.length > 0 && (
            <section className="card overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-body-sm">
                <caption className="px-4 pt-4 text-left text-[18px] font-semibold md:px-6">{t("Ҷадвал")}</caption>
                <thead className="text-label-md text-on-surface-variant">
                  <tr className="border-b border-outline-variant">
                    <th className="px-4 py-3 font-medium md:px-6">{t("Моҳ")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("Ба Ватан")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("Патент")}</th>
                    <th className="px-4 py-3 text-right font-medium md:px-6">{t("Комиссия")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant tabular-nums">
                  {busyMonths.map((m) => (
                    <tr key={m.month}>
                      <td className="px-4 py-2.5 md:px-6">{names[m.month - 1]}</td>
                      <td className="px-4 py-2.5 text-right">{Number(m.sent) ? rub(m.sent) : "—"}{m.transfers > 1 && <span className="text-on-surface-variant"> · {m.transfers}×</span>}</td>
                      <td className="px-4 py-2.5 text-right">{Number(m.patent) ? rub(m.patent) : "—"}</td>
                      <td className="px-4 py-2.5 text-right md:px-6">{Number(m.fees) ? rub(m.fees) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data.services.length > 0 && (
            <section className="card flex flex-col gap-3 p-4 md:p-6">
              <h2 className="text-[18px] font-semibold">{t("Бо кадом хидмат")}</h2>
              {data.services.map((s) => (
                <div key={s.service} className="flex flex-col gap-1">
                  <span className="flex justify-between text-body-sm"><span>{t(s.label)}</span><span className="tabular-nums">{rub(s.sent)}</span></span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                    <span className={`block h-full rounded-full ${SERIES[0].swatch}`} style={{ width: `${(Number(s.sent) / Number(data.totals.sent)) * 100}%` }} />
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold">{t("Интиқолҳо дар {0}", year)}</h2>
          <Link to="/payments" className="inline-flex items-center gap-1.5 text-label-md text-primary hover:underline">
            <ReceiptText className="h-4 w-4" aria-hidden />
            {t("Архиви чекҳо")}
          </Link>
        </div>
        <ErrorBox error={list.error} />
        {(list.data || []).length === 0 ? (
          <p className="card p-5 text-body-md text-on-surface-variant">{t("Ҳоло интиқол сабт нашудааст.")}</p>
        ) : (
          <div className="card flex flex-col divide-y divide-outline-variant">
            {list.data.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-label-lg tabular-nums">{rub(r.amount)}{Number(r.fee) > 0 && <span className="text-body-sm text-on-surface-variant"> + {num(r.fee)} ₽ {t("комиссия")}</span>}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {[date(r.sent_at), t(r.service_label), r.recipient, r.note].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Button variant="ghost" icon={Trash2} onClick={() => remove(r)} aria-label={t("Нест кардан")} />
              </div>
            ))}
          </div>
        )}
      </section>

      <AddTransfer open={adding} onClose={() => setAdding(false)} services={services.data || []}
        onSaved={() => { setAdding(false); reload(); }} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  BrickWall, CalendarDays, Check, CheckCircle2, Flame, Grid3x3, Hammer, Handshake, HardHat, House, Inbox, MapPin, MessageCircle,
  PaintRoller, Phone, Plus, Send, Sparkles, Star, Trees, Truck, Users, UsersRound, Wallet, Wrench, X, Zap,
} from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t, useLang } from "../i18n.js";
import { ago, date as fmtDate, rub } from "../format.js";
import CityInput from "../components/CityInput.jsx";
import { StarPicker, Stars } from "../components/Stars.jsx";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton, Switch } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

export const TRADES = [
  { value: "repair", icon: Hammer, label: () => t("Таъмири хона") },
  { value: "build", icon: HardHat, label: () => t("Сохтмон") },
  { value: "tile", icon: Grid3x3, label: () => t("Кафелгузорӣ") },
  { value: "plumbing", icon: Wrench, label: () => t("Сантехника") },
  { value: "electric", icon: Zap, label: () => t("Барқ (электрик)") },
  { value: "welding", icon: Flame, label: () => t("Кафшеркорӣ") },
  { value: "roof", icon: House, label: () => t("Бом") },
  { value: "facade", icon: BrickWall, label: () => t("Фасад ва девор") },
  { value: "paint", icon: PaintRoller, label: () => t("Рангубор ва гаҷкорӣ") },
  { value: "cleaning", icon: Sparkles, label: () => t("Тозакунӣ") },
  { value: "movers", icon: Truck, label: () => t("Боркашонӣ") },
  { value: "garden", icon: Trees, label: () => t("Ҳавлӣ ва боғ") },
  { value: "other", icon: Users, label: () => t("Дигар") },
];
export const tradeOf = (value) => TRADES.find((x) => x.value === value) || TRADES[TRADES.length - 1];

const STATUS_TONES = {
  new: "bg-primary-fixed text-primary",
  accepted: "bg-tertiary-fixed text-on-tertiary-fixed",
  declined: "bg-error-container text-on-error-container",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const chip = (on) => `inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full px-4 text-label-md ring-1 ring-inset transition-colors ${on ? "bg-ink text-on-ink ring-ink" : "bg-surface-container-lowest ring-outline-variant hover:bg-surface-container-low"}`;

export const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

export function Contacts({ p }) {
  const link = "inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low";
  return (
    <span className="flex flex-wrap gap-2">
      {p.phone && <a className={link} href={`tel:${p.phone}`}><Phone className="h-4 w-4" aria-hidden />{p.phone}</a>}
      {p.whatsapp && <a className={link} href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</a>}
      {p.telegram && <a className={link} href={`https://t.me/${p.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><Send className="h-4 w-4" aria-hidden />@{p.telegram.replace(/^@/, "")}</a>}
    </span>
  );
}

export function FreeBadge({ free }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm ${free ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-surface-container-high text-on-surface-variant"}`}>
      <span className={`h-2 w-2 rounded-full ${free ? "bg-emerald-500" : "bg-outline"}`} aria-hidden />
      {free ? t("Ҳоло озод") : t("Банд")}
    </span>
  );
}

function BrigadeCard({ b }) {
  const trade = tradeOf(b.trade);
  return (
    <Link to={`/groups/${b.id}`} className="card group flex h-full flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)]">
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-label-sm text-primary">
          <trade.icon className="h-3.5 w-3.5" aria-hidden />
          {trade.label()}
        </span>
        <FreeBadge free={b.is_free} />
      </span>
      <span className="text-[18px] font-semibold leading-snug [overflow-wrap:anywhere]">{b.name}</span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{b.city}</span>
        <span className="inline-flex items-center gap-1"><UsersRound className="h-4 w-4" aria-hidden />{t("{0} нафар", b.size)}</span>
        {b.experience_years != null && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />{t("{0} сол таҷриба", b.experience_years)}</span>}
      </span>
      {b.price_note && <span className="inline-flex items-center gap-1.5 text-body-sm font-medium"><Wallet className="h-4 w-4 text-primary" aria-hidden />{b.price_note}</span>}
      {b.description && <p className="line-clamp-3 text-body-sm text-on-surface-variant [overflow-wrap:anywhere]">{b.description}</p>}
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-label-md text-on-surface-variant">
        {b.rating != null ? (
          <span className="inline-flex items-center gap-1.5"><Stars value={b.rating} size="h-3.5 w-3.5" />{b.rating} ({b.reviews})</span>
        ) : (
          <span>{t("Ҳоло баҳо нест")}</span>
        )}
        {b.jobs_done > 0 && <span>· {t("{0} кор иҷро шуд", b.jobs_done)}</span>}
        <span className="ml-auto">{t("Сардор: {0}", b.leader)}</span>
      </span>
    </Link>
  );
}

export function BrigadeForm({ open, brigade, onClose, onSaved }) {
  const empty = { name: "", trade: "repair", city: "", size: "", experience_years: "", price_note: "", description: "", phone: "", whatsapp: "", telegram: "", is_free: true };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(brigade ? Object.fromEntries(Object.keys(empty).map((k) => [k, brigade[k] ?? ""])) : empty);
  }, [open, brigade]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const digits = (key, n) => (e) => set(key)(e.target.value.replace(/\D/g, "").slice(0, n));
  const err = (key) => error?.data?.[key];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, size: Number(form.size), experience_years: form.experience_years === "" ? null : Number(form.experience_years) };
      onSaved(await api(brigade ? `/brigades/${brigade.id}/` : "/brigades/", { method: brigade ? "PATCH" : "POST", body }));
    } catch (er) {
      setError(er);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Drawer open={open} onClose={onClose} title={brigade ? t("Тағйири гурӯҳ") : t("Гурӯҳи нав")} subtitle={t("Сардори гурӯҳ шумо мешавед. Устоҳои дигар метавонанд дархост фиристанд ва шумо онҳоро қабул мекунед.")} icon={Users}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label={t("Номи гурӯҳ")} required error={err("name")}>
          <input className="input" maxLength={120} value={form.name} onChange={set("name")} placeholder={t("Масалан: Гурӯҳи Саид — таъмири хона")} />
        </Field>
        <Field label={t("Кор")} required error={err("trade")}>
          <div className="flex flex-wrap gap-2">
            {TRADES.map((x) => (
              <button key={x.value} type="button" onClick={() => set("trade")(x.value)} aria-pressed={form.trade === x.value} className={chip(form.trade === x.value)}>
                <x.icon className="h-4 w-4" aria-hidden />
                {x.label()}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Шаҳр")} required error={err("city")}>
            <CityInput className="input" value={form.city} onChange={set("city")} placeholder="Москва" />
          </Field>
          <Field label={t("Чанд нафар")} required error={err("size")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.size} onChange={digits("size", 3)} placeholder="5" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Таҷриба, сол")} error={err("experience_years")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.experience_years} onChange={digits("experience_years", 2)} placeholder="5" />
          </Field>
          <Field label={t("Нарх")} error={err("price_note")}>
            <input className="input" maxLength={120} value={form.price_note} onChange={set("price_note")} placeholder={t("аз 1500 ₽ барои 1 м²")} />
          </Field>
        </div>
        <Field label={t("Дар бораи гурӯҳ")} error={err("description")}>
          <textarea className="input min-h-[110px] resize-y" rows={4} maxLength={2000} value={form.description} onChange={set("description")} placeholder={t("Чӣ кор мекунед, асбобҳо доред ё не, дар кадом ноҳияҳо кор мекунед.")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("Телефон")} error={err("phone")}>
            <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+7 999 123-45-67" />
          </Field>
          <Field label="WhatsApp" error={err("whatsapp")}>
            <input className="input" type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+7 999 123-45-67" />
          </Field>
          <Field label="Telegram" error={err("telegram")}>
            <input className="input" value={form.telegram} onChange={set("telegram")} placeholder="@username" />
          </Field>
        </div>
        <Switch checked={!!form.is_free} onChange={set("is_free")} icon={CheckCircle2} title={t("Ҳоло озод ҳастем")} text={t("Гурӯҳҳои озод дар рӯйхат аввал нишон дода мешаванд.")} />
        <ErrorBox error={error && !Object.keys(empty).some((k) => error.data?.[k]) ? error : null} />
        <Button type="submit" loading={busy} icon={Send} disabled={form.name.trim().length < 3 || !form.city.trim() || !form.size}>{brigade ? t("Нигоҳ доштан") : t("Сохтани гурӯҳ")}</Button>
      </form>
    </Drawer>,
    document.body,
  );
}

function OrderCard({ o, onChange }) {
  const [busy, setBusy] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (er) {
      setError(er);
    } finally {
      setBusy("");
    }
  };
  const status = (value) => run(value, () => api(`/brigades/orders/${o.id}/`, { method: "PATCH", body: { status: value } }));
  const cancel = () => window.confirm(t("Фармоишро бекор кунем?")) && run("cancel", () => api(`/brigades/orders/${o.id}/`, { method: "DELETE" }));
  const review = () => run("review", () => api(`/brigades/orders/${o.id}/review/`, { method: "POST", body: { rating, text } }));
  const small = "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low disabled:opacity-50";

  return (
    <article className="card flex flex-col gap-3 p-5">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/groups/${o.brigade.id}`} className="text-label-lg font-semibold hover:underline">{o.brigade.name}</Link>
        <span className={`rounded-full px-2.5 py-1 text-label-sm ${STATUS_TONES[o.status]}`}>{t(o.status_label)}</span>
      </span>
      <p className="whitespace-pre-line text-body-md [overflow-wrap:anywhere]">{o.description}</p>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
        {o.city && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{o.city}</span>}
        {o.start_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />{fmtDate(o.start_date)}</span>}
        {o.workers && <span className="inline-flex items-center gap-1"><UsersRound className="h-4 w-4" aria-hidden />{t("{0} нафар", o.workers)}</span>}
        {o.budget != null && <span className="inline-flex items-center gap-1"><Wallet className="h-4 w-4" aria-hidden />{rub(o.budget)}</span>}
      </span>
      <span className="text-label-md text-on-surface-variant">
        {o.incoming ? t("Фармоишгар: {0}", o.customer) : t("Фиристода шуд")} · {ago(o.created_at)}
      </span>
      {o.incoming && o.phone && <Contacts p={{ phone: o.phone }} />}
      <ErrorBox error={error} />
      <span className="flex flex-wrap gap-2">
        {o.incoming && o.status === "new" && (
          <>
            <Button icon={Check} loading={busy === "accepted"} onClick={() => status("accepted")}>{t("Қабул кардан")}</Button>
            <button type="button" className={small} disabled={!!busy} onClick={() => status("declined")}><X className="h-4 w-4" aria-hidden />{t("Рад кардан")}</button>
          </>
        )}
        {o.incoming && o.status === "accepted" && (
          <>
            <Button icon={CheckCircle2} loading={busy === "done"} onClick={() => status("done")}>{t("Кор тамом шуд")}</Button>
            <button type="button" className={small} disabled={!!busy} onClick={() => status("declined")}><X className="h-4 w-4" aria-hidden />{t("Бекор кардан")}</button>
          </>
        )}
        {!o.incoming && o.status === "new" && (
          <button type="button" className={`${small} text-error`} disabled={!!busy} onClick={cancel}><X className="h-4 w-4" aria-hidden />{t("Бекор кардан")}</button>
        )}
      </span>
      {o.can_review && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4">
          <span className="text-label-lg">{t("Ба кори гурӯҳ баҳо диҳед")}</span>
          <StarPicker value={rating} onChange={setRating} />
          <textarea className="input min-h-[72px] resize-y" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Кор чӣ хел шуд? Сари вақт ва тоза буд?")} />
          <Button icon={Star} loading={busy === "review"} disabled={!rating} onClick={review} className="self-start">{t("Баҳо додан")}</Button>
        </div>
      )}
      {o.reviewed && !o.incoming && <span className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />{t("Шумо баҳо додед. Ташаккур!")}</span>}
    </article>
  );
}

function Orders({ summary, onChange }) {
  const [box, setBox] = useState(summary?.leads ? "in" : "out");
  const { data, error, loading, reload } = useApi(`/brigades/orders/?page_size=50&box=${box}`);
  const changed = () => {
    reload();
    onChange();
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setBox("in")} aria-pressed={box === "in"} className={chip(box === "in")}>
          <Inbox className="h-4 w-4" aria-hidden />
          {t("Ба гурӯҳи ман")}
          {summary?.incoming_new > 0 && <span className="rounded-full bg-error px-1.5 text-label-sm tabular-nums text-on-error">{summary.incoming_new}</span>}
        </button>
        <button type="button" onClick={() => setBox("out")} aria-pressed={box === "out"} className={chip(box === "out")}>
          <Send className="h-4 w-4" aria-hidden />
          {t("Фармоишҳои ман")}
        </button>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : data?.results?.length ? (
        <div className="grid gap-4 md:grid-cols-2">{data.results.map((o) => <OrderCard key={o.id} o={o} onChange={changed} />)}</div>
      ) : (
        <EmptyState icon={Handshake} title={t("Ҳоло фармоиш нест")} text={box === "in" ? t("Вақте касе гурӯҳи шуморо ба кор даъват кунад, фармоиш дар ин ҷо пайдо мешавад.") : t("Гурӯҳро интихоб кунед ва тугмаи «Ба кор даъват кардан»-ро пахш кунед.")} />
      )}
    </div>
  );
}

export default function Brigades() {
  const lang = useLang();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "";
  const trade = params.get("trade") || "";
  const free = params.get("free") === "true";
  const [city, setCity] = useState(params.get("city") || "");
  const [formOpen, setFormOpen] = useState(false);
  const { data: summary, reload: reloadSummary } = useApi("/brigades/summary/");

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (city.trim()) next.set("city", city.trim());
      else next.delete("city");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 400);
    return () => clearTimeout(id);
  }, [city]);

  const q = (key) => params.get(key) ? `&${key}=${encodeURIComponent(params.get(key))}` : "";
  const path = tab === "orders" ? null : `/brigades/?page_size=12${trade ? `&trade=${trade}` : ""}${free ? "&free=true" : ""}${tab === "mine" ? "&mine=true" : ""}${q("city")}`;
  const first = useApi(path);
  const [extra, setExtra] = useState({ results: [], next: undefined });
  const [busy, setBusy] = useState(false);
  useEffect(() => setExtra({ results: [], next: undefined }), [path, lang]);

  const next = extra.next === undefined ? first.data?.next : extra.next;
  const items = [...(first.data?.results || []), ...extra.results];
  const more = async () => {
    setBusy(true);
    const data = await api(next.slice(next.indexOf("/api") + 4)).catch(() => null);
    if (data) setExtra((e) => ({ results: [...e.results, ...data.results], next: data.next }));
    setBusy(false);
  };

  const saved = () => {
    setFormOpen(false);
    update("tab", "mine");
    first.reload();
    reloadSummary();
  };

  const counts = Object.fromEntries((summary?.trades || []).map((x) => [x.value, x.count]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Устоҳои ҳамватан")} title={t("Кори гурӯҳӣ")} text={t("Устоҳо якҷоя гурӯҳ месозанд, фармоишгар тамоми гурӯҳро якбора ба кор мегирад. Бе миёнарав ва бе фоиз.")} icon={Users}>
        <div className="flex flex-wrap gap-2">
          {summary && (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md tabular-nums ring-1 ring-inset ring-outline-variant">
              <Users className="h-4 w-4 text-primary" aria-hidden />
              {t("{0} гурӯҳ, {1} озод", summary.total, summary.free)}
            </span>
          )}
          <Button icon={Plus} onClick={() => setFormOpen(true)}>{t("Гурӯҳ сохтан")}</Button>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setFormOpen(true)} className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#1447a8] to-[#0d2f73] p-5 text-left text-white shadow-[0_18px_40px_-24px_rgb(16_36_84/0.6)] transition-transform hover:-translate-y-0.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><HardHat className="h-6 w-6" aria-hidden /></span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-headline-sm">{t("Устоед? Гурӯҳ созед")}</span>
            <span className="text-body-sm text-white/75">{t("Дӯстонатонро ҷамъ кунед ва фармоишҳои калон гиред")}</span>
          </span>
          <Plus className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-90" aria-hidden />
        </button>
        <button type="button" onClick={() => { update("tab", ""); update("free", "true"); }} className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#0f7a55] to-[#09503a] p-5 text-left text-white shadow-[0_18px_40px_-24px_rgb(9_80_58/0.6)] transition-transform hover:-translate-y-0.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Handshake className="h-6 w-6" aria-hidden /></span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-headline-sm">{t("Гурӯҳ лозим аст?")}</span>
            <span className="text-body-sm text-white/75">{t("Гурӯҳҳои озодро бинед ва ба кор даъват кунед")}</span>
          </span>
          <Check className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => update("tab", "")} aria-pressed={!tab} className={chip(!tab)}>{t("Ҳамаи гурӯҳҳо")}</button>
        <button type="button" onClick={() => update("tab", "mine")} aria-pressed={tab === "mine"} className={chip(tab === "mine")}>{t("Гурӯҳҳои ман")}</button>
        <button type="button" onClick={() => update("tab", "orders")} aria-pressed={tab === "orders"} className={chip(tab === "orders")}>
          <Handshake className="h-4 w-4" aria-hidden />
          {t("Фармоишҳо")}
          {summary?.incoming_new > 0 && <span className="rounded-full bg-error px-1.5 text-label-sm tabular-nums text-on-error">{summary.incoming_new}</span>}
        </button>
      </div>

      {tab === "orders" ? (
        summary ? <Orders summary={summary} onChange={reloadSummary} /> : <Skeleton className="h-48" />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => update("trade", "")} aria-pressed={!trade} className={chip(!trade)}>{t("Ҳама корҳо")}</button>
              {TRADES.map((x) => (
                <button key={x.value} type="button" onClick={() => update("trade", trade === x.value ? "" : x.value)} aria-pressed={trade === x.value} className={chip(trade === x.value)}>
                  <x.icon className="h-4 w-4" aria-hidden />
                  {x.label()}
                  {counts[x.value] > 0 && <span className="tabular-nums opacity-60">{counts[x.value]}</span>}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Шаҳр")}>
                <CityInput className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("Ҳама шаҳрҳо")} />
              </Field>
              <div className="flex items-end">
                <Switch checked={free} onChange={(v) => update("free", v ? "true" : "")} icon={CheckCircle2} title={t("Танҳо озодҳо")} text={t("Гурӯҳҳое, ки ҳоло кор қабул мекунанд")} />
              </div>
            </div>
          </div>

          <ErrorBox error={first.error} />
          {first.loading && !first.data ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}</div>
          ) : items.length ? (
            <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => (
                <StaggerItem key={b.id} className="h-full">
                  <BrigadeCard b={b} />
                </StaggerItem>
              ))}
            </Stagger>
          ) : (
            <EmptyState icon={Users} title={tab === "mine" ? t("Шумо ҳоло дар гурӯҳ нестед") : t("Гурӯҳ ёфт нашуд")} text={t("Аввалин шуда гурӯҳ созед — фармоишгарон шуморо меёбанд.")}>
              <Button icon={Plus} onClick={() => setFormOpen(true)}>{t("Гурӯҳ сохтан")}</Button>
            </EmptyState>
          )}
          {next && <Button variant="plain" loading={busy} onClick={more} className="self-center">{t("Боз нишон додан")}</Button>}
        </>
      )}

      <BrigadeForm open={formOpen} brigade={null} onClose={() => setFormOpen(false)} onSaved={saved} />
    </div>
  );
}

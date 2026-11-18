import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CalendarDays, MessageCircle, Package, PackagePlus, Phone, Plane, Plus, Scale, Send, Trash2, Wallet,
} from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t, useLang } from "../i18n.js";
import { date as fmtDate, rub } from "../format.js";
import CityInput from "../components/CityInput.jsx";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

const KINDS = [
  { value: "carry", icon: Plane, label: () => t("Мебарам"), long: () => t("Ба Ватан меравам — посылка мебарам") },
  { value: "send", icon: Package, label: () => t("Мефиристам"), long: () => t("Посылка дорам — касеро меҷӯям") },
];
const kindOf = (value) => KINDS.find((k) => k.value === value) || KINDS[0];

const TIPS = [
  () => t("Посылкаро пеш аз гирифтан кушоед ва бинед. Бастаи пӯшидаи бегонаро набаред — дар гумрук ҷавобгар шумо мешавед."),
  () => t("Дору, пул, ҳуҷҷатҳо, телефонҳои зиёд ва чизҳои манъшударо набаред."),
  () => t("Пулро баъд аз расидани посылка диҳед ё нисфашро пеш, нисфашро баъд."),
  () => t("Рақам ва номи гирандаро дар Ватан пешакӣ санҷед."),
];

const chip = (on) => `inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full px-4 text-label-md ring-1 ring-inset transition-colors ${on ? "bg-ink text-on-ink ring-ink" : "bg-surface-container-lowest ring-outline-variant hover:bg-surface-container-low"}`;

const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

function Contacts({ p }) {
  const link = "inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low";
  return (
    <span className="flex flex-wrap gap-2">
      {p.phone && <a className={link} href={`tel:${p.phone}`}><Phone className="h-4 w-4" aria-hidden />{p.phone}</a>}
      {p.whatsapp && <a className={link} href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</a>}
      {p.telegram && <a className={link} href={`https://t.me/${p.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><Send className="h-4 w-4" aria-hidden />{p.telegram}</a>}
    </span>
  );
}

function ParcelCard({ p, onDelete }) {
  const kind = kindOf(p.kind);
  const remove = async () => {
    if (!window.confirm(t("Эълонро нест кунем?"))) return;
    await api(`/parcels/${p.id}/`, { method: "DELETE" });
    onDelete(p);
  };
  return (
    <article className="card flex h-full flex-col gap-3 p-5">
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm ${p.kind === "carry" ? "bg-primary-fixed text-primary" : "bg-tertiary-fixed text-on-tertiary-fixed"}`}>
          <kind.icon className="h-3.5 w-3.5" aria-hidden />
          {kind.label()}
        </span>
        <span className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant">
          <CalendarDays className="h-4 w-4" aria-hidden />
          {fmtDate(p.travel_date)}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-[18px] font-semibold leading-snug">
        {p.from_city}
        <ArrowRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
        {p.to_city}
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
        {p.weight_kg && <span className="inline-flex items-center gap-1"><Scale className="h-4 w-4" aria-hidden />{p.kind === "carry" ? t("то {0} кг", p.weight_kg) : t("{0} кг", p.weight_kg)}</span>}
        {p.price_per_kg != null && <span className="inline-flex items-center gap-1"><Wallet className="h-4 w-4" aria-hidden />{t("{0} барои 1 кг", rub(p.price_per_kg))}</span>}
      </span>
      {p.description && <p className="whitespace-pre-line text-body-sm [overflow-wrap:anywhere]">{p.description}</p>}
      <span className="mt-auto flex flex-col gap-3 pt-1">
        <span className="text-label-md text-on-surface-variant">{p.name}</span>
        <Contacts p={p} />
        {p.can_delete && (
          <button type="button" onClick={remove} className="inline-flex min-h-[36px] items-center gap-1.5 self-start rounded-lg px-3 text-label-md text-error hover:bg-error-container/50">
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("Нест кардан")}
          </button>
        )}
      </span>
    </article>
  );
}

function ParcelForm({ open, kind, tjCities, onClose, onSaved }) {
  const empty = { kind, from_city: "", to_city: "", travel_date: "", weight_kg: "", price_per_kg: "", description: "", phone: "", whatsapp: "", telegram: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setError(null);
    }
  }, [open, kind]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const digits = (key, n) => (e) => set(key)(e.target.value.replace(/\D/g, "").slice(0, n));
  const err = (key) => error?.data?.[key];
  const carry = form.kind === "carry";

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form, weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg), price_per_kg: form.price_per_kg === "" ? null : Number(form.price_per_kg) };
      onSaved(await api("/parcels/", { method: "POST", body }));
    } catch (er) {
      setError(er);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Drawer open={open} onClose={onClose} title={t("Эълони посылка")} subtitle={t("Эълон фавран ба ҳама намоён мешавад ва баъди сана худаш пинҳон мешавад.")} icon={PackagePlus}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => set("kind")(k.value)} aria-pressed={form.kind === k.value} className={`flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-left text-label-md ring-1 ring-inset transition-colors ${form.kind === k.value ? "bg-ink text-on-ink ring-ink" : "ring-outline-variant hover:bg-surface-container-low"}`}>
              <k.icon className="h-4 w-4 shrink-0" aria-hidden />
              {k.long()}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Аз (Русия)")} required error={err("from_city")}>
            <CityInput className="input" value={form.from_city} onChange={set("from_city")} placeholder="Москва" />
          </Field>
          <Field label={t("Ба (Тоҷикистон)")} required error={err("to_city")}>
            <CityInput className="input" value={form.to_city} onChange={set("to_city")} options={tjCities} placeholder="Душанбе" />
          </Field>
        </div>
        <Field label={carry ? t("Санаи парвоз ё роҳ") : t("То кай фиристодан лозим")} required error={err("travel_date")}>
          <input className="input" type="date" min={today()} value={form.travel_date} onChange={set("travel_date")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={carry ? t("То чанд кг мебарам") : t("Вазн, кг")} error={err("weight_kg")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.weight_kg} onChange={digits("weight_kg", 3)} placeholder="10" />
          </Field>
          <Field label={carry ? t("Нарх барои 1 кг, ₽") : t("Пешниҳоди нарх барои 1 кг, ₽")} error={err("price_per_kg")}>
            <input className="input tabular-nums" inputMode="numeric" value={form.price_per_kg} onChange={digits("price_per_kg", 6)} placeholder="500" />
          </Field>
        </div>
        <Field label={t("Тавсиф")} error={err("description")}>
          <textarea className="input min-h-[96px] resize-y" rows={3} maxLength={1000} value={form.description} onChange={set("description")} placeholder={carry ? t("Масалан: Либос ва тӯҳфа мебарам, дору ва ҳуҷҷат не. Дар Москва аз метро Люблино мегирам.") : t("Масалан: Либоси кӯдакона, 5 кг. Гиранда дар Хуҷанд.")} />
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
        <ErrorBox error={error && !Object.keys(empty).some((k) => error.data?.[k]) ? error : null} />
        <Button type="submit" loading={busy} icon={Send} disabled={!form.from_city.trim() || !form.to_city.trim() || !form.travel_date}>{t("Фиристодан")}</Button>
      </form>
    </Drawer>,
    document.body,
  );
}

export default function Parcels() {
  const lang = useLang();
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") || "";
  const mine = params.get("tab") === "mine";
  const [toCity, setToCity] = useState(params.get("to_city") || "");
  const [fromCity, setFromCity] = useState(params.get("from_city") || "");
  const [formKind, setFormKind] = useState(null);
  const { data: summary, reload: reloadSummary } = useApi("/parcels/summary/");
  const tjCities = summary?.tj_cities || [];

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      for (const [key, value] of [["to_city", toCity.trim()], ["from_city", fromCity.trim()]]) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 400);
    return () => clearTimeout(id);
  }, [toCity, fromCity]);

  const q = (key) => params.get(key) ? `&${key}=${encodeURIComponent(params.get(key))}` : "";
  const path = `/parcels/?page_size=12${kind ? `&kind=${kind}` : ""}${mine ? "&mine=true" : ""}${q("to_city")}${q("from_city")}`;
  const first = useApi(path);
  const [extra, setExtra] = useState({ results: [], next: undefined, removed: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => setExtra({ results: [], next: undefined, removed: [] }), [path, lang]);

  const next = extra.next === undefined ? first.data?.next : extra.next;
  const items = [...(first.data?.results || []), ...extra.results].filter((p) => !extra.removed.includes(p.id));
  const more = async () => {
    setBusy(true);
    const data = await api(next.slice(next.indexOf("/api") + 4)).catch(() => null);
    if (data) setExtra((e) => ({ ...e, results: [...e.results, ...data.results], next: data.next }));
    setBusy(false);
  };

  const saved = () => {
    setFormKind(null);
    first.reload();
    reloadSummary();
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Аз ҳамватанон барои ҳамватанон")} title={t("Посылка ба Ватан")} text={t("Касе, ки ба Тоҷикистон меравад, посылкаи шуморо мебарад. Ё худ меравед — эълон диҳед ва бо роҳ пул кор кунед.")} icon={Package}>
        <div className="flex flex-wrap gap-2">
          {summary && (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md tabular-nums ring-1 ring-inset ring-outline-variant">
              <Package className="h-4 w-4 text-primary" aria-hidden />
              {t("{0} эълон", summary.total)}
            </span>
          )}
          <Button icon={Plus} onClick={() => setFormKind("send")}>{t("Эълон додан")}</Button>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => setFormKind(k.value)} className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#1447a8] to-[#0d2f73] p-5 text-left text-white shadow-[0_18px_40px_-24px_rgb(16_36_84/0.6)] transition-transform hover:-translate-y-0.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <k.icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-headline-sm">{k.long()}</span>
              <span className="text-body-sm text-white/75">{k.value === "carry" ? t("Сана, шаҳр ва чанд кг гирифта метавонед") : t("Аз куҷо, ба куҷо ва то кай")}</span>
            </span>
            <Plus className="h-5 w-5 shrink-0 transition-transform group-hover:rotate-90" aria-hidden />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => { update("tab", ""); update("kind", ""); }} aria-pressed={!kind && !mine} className={chip(!kind && !mine)}>{t("Ҳама")}</button>
          {KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => update("kind", kind === k.value ? "" : k.value)} aria-pressed={kind === k.value} className={chip(kind === k.value)}>
              <k.icon className="h-4 w-4" aria-hidden />
              {k.label()}
              {summary?.kinds?.[k.value] > 0 && <span className="tabular-nums opacity-60">{summary.kinds[k.value]}</span>}
            </button>
          ))}
          <button type="button" onClick={() => update("tab", mine ? "" : "mine")} aria-pressed={mine} className={chip(mine)}>{t("Эълонҳои ман")}</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Аз (Русия)")}>
            <CityInput className="input" value={fromCity} onChange={(e) => setFromCity(e.target.value)} placeholder={t("Ҳама шаҳрҳо")} />
          </Field>
          <Field label={t("Ба (Тоҷикистон)")}>
            <CityInput className="input" value={toCity} onChange={(e) => setToCity(e.target.value)} options={tjCities} placeholder={t("Ҳама шаҳрҳо")} />
          </Field>
        </div>
      </div>

      <ErrorBox error={first.error} />
      {first.loading && !first.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : items.length ? (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <StaggerItem key={p.id} className="h-full">
              <ParcelCard p={p} onDelete={(x) => { setExtra((e) => ({ ...e, removed: [...e.removed, x.id] })); reloadSummary(); }} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <EmptyState icon={Package} title={t("Ҳоло эълон нест")} text={t("Аввалин шуда эълон диҳед — ҳамватанон мебинанд.")}>
          <Button icon={Plus} onClick={() => setFormKind("carry")}>{t("Эълон додан")}</Button>
        </EmptyState>
      )}
      {next && <Button variant="plain" loading={busy} onClick={more} className="self-center">{t("Боз нишон додан")}</Button>}

      <section className="card flex flex-col gap-3 p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold">
          <AlertTriangle className="h-5 w-5 text-error" aria-hidden />
          {t("Эҳтиёт бошед")}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm text-on-surface-variant">
          {TIPS.map((tip, i) => <li key={i}>{tip()}</li>)}
        </ul>
      </section>

      <ParcelForm open={formKind !== null} kind={formKind || "send"} tjCities={tjCities} onClose={() => setFormKind(null)} onSaved={saved} />
    </div>
  );
}

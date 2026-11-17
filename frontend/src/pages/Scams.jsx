import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Building2, CreditCard, Globe, HelpCircle, LogIn, Phone, Plus, Search, Send, ShieldAlert, ShieldCheck, X,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t, useLang } from "../i18n.js";
import { ago, rub } from "../format.js";
import { CITIES } from "../constants.js";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/motion.jsx";

const KINDS = [
  { value: "phone", label: () => t("Рақами телефон"), icon: Phone, placeholder: "+7 999 123-45-67" },
  { value: "telegram", label: () => t("Telegram"), icon: Send, placeholder: "@patent_tez" },
  { value: "website", label: () => t("Сайт"), icon: Globe, placeholder: "patent-tez.ru" },
  { value: "card", label: () => t("Корти бонкӣ"), icon: CreditCard, placeholder: "2202 2000 0000 0000" },
  { value: "office", label: () => t("Идора ё шахс"), icon: Building2, placeholder: () => t("Номи идора, суроға ё ном") },
  { value: "other", label: () => t("Дигар"), icon: HelpCircle, placeholder: "" },
];

const SCHEMES = [
  { value: "patent", label: () => t("Патент ва ҳуҷҷатҳо") },
  { value: "job", label: () => t("Кор") },
  { value: "housing", label: () => t("Манзил") },
  { value: "tickets", label: () => t("Чипта") },
  { value: "money", label: () => t("Интиқоли пул ва қарз") },
  { value: "ban", label: () => t("«Бекор кардани манъ»") },
  { value: "other", label: () => t("Дигар") },
];

const TIPS = [
  { title: () => t("«Патенти тез» бе навбат"), text: () => t("Патентро танҳо ММЦ медиҳад. Касе, ки «бе имтиҳон» ё «дар як рӯз» ваъда медиҳад ва пешакӣ пул мегирад, қаллоб аст.") },
  { title: () => t("Пул барои кор"), text: () => t("Корфармои ҳақиқӣ барои ҷойи кор, либос ё «бақайдгирӣ» пешакӣ пул намегирад.") },
  { title: () => t("Пешпардохт барои манзил"), text: () => t("То хонаро бо чашми худ надида ва шартнома имзо накарда, ба корт пул нагузаронед.") },
  { title: () => t("«Манъи даромаданро бекор мекунем»"), text: () => t("Манъро танҳо суд ё МВД бекор мекунад. Ҳеҷ кас онро бо пул «тоза» карда наметавонад.") },
  { title: () => t("Чиптаи арзон дар Telegram"), text: () => t("Чиптаро танҳо дар сайти ширкати ҳавопаймоӣ ё агентии маълум харед. Рақами чиптаро дар сайти ширкат санҷед.") },
  { title: () => t("Рамз аз SMS"), text: () => t("Рамзи SMS, CVV ва пароли бонкро ба ҳеҷ кас нагӯед — ҳатто агар худро «корманди бонк» ё «полис» номад.") },
];

const kindOf = (value) => KINDS.find((k) => k.value === value) || KINDS[KINDS.length - 1];
const schemeLabel = (value) => (SCHEMES.find((s) => s.value === value) || SCHEMES[SCHEMES.length - 1]).label();

function ScamCard({ scam }) {
  const kind = kindOf(scam.kind);
  return (
    <article className="card flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container">
          <kind.icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="break-all text-[17px] font-semibold leading-snug">{scam.value}</span>
          <span className="text-label-md text-on-surface-variant">{kind.label()} · {schemeLabel(scam.scheme)}</span>
        </span>
      </div>
      <p className="whitespace-pre-line text-body-sm text-on-surface">{scam.description}</p>
      <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-label-md text-on-surface-variant">
        {scam.city && <span>{scam.city}</span>}
        {scam.lost_amount ? <span className="text-error">{t("Зарар: {0}", rub(scam.lost_amount))}</span> : null}
        {scam.reports > 1 && <span className="font-semibold text-error">{t("{0} огоҳӣ", scam.reports)}</span>}
        <span>{ago(scam.created_at)}</span>
      </p>
    </article>
  );
}

function Checker() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const check = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult({ q, ...(await api(`/scams/check/?q=${encodeURIComponent(q)}`)) });
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex flex-col gap-5 p-5 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold">{t("Пеш аз пардохт санҷед")}</h2>
        <p className="text-body-sm text-on-surface-variant">{t("Рақами телефон, Telegram, сайт ё рақами кортро нависед — мо дар огоҳиҳои тасдиқшуда меҷӯем.")}</p>
      </div>
      <form onSubmit={check} className="flex flex-col gap-3 sm:flex-row">
        <span className="relative block flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <input className="input pl-11" value={q} onChange={(e) => { setQ(e.target.value); setResult(null); }} placeholder={t("Масалан: +7 999 123-45-67 ё @patent_tez")} />
        </span>
        <Button type="submit" loading={busy} disabled={q.trim().length < 4} icon={ShieldCheck}>{t("Санҷидан")}</Button>
      </form>
      <ErrorBox error={error} />
      {result && (result.found ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-xl bg-error-container p-4 text-body-md font-semibold text-on-error-container">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            {t("Диққат! Дар бораи «{0}» {1} огоҳӣ ҳаст. Пул нагузаронед.", result.q, result.count)}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {result.results.map((s) => <ScamCard key={s.id} scam={s} />)}
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-tertiary-fixed p-4 text-body-sm text-on-tertiary-fixed">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {t("Дар рӯйхати мо огоҳӣ нест. Ин кафолат нест — пешакӣ пул нагузаронед ва ҳуҷҷатҳоро санҷед.")}
        </p>
      ))}
    </section>
  );
}

function ReportForm({ onSent }) {
  const [form, setForm] = useState({ kind: "phone", value: "", scheme: "patent", description: "", city: "", lost_amount: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const kind = kindOf(form.kind);
  const placeholder = typeof kind.placeholder === "function" ? kind.placeholder() : kind.placeholder;

  const send = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/scams/", { method: "POST", body: { ...form, lost_amount: form.lost_amount === "" ? null : Number(form.lost_amount) } });
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name) => error?.data?.[name];
  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <div>
        <span className="label">{t("Чиро хабар медиҳед?")}</span>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => set("kind", k.value)} aria-pressed={form.kind === k.value} className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-label-md ring-1 ring-inset transition-colors ${form.kind === k.value ? "bg-ink text-on-ink ring-ink" : "ring-outline-variant hover:bg-surface-container-low"}`}>
              <k.icon className="h-4 w-4 shrink-0" aria-hidden />
              {k.label()}
            </button>
          ))}
        </div>
      </div>
      <Field label={kind.label()} required error={fieldError("value")}>
        <input className="input" value={form.value} maxLength={200} onChange={(e) => set("value", e.target.value)} placeholder={placeholder} />
      </Field>
      <Field label={t("Дар бораи чӣ фиреб доданд?")} error={fieldError("scheme")}>
        <select className="input" value={form.scheme} onChange={(e) => set("scheme", e.target.value)}>
          {SCHEMES.map((s) => <option key={s.value} value={s.value}>{s.label()}</option>)}
        </select>
      </Field>
      <Field label={t("Чӣ шуд?")} required error={fieldError("description")} hint={t("Ақаллан 20 ҳарф. Маълумоти шахсии худро нанависед.")}>
        <textarea className="input min-h-[140px] resize-y" rows={5} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Масалан: барои патенти тез 15 000 рубл гирифт ва дигар ҷавоб намедиҳад.")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Шаҳр")} error={fieldError("city")}>
          <input className="input" value={form.city} maxLength={100} onChange={(e) => set("city", e.target.value)} list="scam-cities" placeholder={t("Масалан: Москва")} />
          <datalist id="scam-cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label={t("Чанд пул гирифтанд (₽)")} error={fieldError("lost_amount")}>
          <input className="input" type="number" min={0} inputMode="numeric" value={form.lost_amount} onChange={(e) => set("lost_amount", e.target.value)} placeholder="15000" />
        </Field>
      </div>
      <ErrorBox error={error && !["value", "description", "city", "lost_amount", "scheme"].some((k) => error.data?.[k]) ? error : null} />
      <p className="text-body-sm text-on-surface-variant">{t("Муҳаррир огоҳиро месанҷад ва баъд нашр мекунад. Номи шумо нишон дода намешавад.")}</p>
      <Button type="submit" loading={saving} disabled={form.value.trim().length < 3 || form.description.trim().length < 20} icon={ShieldAlert}>
        {t("Фиристодан")}
      </Button>
    </form>
  );
}

const STATUS_TEXT = { pending: () => t("Дар санҷиш"), approved: () => t("Нашр шуд"), rejected: () => t("Нашр нашуд") };

function MyReports({ tick }) {
  const { data } = useApi(`/scams/mine/?t=${tick}`);
  if (!data?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[16px] font-semibold">{t("Огоҳиҳои ман")}</h3>
      {data.map((s) => (
        <div key={s.id} className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-3 text-body-sm">
          <p className="flex justify-between gap-2">
            <span className="break-all font-semibold">{s.value}</span>
            <span className="shrink-0 text-on-surface-variant">{STATUS_TEXT[s.status]?.()}</span>
          </p>
          {s.note && <p className="text-on-surface-variant">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}

function ReportDrawer({ open, onClose }) {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (open) setSent(false);
  }, [open]);

  return (
    <Drawer open={open} onClose={onClose} title={t("Хабар додан аз қаллоб")} subtitle={t("Дигаронро аз фиреб наҷот диҳед.")} icon={ShieldAlert}>
      {!user ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body-md text-on-surface-variant">{t("Барои хабар додан ворид шавед — ҷавоби муҳаррирро дар огоҳиҳо мегиред.")}</p>
          <Link to="/login" state={{ from: "/scams" }} onClick={onClose} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-lg text-on-ink">
            <LogIn className="h-4 w-4" aria-hidden />
            {t("Ворид шудан")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sent ? (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-tertiary-fixed p-4 text-on-tertiary-fixed">
              <span className="text-[16px] font-semibold">{t("Ташаккур! Огоҳии шумо расид.")}</span>
              <p className="text-body-sm">{t("Баъди санҷиш онро нашр мекунем ва ба шумо хабар медиҳем.")}</p>
              <Button variant="plain" onClick={() => setSent(false)}>{t("Боз хабар додан")}</Button>
            </div>
          ) : (
            <ReportForm onSent={() => { setSent(true); setTick((n) => n + 1); }} />
          )}
          <MyReports tick={tick} />
        </div>
      )}
    </Drawer>
  );
}

function ScamList() {
  const lang = useLang();
  const [scheme, setScheme] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const path = `/scams/?page_size=12${scheme ? `&scheme=${scheme}` : ""}${query ? `&search=${encodeURIComponent(query)}` : ""}`;
  const first = useApi(path);
  const [extra, setExtra] = useState({ results: [], next: undefined });
  const [busy, setBusy] = useState(false);

  useEffect(() => setExtra({ results: [], next: undefined }), [path, lang]);
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(id);
  }, [search]);

  const next = extra.next === undefined ? first.data?.next : extra.next;
  const items = [...(first.data?.results || []), ...extra.results];
  const more = async () => {
    setBusy(true);
    const data = await api(next.slice(next.indexOf("/api") + 4)).catch(() => null);
    if (data) setExtra((e) => ({ results: [...e.results, ...data.results], next: data.next }));
    setBusy(false);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="text-[22px] font-semibold">{t("Огоҳиҳои тасдиқшуда")}</h2>
        <span className="relative block md:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <input className="input pl-11" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Ҷустуҷӯ")} />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label={t("Тоза кардан")} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </span>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ value: "", label: () => t("Ҳама") }, ...SCHEMES].map((s) => (
          <button key={s.value} type="button" onClick={() => setScheme(s.value)} aria-pressed={scheme === s.value} className={`flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-xl px-4 text-label-md transition-colors ${scheme === s.value ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
            {s.label()}
          </button>
        ))}
      </div>
      <ErrorBox error={first.error} />
      {first.loading && !first.data ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("Ҳоло огоҳӣ нест")} text={t("Агар шуморо фиреб дода бошанд, хабар диҳед — дигарон эҳтиёт мешаванд.")} />
      ) : (
        <Stagger inView className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <StaggerItem key={s.id}>
              <ScamCard scam={s} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
      {next && <Button variant="plain" loading={busy} onClick={more} className="self-center">{t("Боз нишон додан")}</Button>}
    </section>
  );
}

export default function Scams() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Бехатарӣ")} title={t("Огоҳӣ аз қаллобон")} text={t("Рақамҳо, каналҳо ва «идораҳо»-е, ки муҳоҷиронро фиреб доданд. Пеш аз пардохт санҷед.")} icon={ShieldAlert}>
        <Button icon={Plus} onClick={() => setOpen(true)}>{t("Хабар додан аз қаллоб")}</Button>
      </PageHeader>
      <Reveal>
        <Checker />
      </Reveal>
      <Reveal>
        <section className="flex flex-col gap-4">
          <h2 className="text-[22px] font-semibold">{t("Қаллобон чӣ тавр фиреб медиҳанд")}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TIPS.map((tip, i) => (
              <div key={i} className="card flex flex-col gap-2 p-5">
                <span className="flex items-center gap-2 text-[16px] font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-error" aria-hidden />
                  {tip.title()}
                </span>
                <p className="text-body-sm text-on-surface-variant">{tip.text()}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
      <ScamList />
      <ReportDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

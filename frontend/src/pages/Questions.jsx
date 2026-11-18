import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Banknote, CheckCircle2, FileText, HeartPulse, HelpCircle, Home, MapPin, MessageCircle, MessagesSquare, Plane, Plus, Search, Send, Briefcase, Sparkles,
} from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t, useLang } from "../i18n.js";
import { ago } from "../format.js";
import CityInput from "../components/CityInput.jsx";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

export const TOPICS = [
  { value: "documents", icon: FileText, label: () => t("Ҳуҷҷатҳо ва патент") },
  { value: "work", icon: Briefcase, label: () => t("Кор ва маош") },
  { value: "housing", icon: Home, label: () => t("Манзил") },
  { value: "health", icon: HeartPulse, label: () => t("Саломатӣ") },
  { value: "money", icon: Banknote, label: () => t("Пул ва интиқол") },
  { value: "travel", icon: Plane, label: () => t("Роҳ ва чипта") },
  { value: "life", icon: Sparkles, label: () => t("Зиндагӣ дар Русия") },
  { value: "other", icon: HelpCircle, label: () => t("Дигар") },
];

export const topicOf = (value) => TOPICS.find((x) => x.value === value) || TOPICS[TOPICS.length - 1];

const SHOW = [
  { value: "", label: () => t("Ҳама") },
  { value: "unanswered", label: () => t("Бе ҷавоб") },
  { value: "solved", label: () => t("Ҳалшуда") },
  { value: "mine", label: () => t("Саволҳои ман") },
];

const chip = (on) => `inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full px-4 text-label-md ring-1 ring-inset transition-colors ${on ? "bg-ink text-on-ink ring-ink" : "bg-surface-container-lowest ring-outline-variant hover:bg-surface-container-low"}`;

function QuestionCard({ q }) {
  const topic = topicOf(q.topic);
  return (
    <Link to={`/questions/${q.id}`} className="card group flex h-full flex-col gap-3 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)]">
      <span className="flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface">
          <topic.icon className="h-3.5 w-3.5" aria-hidden />
          {topic.label()}
        </span>
        {q.solved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-on-tertiary-fixed">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {t("Ҳалшуда")}
          </span>
        )}
      </span>
      <span className="text-[17px] font-semibold leading-snug [overflow-wrap:anywhere] group-hover:text-primary">{q.title}</span>
      {q.body && <span className="line-clamp-2 text-body-sm text-on-surface-variant [overflow-wrap:anywhere]">{q.body}</span>}
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-label-md text-on-surface-variant">
        <span className={`inline-flex items-center gap-1 ${q.answers_count ? "text-primary" : ""}`}>
          <MessageCircle className="h-4 w-4" aria-hidden />
          {q.answers_count ? t("{0} ҷавоб", q.answers_count) : t("Ҷавоб нест")}
        </span>
        {q.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{q.city}</span>}
        <span>{q.name} · {ago(q.created_at)}</span>
      </span>
    </Link>
  );
}

function AskForm({ open, onClose, onSaved }) {
  const empty = { topic: "documents", title: "", body: "", city: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setError(null);
    }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const err = (key) => error?.data?.[key];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await api("/questions/", { method: "POST", body: form }));
    } catch (er) {
      setError(er);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={t("Савол додан")} subtitle={t("Ҳамватанон ва муҳаррирон ҷавоб медиҳанд. Вақте ҷавоб омад, ба шумо хабар медиҳем.")} icon={MessagesSquare}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {TOPICS.map((x) => (
            <button key={x.value} type="button" onClick={() => set("topic")(x.value)} aria-pressed={form.topic === x.value} className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-left text-label-md ring-1 ring-inset transition-colors ${form.topic === x.value ? "bg-ink text-on-ink ring-ink" : "ring-outline-variant hover:bg-surface-container-low"}`}>
              <x.icon className="h-4 w-4 shrink-0" aria-hidden />
              {x.label()}
            </button>
          ))}
        </div>
        <Field label={t("Савол")} required error={err("title")} hint={t("Кӯтоҳ ва фаҳмо: дар як ҷумла.")}>
          <input className="input" maxLength={150} value={form.title} onChange={set("title")} placeholder={t("Масалан: Патентро дар Москва чанд рӯз месозанд?")} />
        </Field>
        <Field label={t("Тафсилот")} error={err("body")}>
          <textarea className="input min-h-[120px] resize-y" rows={4} maxLength={3000} value={form.body} onChange={set("body")} placeholder={t("Вазъиятро нависед. Рақами ҳуҷҷат, телефон ва маълумоти шахсиро нанависед.")} />
        </Field>
        <Field label={t("Шаҳр")} error={err("city")}>
          <CityInput className="input" value={form.city} maxLength={100} onChange={set("city")} placeholder={t("Масалан: Москва")} />
        </Field>
        <ErrorBox error={error && !["title", "body", "city"].some((k) => error.data?.[k]) ? error : null} />
        <Button type="submit" loading={busy} icon={Send} disabled={form.title.trim().length < 10}>{t("Фиристодан")}</Button>
      </form>
    </Drawer>
  );
}

export default function Questions() {
  const lang = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const topic = params.get("topic") || "";
  const show = params.get("show") || "";
  const [search, setSearch] = useState(params.get("search") || "");
  const [asking, setAsking] = useState(false);
  const { data: summary } = useApi("/questions/summary/");

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("search") || "") !== search.trim()) update("search", search.trim());
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const query = params.get("search") || "";
  const path = `/questions/?page_size=12${topic ? `&topic=${topic}` : ""}${show ? `&show=${show}` : ""}${query ? `&search=${encodeURIComponent(query)}` : ""}`;
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Аз ҳамватанон барои ҳамватанон")} title={t("Саволу ҷавоб")} text={t("Саволи худро диҳед — муҳоҷироне, ки ин роҳро гузаштаанд, ҷавоб медиҳанд. Ҷавоби беҳтаринро савол-диҳанда қайд мекунад.")} icon={MessagesSquare}>
        <div className="flex flex-wrap gap-2">
          {summary && (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md tabular-nums ring-1 ring-inset ring-outline-variant">
              <MessagesSquare className="h-4 w-4 text-primary" aria-hidden />
              {t("{0} савол", summary.total)}
            </span>
          )}
          <Button icon={Plus} onClick={() => setAsking(true)}>{t("Савол додан")}</Button>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <span className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <input className="input pl-11" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Ҷустуҷӯ дар саволҳо ва ҷавобҳо")} />
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SHOW.map((s) => (
            <button key={s.value || "all"} type="button" onClick={() => update("show", s.value)} aria-pressed={show === s.value} className={chip(show === s.value)}>
              {s.label()}
              {s.value === "unanswered" && summary?.unanswered > 0 && <span className="tabular-nums opacity-60">{summary.unanswered}</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TOPICS.map((x) => (
            <button key={x.value} type="button" onClick={() => update("topic", topic === x.value ? "" : x.value)} aria-pressed={topic === x.value} className={chip(topic === x.value)}>
              <x.icon className="h-4 w-4" aria-hidden />
              {x.label()}
              {summary?.topics?.[x.value] > 0 && <span className="tabular-nums opacity-60">{summary.topics[x.value]}</span>}
            </button>
          ))}
        </div>
      </div>

      <ErrorBox error={first.error} />
      {first.loading && !first.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : items.length ? (
        <Stagger className="grid gap-4 md:grid-cols-2">
          {items.map((q) => (
            <StaggerItem key={q.id} className="h-full">
              <QuestionCard q={q} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <EmptyState icon={MessagesSquare} title={t("Савол ёфт нашуд")} text={t("Аввалин шуда савол диҳед — ҳамватанон ёрӣ медиҳанд.")}>
          <Button icon={Plus} onClick={() => setAsking(true)}>{t("Савол додан")}</Button>
        </EmptyState>
      )}
      {next && <Button variant="plain" loading={busy} onClick={more} className="self-center">{t("Боз нишон додан")}</Button>}

      <AskForm open={asking} onClose={() => setAsking(false)} onSaved={(q) => navigate(`/questions/${q.id}`)} />
    </div>
  );
}

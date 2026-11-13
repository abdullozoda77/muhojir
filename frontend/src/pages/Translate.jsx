import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BadgeCheck, CheckCircle2, Copy, Download, FileText, FileType2, FileUp, Languages, Sparkles, Stamp, Trash2, X } from "lucide-react";
import { api, fileProblem, openPrivateFile } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago, rub } from "../format.js";
import { fitPhoto } from "../components/Shop.jsx";
import { Button, EmptyState, ErrorBox, Field, PageHeader, Skeleton, Switch } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

const LANGS = [
  { code: "tg", get name() { return t("Тоҷикӣ"); } },
  { code: "ru", get name() { return t("Русӣ"); } },
  { code: "en", get name() { return t("Англисӣ"); } },
  { code: "zh", get name() { return t("Чинӣ"); } },
];

const STATUSES = {
  new: { get label() { return t("Интизори нарх"); }, tone: "bg-surface-container text-on-surface-variant" },
  priced: { get label() { return t("Нарх муайян шуд"); }, tone: "bg-warning-fixed text-on-warning-fixed" },
  working: { get label() { return t("Дар кор"); }, tone: "bg-primary-fixed text-on-primary-fixed" },
  done: { get label() { return t("Тайёр"); }, tone: "bg-tertiary-fixed text-on-tertiary-fixed" },
  cancelled: { get label() { return t("Бекор шуд"); }, tone: "bg-error-container text-on-error-container" },
};

const AI_ERRORS = {
  not_configured: "Тарҷумони ИИ ҳоло фаъол нест. Тарҷумаи расмиро фармоиш диҳед.",
  busy: "Тарҷумон банд аст. Баъд аз як дақиқа боз кӯшиш кунед.",
  unavailable: "Тарҷумон ҳоло дастрас нест. Каме баъдтар кӯшиш кунед.",
  no_text: "Дар файл матн ёфт нашуд. Сурати равшантар фиристед.",
  refused: "Ин ҳуҷҷатро тарҷума карда намешавад.",
};

const langName = (code) => LANGS.find((l) => l.code === code)?.name || t("Худкор");

function LanguagePair({ from, to, onFrom, onTo, auto }) {
  const swap = () => {
    if (from === "auto") return;
    onFrom(to);
    onTo(from);
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-3">
      <label>
        <span className="label">{t("Аз забони")}</span>
        <select className="input" value={from} onChange={(e) => onFrom(e.target.value)}>
          {auto && <option value="auto">{t("Худкор")}</option>}
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </label>
      <button type="button" onClick={swap} disabled={from === "auto"} aria-label={t("Забонҳоро иваз кардан")} className="flex h-12 w-12 items-center justify-center rounded-xl text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-all duration-300 hover:rotate-180 hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40 disabled:hover:rotate-0">
        <ArrowLeftRight className="h-5 w-5" aria-hidden />
      </button>
      <label>
        <span className="label">{t("Ба забони")}</span>
        <select className="input" value={to} onChange={(e) => onTo(e.target.value)}>
          {LANGS.filter((l) => l.code !== from).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function FilePicker({ file, onChange, accept = "image/jpeg,image/png,image/webp,application/pdf", hint, error }) {
  const input = useRef(null);
  const [problem, setProblem] = useState(null);
  const pick = (next) => {
    const issue = fileProblem(next);
    setProblem(issue);
    onChange(issue ? null : next);
  };
  return (
    <div>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 ring-1 ring-inset ring-outline-variant">
          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-body-md">{file.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label={t("Тоза кардан")} className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline/50 px-3 text-label-md text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface">
          <span className="flex items-center gap-2">
            <FileUp className="h-5 w-5" aria-hidden />
            {t("Сурат ё PDF-и ҳуҷҷат")}
          </span>
          {hint && <span className="text-body-sm font-normal">{hint}</span>}
        </button>
      )}
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files?.[0] || null); e.target.value = ""; }} />
      {(problem || error) && <p className="mt-1 text-body-sm text-error">{problem || [].concat(error).join(" ")}</p>}
    </div>
  );
}

function saveText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

function ResultActions({ item }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.result_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="plain" icon={copied ? CheckCircle2 : Copy} onClick={copy}>{copied ? t("Нусха шуд") : t("Нусха гирифтан")}</Button>
      <Button variant="plain" icon={Download} onClick={() => saveText(item.result_text, `muhojir-${item.target_lang}-${item.id}.txt`)}>{t("Боргирӣ (.txt)")}</Button>
    </div>
  );
}

function AiTranslator({ options, onDone, onOrder }) {
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("ru");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (from === to) setTo(LANGS.find((l) => l.code !== from).code);
  }, [from, to]);

  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("source_lang", from);
      body.append("target_lang", to);
      body.append("text", text);
      if (file) {
        const small = file.type.startsWith("image/") ? await fitPhoto(file, 2400).catch(() => null) : null;
        body.append("file", small || file, small ? "document.webp" : file.name);
      }
      const done = await api("/translations/ai/", { method: "POST", body });
      setResult(done);
      onDone();
    } catch (err) {
      const code = err.data?.code;
      setError(AI_ERRORS[code] ? Object.assign(new Error(t(AI_ERRORS[code])), { data: err.data }) : err);
    } finally {
      setBusy(false);
    }
  };

  if (!options.ai_enabled) {
    return (
      <EmptyState icon={Sparkles} title={t("Тарҷумони ИИ ҳоло фаъол нест")} text={t("Ҳуҷҷатро ба тарҷумон фиристед — тарҷумаи расмӣ мегиред.")}>
        <Button icon={Stamp} onClick={onOrder}>{t("Фармоиши тарҷумаи расмӣ")}</Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={run} className="flex flex-col gap-4">
        <LanguagePair from={from} to={to} onFrom={setFrom} onTo={setTo} auto />
        <Field label={t("Матн")} error={error?.data?.text}>
          <textarea className="input min-h-[140px] resize-y" rows={5} maxLength={options.max_text} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Матнро нависед ё дар поён сурати ҳуҷҷатро илова кунед.")} />
        </Field>
        <FilePicker file={file} onChange={setFile} hint={t("Шиноснома, шартнома, маълумотнома — то {0} МБ", options.max_file_mb)} error={error?.data?.file} />
        <ErrorBox error={error && !error.data?.text && !error.data?.file ? error : null} />
        <Button type="submit" icon={Sparkles} loading={busy} disabled={!text.trim() && !file}>
          {busy ? t("Тарҷума шуда истодааст…") : t("Тарҷума кардан")}
        </Button>
      </form>
      {result && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 ring-1 ring-inset ring-outline-variant">
          <p className="flex items-center gap-2 text-label-md text-on-surface-variant">
            <Languages className="h-4 w-4" aria-hidden />
            {langName(result.source_lang)} → {langName(result.target_lang)}
          </p>
          <p className="whitespace-pre-wrap break-words text-body-md">{result.result_text}</p>
          <ResultActions item={result} />
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-xl bg-warning-fixed/60 p-3.5 text-body-sm text-on-warning-fixed sm:flex-row sm:items-center sm:justify-between">
        <span>{t("Тарҷумаи ИИ барои фаҳмидани ҳуҷҷат аст. Барои идораҳо, суд ва муҳоҷират тарҷумаи расмӣ лозим аст.")}</span>
        <button type="button" onClick={onOrder} className="shrink-0 self-start text-label-md underline underline-offset-2 sm:self-auto">{t("Фармоиш додан")}</button>
      </div>
    </div>
  );
}

function OrderForm({ options, onDone }) {
  const { user } = useAuth();
  const [from, setFrom] = useState("tg");
  const [to, setTo] = useState("ru");
  const [docType, setDocType] = useState("passport");
  const [file, setFile] = useState(null);
  const [notarized, setNotarized] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (from === to) setTo(LANGS.find((l) => l.code !== from).code);
  }, [from, to]);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries({ source_lang: from, target_lang: to, doc_type: docType, notarized, phone, note }).forEach(([k, v]) => body.append(k, v));
      body.append("file", file, file.name);
      await api("/translations/orders/", { method: "POST", body });
      setSent(true);
      setFile(null);
      setNote("");
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl bg-tertiary-fixed p-4 text-on-tertiary-fixed">
        <span className="flex items-center gap-2 text-[16px] font-semibold">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          {t("Фармоиш қабул шуд!")}
        </span>
        <p className="text-body-md">{t("Тарҷумон ҳуҷҷатро мебинад ва нархро мефиристад. Хабар дар огоҳиҳо, почта ва Telegram меояд.")}</p>
        <Button variant="plain" onClick={() => setSent(false)}>{t("Боз як ҳуҷҷат")}</Button>
      </div>
    );
  }

  const fieldError = (name) => error?.data?.[name];
  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <LanguagePair from={from} to={to} onFrom={setFrom} onTo={setTo} />
      <Field label={t("Навъи ҳуҷҷат")}>
        <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
          {options.doc_types.map((d) => <option key={d.code} value={d.code}>{t(d.name)}</option>)}
        </select>
      </Field>
      <Field label={t("Ҳуҷҷат")} required>
        <FilePicker file={file} onChange={setFile} hint={t("Ҳамаи саҳифаҳо дар як PDF ё сурати равшан")} error={fieldError("file")} />
      </Field>
      <Switch checked={notarized} onChange={setNotarized} icon={Stamp} title={t("Бо тасдиқи нотариус")} text={t("Барои муҳоҷират, ЗАГС, суд ва идораҳои давлатӣ")} />
      <Field label={t("Телефон")} required error={fieldError("phone")} hint={t("Тарҷумон барои нарх ва мӯҳлат занг мезанад ё менависад.")}>
        <input className="input" type="tel" inputMode="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 999 123-45-67" />
      </Field>
      <Field label={t("Изоҳ (агар хоҳед)")} error={fieldError("note")}>
        <textarea className="input min-h-[90px] resize-y" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Масалан: то ҷумъа лозим аст, барои РВП.")} />
      </Field>
      <ErrorBox error={error && !fieldError("file") && !fieldError("phone") && !fieldError("note") ? error : null} />
      <Button type="submit" icon={BadgeCheck} loading={busy} disabled={!file || phone.trim().length < 5}>
        {t("Фармоиш додан")}
      </Button>
      <p className="text-body-sm text-on-surface-variant">{t("Нарх пас аз дидани ҳуҷҷат маълум мешавад. То розӣ шудани шумо ҳеҷ пул намегирем.")}</p>
    </form>
  );
}

function HistoryItem({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const status = STATUSES[item.status];
  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const remove = () => act(() => api(`/translations/${item.id}/`, { method: "DELETE" }));
  const cancel = () => act(() => api(`/translations/${item.id}/cancel/`, { method: "POST" }));
  const open_file = (path) => openPrivateFile(path.replace(/^\/api/, "")).catch(setError);
  const canDelete = item.kind === "ai" || ["done", "cancelled"].includes(item.status);

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-inset ring-outline-variant">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-sm ${item.kind === "ai" ? "bg-primary-fixed text-on-primary-fixed" : "bg-ink text-on-ink"}`}>
          {item.kind === "ai" ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : <Stamp className="h-3.5 w-3.5" aria-hidden />}
          {item.kind === "ai" ? t("ИИ") : t("Расмӣ")}
        </span>
        {item.kind === "order" && status && <span className={`rounded-full px-2.5 py-1 text-label-sm ${status.tone}`}>{status.label}</span>}
        <span className="ml-auto text-body-sm text-on-surface-variant">{ago(item.created_at)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-body-md font-medium">{langName(item.source_lang)} → {langName(item.target_lang)}</p>
        <p className="truncate text-body-sm text-on-surface-variant">
          {item.kind === "order" ? `${t(item.doc_type_label)}${item.notarized ? ` · ${t("бо нотариус")}` : ""}` : item.file_name || item.source_text.slice(0, 80)}
        </p>
      </div>
      {item.kind === "order" && (item.price != null || item.editor_note) && (
        <div className="rounded-xl bg-surface-container-low p-3 text-body-sm">
          {item.price != null && <p><span className="text-on-surface-variant">{t("Нарх:")}</span> <strong>{rub(item.price)}</strong></p>}
          {item.editor_note && <p className="whitespace-pre-line">{item.editor_note}</p>}
        </div>
      )}
      {item.kind === "ai" && open && (
        <div className="flex flex-col gap-3">
          <p className="whitespace-pre-wrap break-words rounded-xl bg-surface-container-low p-3 text-body-md">{item.result_text}</p>
          <ResultActions item={item} />
        </div>
      )}
      <ErrorBox error={error} />
      <div className="flex flex-wrap gap-2">
        {item.kind === "ai" && <Button variant="plain" onClick={() => setOpen(!open)}>{open ? t("Пинҳон кардан") : t("Дидани тарҷума")}</Button>}
        {item.result && <Button icon={Download} onClick={() => open_file(item.result)}>{t("Тарҷумаи тайёр")}</Button>}
        {item.file && <Button variant="plain" icon={FileText} onClick={() => open_file(item.file)}>{t("Ҳуҷҷати ман")}</Button>}
        {item.kind === "order" && ["new", "priced"].includes(item.status) && <Button variant="ghost" icon={X} loading={busy} onClick={cancel}>{t("Бекор кардан")}</Button>}
        {canDelete && <Button variant="ghost" icon={Trash2} loading={busy} onClick={remove} aria-label={t("Нест кардан")} />}
      </div>
    </li>
  );
}

export default function Translate() {
  const { data: options, error: optionsError } = useApi("/translations/options/");
  const [tab, setTab] = useState("ai");
  const [tick, setTick] = useState(0);
  const { data: mine } = useApi(`/translations/mine/?t=${tick}`);
  const top = useRef(null);
  const refresh = () => setTick((n) => n + 1);
  const goOrder = () => {
    setTab("order");
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tabs = [
    ["ai", Sparkles, t("Тарҷумаи фаврӣ (ИИ)")],
    ["order", Stamp, t("Тарҷумаи расмӣ")],
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Ҳуҷҷатҳо")} title={t("Тарҷумаи ҳуҷҷатҳо")} text={t("Тоҷикӣ, русӣ, англисӣ ва чинӣ: тарҷумаи фаврӣ бо ИИ ё тарҷумаи расмӣ бо нотариус.")} icon={FileType2} />
      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <section ref={top} className="flex scroll-mt-24 flex-col gap-5 rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant sm:p-6">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1">
              {tabs.map(([value, Icon, label]) => (
                <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-center text-label-md transition-colors ${tab === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <ErrorBox error={optionsError} />
            {!options ? (
              <Skeleton className="h-72" />
            ) : tab === "ai" ? (
              <AiTranslator options={options} onDone={refresh} onOrder={goOrder} />
            ) : (
              <OrderForm options={options} onDone={refresh} />
            )}
          </section>
        </Reveal>
        <Reveal className="xl:col-span-5">
          <section className="flex flex-col gap-4">
            <h2 className="text-[18px] font-semibold">{t("Тарҷумаҳои ман")}</h2>
            {!mine ? (
              <Skeleton className="h-32" />
            ) : mine.length ? (
              <ul className="flex flex-col gap-3">
                {mine.map((item) => <HistoryItem key={item.id} item={item} onChange={refresh} />)}
              </ul>
            ) : (
              <p className="rounded-2xl bg-surface-container-low p-4 text-body-md text-on-surface-variant">{t("Ҳоло тарҷума нест. Матн ё сурати ҳуҷҷатро фиристед.")}</p>
            )}
          </section>
        </Reveal>
      </div>
    </div>
  );
}

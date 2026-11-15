import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, ClipboardList, Copy, ExternalLink, Info, LifeBuoy, RotateCcw, SearchCheck } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

const lines = (text) => (text || "").split("\n").map((s) => s.trim()).filter(Boolean);

function stateOf(check) {
  const mine = check.my_result;
  if (!mine) return "new";
  if (mine.result === "problem") return "problem";
  return mine.is_due ? "due" : "ok";
}

const PILL = {
  ok: { icon: CheckCircle2, text: () => t("Санҷида шуд"), className: "bg-tertiary-fixed text-on-tertiary-fixed" },
  due: { icon: RotateCcw, text: () => t("Вақти санҷиши нав"), className: "bg-warning-fixed text-on-warning-fixed" },
  problem: { icon: AlertTriangle, text: () => t("Мушкил ҳаст"), className: "bg-error-container text-on-error-container" },
};

function StatePill({ state }) {
  const pill = PILL[state];
  if (!pill) return null;
  const Icon = pill.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-label-sm ${pill.className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pill.text()}
    </span>
  );
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-lowest px-3 py-2 ring-1 ring-outline-variant">
      <span className="min-w-0">
        <span className="block text-body-sm text-on-surface-variant">{label}</span>
        <span className="block truncate font-mono text-[15px]">{value}</span>
      </span>
      <button type="button" onClick={copy} aria-label={t("Нусха гирифтан")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
        {copied ? <Check className="h-4 w-4 text-primary" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

function MyPapers({ check }) {
  if (!check.documents.length) return null;
  if (!check.my_documents.length) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        <Link to="/documents" className="text-primary underline">{t("Патентро ба «Ҳуҷҷатҳои ман» илова кунед")}</Link>
        {" — "}
        {t("рақамаш дар ин ҷо барои нусха гирифтан пайдо мешавад.")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
      <span className="text-label-md text-on-surface-variant">{t("Маълумоти шумо аз «Ҳуҷҷатҳои ман»")}</span>
      {check.my_documents.map((paper) => (
        <div key={paper.id} className="flex flex-col gap-2">
          {paper.number && <CopyRow label={t("{0}: рақам", paper.title)} value={paper.number} />}
          {paper.issued_at && <CopyRow label={t("Санаи додан")} value={date(paper.issued_at)} />}
        </div>
      ))}
    </div>
  );
}

function IfBad({ check, open }) {
  const steps = lines(check.if_bad);
  if (!steps.length) return null;
  const body = (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-body-md">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error text-[11px] font-semibold tabular-nums text-on-error">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <Link to="/help" className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
        <LifeBuoy className="h-4 w-4" aria-hidden />
        {t("Ҳуқуқшиносон ва хатҳои ёрӣ")}
      </Link>
    </div>
  );
  if (open) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-xl border-l-[3px] border-error bg-error-container/40 p-4">
        <p className="flex items-center gap-2 font-semibold text-error">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          {t("Чӣ бояд кард")}
        </p>
        {body}
      </div>
    );
  }
  return (
    <details className="group rounded-xl bg-surface-container-low p-4">
      <summary className="cursor-pointer list-none text-label-md text-on-surface-variant marker:hidden group-open:mb-3">
        {t("Агар натиҷа бад бошад, чӣ кор кунам?")}
      </summary>
      {body}
    </details>
  );
}

function ResultButtons({ check, onSaved }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const save = async (result) => {
    setBusy(result);
    setError(null);
    try {
      await api(`/help/checks/${check.id}/result/`, { method: "PUT", body: { result } });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };
  const mine = check.my_result;
  return (
    <div className="flex flex-col gap-3 border-t border-outline-variant pt-4">
      <span className="text-label-md">{mine ? t("Боз санҷидед? Натиҷаро нав кунед") : t("Санҷидед? Натиҷа чӣ шуд?")}</span>
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" icon={CheckCircle2} loading={busy === "ok"} disabled={Boolean(busy)} onClick={() => save("ok")}>{t("Ҳамааш хуб")}</Button>
        <Button variant="plain" icon={AlertTriangle} loading={busy === "problem"} disabled={Boolean(busy)} onClick={() => save("problem")} className="!text-error">{t("Мушкил ҳаст")}</Button>
      </div>
      {mine && (
        <p className="text-body-sm text-on-surface-variant">
          {[t("Охирин санҷиш: {0}", date(mine.checked_at)), mine.due_at && t("Боз санҷед то {0}", date(mine.due_at))].filter(Boolean).join(" · ")}
        </p>
      )}
      <ErrorBox error={error} />
    </div>
  );
}

function CheckCard({ check, onSaved }) {
  const state = stateOf(check);
  const needs = lines(check.needs);
  return (
    <StaggerItem className={`card flex flex-col gap-5 p-6 ${state === "problem" ? "!ring-2 !ring-error/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[18px] font-semibold leading-snug">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
            <SearchCheck className="h-5 w-5" aria-hidden />
          </span>
          {check.title}
        </h2>
        <StatePill state={state} />
      </div>
      {needs.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
            <ClipboardList className="h-4 w-4" aria-hidden />
            {t("Чӣ лозим")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {needs.map((need) => (
              <span key={need} className="rounded-md bg-surface-container-high px-2 py-1 text-label-sm">{need}</span>
            ))}
          </div>
        </div>
      )}
      <MyPapers check={check} />
      <ol className="flex flex-col gap-3">
        {lines(check.description).map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-body-md">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-outline">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      {check.website && (
        <a href={check.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-ink px-5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
          {t("Санҷидан")}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}
      <IfBad check={check} open={state === "problem"} />
      <ResultButtons check={check} onSaved={onSaved} />
    </StaggerItem>
  );
}

function Summary({ checks }) {
  const states = checks.map(stateOf);
  const done = states.filter((s) => s === "ok").length;
  const problems = states.filter((s) => s === "problem").length;
  const due = states.filter((s) => s === "due").length;
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[17px] font-semibold">{t("{0} аз {1} санҷиш анҷом шуд", done, checks.length)}</span>
        <span className="flex flex-wrap gap-2">
          {problems > 0 && <StatePill state="problem" />}
          {due > 0 && <StatePill state="due" />}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(done / checks.length) * 100}%` }} />
      </div>
      <p className="text-body-sm text-on-surface-variant">{t("Натиҷаро танҳо шумо мебинед. Вақте санҷиши нав лозим шавад, дар ин ҷо нишон медиҳем.")}</p>
    </div>
  );
}

export default function Checks() {
  const { data, error, loading, reload } = useApi("/help/checks/");
  const checks = data || [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Сайтҳои расмии Русия")} title={t("Санҷиши ҳуҷҷатҳо")} text={t("Худатон санҷед: патент эътибор дорад, манъи даромадан ё қарз нест.")} icon={SearchCheck} />
      <ErrorBox error={error} />
      <p className="flex items-start gap-3 rounded-xl border-l-[3px] border-primary bg-primary/[0.05] p-4 text-body-md">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        {t("Сайтҳои МВД танҳо аз интернети Русия кушода мешаванд. Агар дар Тоҷикистон бошед ва сайт кушода нашавад, аз хешовандон дар Русия хоҳиш кунед.")}
      </p>
      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : checks.length === 0 ? (
        <EmptyState icon={SearchCheck} title={t("Санҷишҳо ба наздикӣ илова мешаванд")} />
      ) : (
        <>
          <Summary checks={checks} />
          <Stagger className="grid items-start gap-4 lg:grid-cols-2">
            {checks.map((check) => (
              <CheckCard key={check.id} check={check} onSaved={reload} />
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}

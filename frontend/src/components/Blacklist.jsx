import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, ShieldAlert, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import { Button, Drawer, ErrorBox } from "./ui.jsx";

const QUICK = [
  () => t("Маош надоданд"),
  () => t("Ҳуҷҷатҳоро (шиноснома) гирифтанд ва барнагардонданд"),
  () => t("Шартҳо аз эълон дигар буданд"),
  () => t("Қаллобӣ: барои кор пул талаб карданд"),
  () => t("Бе бақайдгирӣ ва шартнома кор фармуданд"),
];

export function ReportsBadge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-error-container px-2 py-1 text-label-sm text-on-error-container ${className}`}>
      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
      {t("Дар рӯйхати сиёҳ: {0}", count)}
    </span>
  );
}

export function ReportItem({ report, onRemove }) {
  const remove = async () => {
    if (!window.confirm(t("Шикоятро нест кунем?"))) return;
    await api(`/jobs/blacklist/reports/${report.id}/`, { method: "DELETE" }).catch(() => {});
    onRemove?.();
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface-container-low p-3.5">
      <p className="whitespace-pre-line text-body-md">{report.reason}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body-sm text-on-surface-variant">
          {[report.is_mine ? t("Шумо") : report.author_name, ago(report.created_at), report.job?.title].filter(Boolean).join(" · ")}
        </span>
        {report.is_mine && onRemove && (
          <button type="button" onClick={remove} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {t("Нест кардан")}
          </button>
        )}
      </div>
    </div>
  );
}

function ReportForm({ job, onDone }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface-variant">{t("Барои илова кардан ба рӯйхати сиёҳ ворид шавед. Шикоятҳои дигаронро ҳама бе ворид шудан мебинанд.")}</p>
        <Link to="/login" className="inline-flex min-h-[44px] items-center justify-center self-start rounded-xl bg-ink px-5 text-label-md text-on-ink hover:bg-ink/90">{t("Ворид шудан")}</Link>
      </div>
    );
  }
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/jobs/jobs/${job.id}/blacklist/`, { method: "POST", body: { reason: reason.trim() } });
      setReason("");
      setSent(true);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface-variant">{t("Сабабро интихоб кунед ё худатон нависед")}</span>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((text) => (
            <button key={text()} type="button" onClick={() => setReason(reason.trim() ? `${reason.trim()}. ${text()}` : text())} className="inline-flex min-h-[36px] items-center rounded-lg px-3 text-left text-label-md text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
              {text()}
            </button>
          ))}
        </div>
      </div>
      <label>
        <span className="label">{t("Сабаб")}</span>
        <textarea className="input min-h-[140px] py-3" value={reason} onChange={(e) => (setReason(e.target.value), setSent(false))} maxLength={1000} required minLength={10} placeholder={t("Чӣ шуд? Масалан: 2 моҳ кор кардам, маош надоданд.")} />
        <span className="mt-1 block text-body-sm text-on-surface-variant">{t("Ҳама сабабро бо номи шумо (танҳо ном) мебинанд. Дар бораи як ширкат як шикоят; боз фиристед — сабаб иваз мешавад.")}</span>
      </label>
      <ErrorBox error={error} />
      {sent && <p role="status" className="rounded-xl bg-tertiary-fixed p-3 text-body-sm text-on-tertiary-fixed">{t("Шикояти шумо сабт шуд — ҳама онро мебинанд.")}</p>}
      <Button type="submit" loading={busy} disabled={reason.trim().length < 10} icon={Ban} variant="danger">
        {t("Ба рӯйхати сиёҳ илова кардан")}
      </Button>
    </form>
  );
}

export function ReportsList({ employerId, tick = 0, onChange }) {
  const { data, reload } = useApi(`/jobs/blacklist/reports/?employer=${employerId}&page_size=100&_=${tick}`);
  if (!data?.results?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {data.results.map((r) => (
        <ReportItem key={r.id} report={r} onRemove={() => (reload(), onChange?.())} />
      ))}
    </div>
  );
}

export function ReportButton({ job, compact = false, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const done = () => {
    setTick(tick + 1);
    onChange?.();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("Ба рӯйхати сиёҳ илова кардан")}
        aria-label={t("Ба рӯйхати сиёҳ илова кардан")}
        className={
          compact
            ? `inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-colors hover:bg-error-container hover:text-error ${className}`
            : `inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-label-md text-error ring-1 ring-inset ring-outline-variant transition-colors hover:bg-error-container ${className}`
        }
      >
        <Ban className="h-[18px] w-[18px]" aria-hidden />
        {!compact && t("Ба рӯйхати сиёҳ")}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t("Ба рӯйхати сиёҳ")} subtitle={job.employer.name} icon={Ban}>
        <div className="flex flex-col gap-6">
          <ReportForm job={job} onDone={done} />
          <div className="flex flex-col gap-3">
            <h3 className="text-[16px] font-semibold">{t("Шикоятҳои коргарон")}</h3>
            <ReportsList employerId={job.employer.id} tick={tick} onChange={done} />
            {!job.employer.reports_count && !tick && <p className="text-body-sm text-on-surface-variant">{t("Ҳоло шикоят нест.")}</p>}
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function BlacklistCompany({ e, onChange }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl p-4 ring-1 ring-outline-variant">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/employers/${e.id}`} className="text-label-lg font-semibold text-error hover:underline">{e.name}</Link>
        {e.is_blacklisted ? (
          <span className="shrink-0 rounded-md bg-error-container px-2 py-0.5 text-label-sm text-on-error-container">{t("ХАТАР")}</span>
        ) : (
          <span className="shrink-0 rounded-md bg-error-container px-2 py-0.5 text-label-sm tabular-nums text-on-error-container">{t("{0} шикоят", e.reports_count)}</span>
        )}
      </div>
      {(e.inn || e.city) && <span className="font-mono text-body-sm text-on-surface-variant">{[e.inn && `ИНН: ${e.inn}`, e.city].filter(Boolean).join(" • ")}</span>}
      {e.is_blacklisted && e.blacklist_reason && (
        <p className="rounded-lg bg-surface-container-low p-2.5 text-body-sm"><strong>{t("Админ")}:</strong> {e.blacklist_reason}</p>
      )}
      {e.reports?.map((r) => <ReportItem key={r.id} report={r} onRemove={onChange} />)}
      {e.reports_count > (e.reports?.length || 0) && (
        <Link to={`/employers/${e.id}`} className="text-label-md text-primary">{t("Ҳамаи шикоятҳо ({0})", e.reports_count)}</Link>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { AlertOctagon, BookOpen, Camera, FileText, HeartPulse, House, IdCard, Pencil, PlaneLanding, Stethoscope, Wallet } from "lucide-react";
import { openPrivateFile } from "../api.js";
import { t } from "../i18n.js";
import { date, usedPercent } from "../format.js";
import { StatusBadge } from "./ui.jsx";

// Icons by the document type's slug (set by admins); unknown slugs get a plain document icon.
const ICONS = [
  [/patent/, IdCard],
  [/regist/, House],
  [/card|karta|migration/, PlaneLanding],
  [/insur|dms|polis/, HeartPulse],
  [/med/, Stethoscope],
];

export function docIcon(slug = "") {
  return ICONS.find(([re]) => re.test(slug))?.[1] || FileText;
}

function Meta({ label, value, className = "" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-body-sm text-on-surface-variant">{label}</span>
      <span className={`text-label-lg tabular-nums ${className}`}>{value || "—"}</span>
    </div>
  );
}

// Color of the thin progress line: red when over, amber when ending soon, green when fine.
const BAR_TONE = { expired: "bg-error", expiring: "bg-warning-container", valid: "bg-tertiary-container" };

// One document: its name and status, the days left, a thin line of time used, the details below, and the actions.
export default function DocCard({ doc, slug, onEdit, onPay }) {
  const Icon = docIcon(slug);
  const pct = usedPercent(doc);
  const days = doc.days_left;
  return (
    <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl bg-surface-container-lowest ring-1 ring-outline-variant">
      <header className="flex flex-col gap-5 border-b border-outline-variant p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[17px] font-semibold leading-tight">{t(doc.document_type_title)}</span>
            {doc.region_name && <span className="text-body-sm text-on-surface-variant">{doc.region_name}</span>}
          </span>
        </div>
        <StatusBadge doc={doc} className="self-start" />
        <div className="flex items-end justify-between gap-4">
          <span className="flex items-baseline gap-2">
            <span className="text-[44px] font-semibold leading-none tracking-tight tabular-nums">{Math.abs(days)}</span>
            <span className="text-body-sm text-on-surface-variant">{days < 0 ? t("рӯз пеш гузашт") : t("рӯз монд")}</span>
          </span>
          <span className="text-right text-body-sm text-on-surface-variant">
            {t("Санаи анҷом")}
            <span className="block text-[15px] font-semibold text-on-surface">{date(doc.expires_at)}</span>
          </span>
        </div>
        {pct !== null && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Қисми гузаштаи мӯҳлат")}>
            <div className={`h-full rounded-full ${BAR_TONE[doc.status]}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-between gap-5 p-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Meta label={t("Серия ва рақам")} value={doc.number} />
            <Meta label={t("Санаи додан")} value={date(doc.issued_at)} />
          </div>
          {doc.status === "expired" && (
            <div className="flex items-start gap-3 rounded-xl bg-error-container p-4 text-body-sm text-on-error-container">
              <AlertOctagon className="h-5 w-5 shrink-0 text-error" aria-hidden />
              <div>
                <p className="font-semibold">{t("Мӯҳлати ин ҳуҷҷат гузаштааст!")}</p>
                <p>{t("Онро зудтар нав кунед, то ҷарима нашавед. Дар роҳнамо қадамҳоро бинед.")}</p>
              </div>
            </div>
          )}
          {doc.note && <p className="rounded-xl bg-surface-container-low p-4 text-body-sm"><strong>{t("Ёддошт")}:</strong> {doc.note}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {/patent/.test(slug || "") && (
            <button type="button" onClick={() => onPay(doc)} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
              <Wallet className="h-4 w-4" aria-hidden />
              {t("Пардохти патентро сабт кардан")}
            </button>
          )}
          <button type="button" onClick={() => onEdit(doc)} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            <Pencil className="h-4 w-4" aria-hidden />
            {t("Таҳрир / нав кардан")}
          </button>
          <Link to={`/guides?type=${doc.document_type}`} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-label-md text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
            <BookOpen className="h-4 w-4" aria-hidden />
            {t("Роҳнамо")}
          </Link>
          {doc.has_photo && (
            <button type="button" onClick={() => openPrivateFile(`/documents/my-documents/${doc.id}/photo/`).catch(() => {})} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-label-md text-on-surface-variant ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
              <Camera className="h-4 w-4" aria-hidden />
              {t("Сурат")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

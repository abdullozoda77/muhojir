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
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</span>
      <span className={`text-label-lg ${className}`}>{value || "—"}</span>
    </div>
  );
}

// Colors of the countdown on the dark top: red when over, gold when ending soon, green when fine.
const COUNT_TONE = { expired: "text-[#ff9b9b]", expiring: "text-gold", valid: "text-[#7be3a5]" };
const BAR_TONE = { expired: "bg-[#ff6b6b]", expiring: "bg-gold", valid: "bg-[#5fd38d]" };

// One document, like a passport: the dark top with the days left, the details below, and the actions.
export default function DocCard({ doc, slug, onEdit, onPay }) {
  const Icon = docIcon(slug);
  const pct = usedPercent(doc);
  const days = doc.days_left;
  return (
    <article className="flex w-full flex-col overflow-hidden rounded-[30px] bg-surface-container-lowest shadow-[0_24px_50px_-32px_rgb(16_38_92/0.5)] ring-1 ring-outline-variant/60">
      <header className="relative overflow-hidden bg-navy p-6 text-white">
        <div aria-hidden className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary-container/50 blur-2xl" />
        <div className="flag-line absolute inset-x-0 bottom-0 h-[4px]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="flex flex-col">
              {doc.region_name && <span className="text-label-sm uppercase tracking-wider text-white/60">{doc.region_name}</span>}
              <span className="font-display text-[20px] font-extrabold leading-tight">{t(doc.document_type_title)}</span>
            </span>
          </div>
          <StatusBadge doc={doc} />
        </div>
        <div className="relative mt-6 flex items-end justify-between gap-4">
          <span className="flex items-baseline gap-2">
            <span className={`font-display text-[56px] font-black leading-none ${COUNT_TONE[doc.status]}`}>{Math.abs(days)}</span>
            <span className="text-body-md text-white/70">{days < 0 ? t("рӯз пеш гузашт") : t("рӯз монд")}</span>
          </span>
          <span className="text-right text-body-sm text-white/70">
            {t("Санаи анҷом")}
            <span className="block font-display text-[18px] font-bold text-white">{date(doc.expires_at)}</span>
          </span>
        </div>
        {pct !== null && (
          <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Қисми гузаштаи мӯҳлат")}>
            <div className={`h-full rounded-full ${BAR_TONE[doc.status]}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-between gap-5 p-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Meta label={t("Серия ва рақам")} value={doc.number} className="font-mono" />
            <Meta label={t("Санаи додан")} value={date(doc.issued_at)} />
          </div>
          {doc.status === "expired" && (
            <div className="flex items-start gap-3 rounded-[20px] bg-error-container p-4 text-body-sm text-on-error-container">
              <AlertOctagon className="h-5 w-5 shrink-0 text-error" aria-hidden />
              <div>
                <p className="font-bold">{t("Мӯҳлати ин ҳуҷҷат гузаштааст!")}</p>
                <p>{t("Онро зудтар нав кунед, то ҷарима нашавед. Дар роҳнамо қадамҳоро бинед.")}</p>
              </div>
            </div>
          )}
          {doc.note && <p className="rounded-[20px] bg-surface-container-low p-4 text-body-sm"><strong>{t("Ёддошт")}:</strong> {doc.note}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {/patent/.test(slug || "") && (
            <button type="button" onClick={() => onPay(doc)} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 text-label-lg text-on-secondary shadow-[0_10px_22px_-10px_rgb(var(--c-secondary)/0.8)] hover:bg-secondary-container">
              <Wallet className="h-4 w-4" aria-hidden />
              {t("Пардохти патентро сабт кардан")}
            </button>
          )}
          <button type="button" onClick={() => onEdit(doc)} className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-navy px-5 text-label-md text-white hover:brightness-125 dark:bg-primary dark:text-on-primary">
            <Pencil className="h-4 w-4" aria-hidden />
            {t("Таҳрир / нав кардан")}
          </button>
          <Link to={`/guides?type=${doc.document_type}`} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-5 text-label-md text-primary ring-1 ring-outline-variant hover:bg-surface-container-low">
            <BookOpen className="h-4 w-4" aria-hidden />
            {t("Роҳнамо")}
          </Link>
          {doc.has_photo && (
            <button type="button" onClick={() => openPrivateFile(`/documents/my-documents/${doc.id}/photo/`).catch(() => {})} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-5 text-label-md text-primary ring-1 ring-outline-variant hover:bg-surface-container-low">
              <Camera className="h-4 w-4" aria-hidden />
              {t("Сурат")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, BedDouble, Bookmark, Clock3, ExternalLink, FileCheck2, Globe, MapPin, Soup } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { t } from "../i18n.js";
import { salary } from "../format.js";
import { Chip } from "./ui.jsx";
import { industry } from "../constants.js";

// Every job comes from «Работа России» (trudvsem.ru); people apply there, on the ad's official page.
export const SOURCE_NAME = "Работа России";

export function Perks({ job }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {job.housing_provided && <Chip icon={BedDouble}>{t("Манзил медиҳанд")}</Chip>}
      {job.meals_provided && <Chip icon={Soup}>{t("Хӯрок медиҳанд")}</Chip>}
      {job.helps_with_documents && <Chip icon={FileCheck2}>{t("Дар ҳуҷҷатҳо ёрӣ медиҳад")}</Chip>}
      {job.schedule && <Chip icon={Clock3}>{job.schedule}</Chip>}
    </div>
  );
}

export function VerifiedBadge({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-label-sm text-on-tertiary-fixed ${className}`}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {t("Тасдиқшуда")}
    </span>
  );
}

export function SourceBadge({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface-variant ${className}`}>
      <Globe className="h-3.5 w-3.5" aria-hidden />
      {t("Аз сайти «{0}»", SOURCE_NAME)}
    </span>
  );
}

// The link to the ad on the official site, where people read the contacts and apply.
export function OfficialLink({ job, className = "" }) {
  if (!job.external_url) return null;
  return (
    <a href={job.external_url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 text-label-lg text-white hover:brightness-125 dark:bg-primary dark:text-on-primary ${className}`}>
      <ExternalLink className="h-4 w-4" aria-hidden />
      {t("Эълони расмӣ")}
    </a>
  );
}

export const placeOf = (job) => job.address || job.city;

// Save a job for later (only for logged-in users). onChange tells the page, e.g. to drop it from the saved list.
export function SaveButton({ job, onChange, className = "" }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(Boolean(job.is_saved));
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      const data = await api(`/jobs/jobs/${job.id}/save/`, { method: saved ? "DELETE" : "POST" });
      setSaved(data.is_saved);
      onChange?.(data.is_saved);
    } catch {
      // nothing changed; the button stays as it was
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? t("Аз захира баровардан") : t("Захира кардан")}
      title={saved ? t("Аз захира баровардан") : t("Захира кардан")}
      className={`inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-full px-3 text-label-lg transition-colors disabled:opacity-60 ${saved ? "bg-secondary text-on-secondary" : "bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/60 hover:text-primary"} ${className}`}
    >
      <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} aria-hidden />
    </button>
  );
}

// Colors of the job's industry square (by the industry's place in the list), so the grid is lively but calm.
const TONES = [
  "bg-primary-fixed text-on-primary-fixed", "bg-secondary-fixed text-on-secondary-fixed", "bg-tertiary-fixed text-on-tertiary-fixed",
  "bg-warning-fixed text-on-warning-fixed", "bg-surface-container-high text-on-surface",
];
const toneOf = (value = "") => TONES[[...value].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

function IndustryIcon({ job, size = "h-12 w-12" }) {
  const Icon = industry(job.industry).icon;
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-2xl ${toneOf(job.industry)}`} aria-hidden>
      <Icon className="h-6 w-6" />
    </span>
  );
}

// compact (home page): a short row, the whole row a link to the job. Otherwise (jobs list): a card with the
// company, address and perks, the salary, and buttons to the official ad and to save it.
export function JobRow({ job, compact = false, onSaveChange }) {
  if (compact) {
    return (
      <Link to={`/jobs/${job.id}`} className="flex items-center gap-4 rounded-[24px] px-3 py-3.5 transition-colors hover:bg-surface-container-low">
        <IndustryIcon job={job} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[17px] font-bold">{job.title}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant">
            {job.employer.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-tertiary-container" aria-label={t("Тасдиқшуда")} />}
            <span className="truncate">{[job.employer.name, job.city].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-label-lg font-bold text-primary sm:hidden">{salary(job)}</span>
        </span>
        <span className="hidden shrink-0 text-right font-display text-[17px] font-bold text-primary sm:block">{salary(job)}</span>
      </Link>
    );
  }
  return (
    <article className="flex h-full flex-col gap-4 rounded-[28px] bg-surface-container-lowest p-5 ring-1 ring-outline-variant/60 transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-26px_rgb(16_38_92/0.5)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <IndustryIcon job={job} />
        <SaveButton job={job} onChange={onSaveChange} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Link to={`/jobs/${job.id}`} className="font-display text-[19px] font-bold leading-snug hover:text-primary">{job.title}</Link>
        <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant">
          {job.employer.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-tertiary-container" aria-label={t("Тасдиқшуда")} />}
          <span className="truncate">{job.employer.name}</span>
        </span>
        {placeOf(job) && (
          <span className="flex min-w-0 items-start gap-1.5 text-body-sm text-on-surface-variant">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="line-clamp-2">{placeOf(job)}</span>
          </span>
        )}
      </div>
      <Perks job={job} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/50 pt-4">
        <span className="font-display text-[20px] font-extrabold text-primary">{salary(job)}</span>
        <OfficialLink job={job} className="min-h-[44px]" />
      </div>
    </article>
  );
}

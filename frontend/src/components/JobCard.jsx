import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, BedDouble, Bookmark, Clock3, ExternalLink, FileCheck2, Globe, MapPin, Soup } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { t } from "../i18n.js";
import { salary } from "../format.js";
import { Chip } from "./ui.jsx";
import { ReportButton, ReportsBadge } from "./Blacklist.jsx";
import { industry } from "../constants.js";

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
    <span className={`inline-flex items-center gap-1 rounded-md bg-tertiary-fixed px-2 py-1 text-label-sm text-on-tertiary-fixed ${className}`}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {t("Тасдиқшуда")}
    </span>
  );
}

export function SourceBadge({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-surface-container-high px-2 py-1 text-label-sm text-on-surface-variant ${className}`}>
      <Globe className="h-3.5 w-3.5" aria-hidden />
      {t("Аз сайти «{0}»", SOURCE_NAME)}
    </span>
  );
}

export function OfficialLink({ job, className = "" }) {
  if (!job.external_url) return null;
  return (
    <a href={job.external_url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90 ${className}`}>
      <ExternalLink className="h-4 w-4" aria-hidden />
      {t("Эълони расмӣ")}
    </a>
  );
}

export const placeOf = (job) => job.address || job.city;

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
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-3 text-label-lg transition-colors disabled:opacity-60 ${saved ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"} ${className}`}
    >
      <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} aria-hidden />
    </button>
  );
}

function IndustryIcon({ job, size = "h-11 w-11" }) {
  const Icon = industry(job.industry).icon;
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface ring-1 ring-outline-variant`} aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function JobRow({ job, compact = false, onSaveChange }) {
  const [reports, setReports] = useState(job.employer.reports_count || 0);
  const recount = () => api(`/jobs/employers/${job.employer.id}/`).then((e) => setReports(e.reports_count)).catch(() => {});
  if (compact) {
    return (
      <Link to={`/jobs/${job.id}`} className="flex items-center gap-4 rounded-2xl px-3 py-3.5 transition-colors hover:bg-surface-container-low">
        <IndustryIcon job={job} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[17px] font-semibold">{job.title}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant">
            {job.employer.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-tertiary-container" aria-label={t("Тасдиқшуда")} />}
            <span className="truncate">{[job.employer.name, job.city].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-label-lg font-semibold text-on-surface sm:hidden">{salary(job)}</span>
        </span>
        <span className="hidden shrink-0 text-right text-[16px] font-semibold text-on-surface sm:block">{salary(job)}</span>
      </Link>
    );
  }
  return (
    <article className="flex h-full w-full min-w-0 flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant transition-colors hover:ring-outline/50 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <IndustryIcon job={job} />
        <span className="flex gap-2">
          <ReportButton job={job} compact onChange={recount} />
          <SaveButton job={job} onChange={onSaveChange} />
        </span>
      </div>
      {reports > 0 && <ReportsBadge count={reports} className="self-start" />}
      <div className="flex flex-col gap-1.5">
        <Link to={`/jobs/${job.id}`} className="font-display text-[19px] font-semibold leading-snug hover:text-primary">{job.title}</Link>
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
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
        <span className="text-[20px] font-semibold tracking-tight text-on-surface">{salary(job)}</span>
        <OfficialLink job={job} className="min-h-[44px]" />
      </div>
    </article>
  );
}

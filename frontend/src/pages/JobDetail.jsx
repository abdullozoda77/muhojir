import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarClock, ChevronRight, ExternalLink, Globe, Map as MapIcon, MapPin, ShieldAlert } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago, date, salary } from "../format.js";
import { industry } from "../constants.js";
import { OfficialLink, Perks, SOURCE_NAME, SaveButton, SourceBadge, VerifiedBadge, placeOf } from "../components/JobCard.jsx";
import { Stars, average } from "../components/Stars.jsx";
import { EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";

export default function JobDetail() {
  const { id } = useParams();
  const { data: job, error, loading } = useApi(`/jobs/jobs/${id}/`);
  const reviews = useApi(job ? `/jobs/reviews/?employer=${job.employer.id}&page_size=100` : null);

  if (loading) return <Skeleton className="h-96" />;
  if (error) return error.status === 404 ? <EmptyState title={t("Ин ҷойи кор ёфт нашуд ё пӯшида шудааст")} /> : <ErrorBox error={error} />;

  const rating = average(reviews.data?.results);
  const Industry = industry(job.industry).icon;
  const closed = !job.is_active || new Date(job.expires_at) <= new Date();

  return (
    <div className="flex flex-col gap-6 pb-20 lg:pb-0">
      <Link to="/jobs" className="inline-flex min-h-[44px] items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("Ҳамаи ҷойҳои корӣ")}
      </Link>

      {job.employer.is_blacklisted && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-error-container p-4 text-on-error-container">
          <ShieldAlert className="h-6 w-6 shrink-0 text-error" aria-hidden />
          <p className="font-bold">{t("Ин корфармо дар рӯйхати сиёҳ аст. Эҳтиёт шавед!")}</p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <article className="flex flex-col gap-5 lg:col-span-8">
          {/* The job's header: dark blue, the title big, the salary in gold. */}
          <header className="relative flex flex-col gap-5 overflow-hidden rounded-[36px] bg-navy p-6 text-white md:p-9">
            <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-container/50 blur-3xl" />
            <div className="flag-line absolute inset-x-0 bottom-0 h-[5px]" />
            <div className="relative flex flex-wrap items-center gap-2">
              {job.employer.is_verified && <VerifiedBadge />}
              <SourceBadge />
              <span className="text-body-sm text-white/70">{ago(job.created_at)}</span>
            </div>
            <div className="relative flex flex-col gap-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-label-md ring-1 ring-white/20">
                <Industry className="h-4 w-4" aria-hidden />
                {industry(job.industry).label}
              </span>
              <h1 className="font-display text-[32px] font-black leading-[1.08] md:text-[46px]">{job.title}</h1>
            </div>
            <p className="relative font-display text-[28px] font-extrabold text-gold md:text-[34px]">{salary(job)}</p>
          </header>
          <div className="card flex flex-col gap-5 p-6 md:p-8">
          {placeOf(job) && (
            <div className="flex flex-col gap-3 rounded-[24px] bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-body-lg">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                <span><span className="block text-label-md text-on-surface-variant">{t("Суроғаи кор")}</span>{placeOf(job)}</span>
              </p>
              <a href={`https://yandex.ru/maps/?text=${encodeURIComponent(placeOf(job))}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start rounded-full bg-surface-container-lowest px-4 text-label-md text-primary ring-1 ring-outline-variant hover:bg-surface sm:self-auto">
                <MapIcon className="h-4 w-4" aria-hidden />
                {t("Дар харита")}
              </a>
            </div>
          )}
          <Perks job={job} />
          <div className="border-t border-outline-variant/50 pt-5">
            <h2 className="mb-3 font-display text-[22px] font-extrabold text-navy dark:text-on-surface">{t("Тавсифи кор")}</h2>
            <p className="whitespace-pre-line text-body-lg">{job.description}</p>
          </div>
          <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <CalendarClock className="h-4 w-4" aria-hidden />
            {t("Эълон то {0} фаъол аст", date(job.expires_at))}
          </p>
          </div>
        </article>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <Link to={`/employers/${job.employer.id}`} className="card flex flex-col gap-3 p-4 transition-shadow hover:shadow-md md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed">
                <Building2 className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-label-lg">{job.employer.name}</p>
                <p className="text-body-sm text-on-surface-variant">{job.employer.city}</p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 text-outline" aria-hidden />
            </div>
            <div className="flex items-center gap-2">
              <Stars value={rating ?? 0} />
              <span className="text-label-md">{rating ? rating.toFixed(1) : "—"}</span>
              <span className="text-body-sm text-on-surface-variant">({t("{0} шарҳ", reviews.data?.count ?? 0)})</span>
            </div>
          </Link>
          {!closed && (
            <div className="fixed bottom-[96px] left-4 right-4 z-40 flex gap-2 lg:static">
              <OfficialLink job={job} className="min-h-[52px] flex-1 shadow-lg lg:shadow-sm" />
              <SaveButton job={job} className="min-h-[52px] shadow-lg lg:shadow-sm" />
            </div>
          )}
          {job.employer.website && (
            <a href={job.employer.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-5 text-label-lg text-primary ring-1 ring-outline-variant hover:bg-surface-container-low">
              <Globe className="h-5 w-5" aria-hidden />
              {t("Ширкат дар сайти расмӣ")}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <p className="card p-4 text-body-sm text-on-surface-variant">
            {t("Ин эълон аз сайти давлатии «{0}» гирифта шудааст. Ариза ва тамос бо корфармо — дар он сайт. Пеш аз сафар шартҳоро бо корфармо санҷед.", SOURCE_NAME)}
          </p>
          {closed && <p className="card p-4 text-body-md text-on-surface-variant">{t("Ин эълон пӯшида аст.")}</p>}
        </aside>
      </div>
    </div>
  );
}

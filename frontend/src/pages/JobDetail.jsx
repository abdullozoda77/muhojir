import { Link, useParams } from "react-router-dom";
import { Building2, CalendarClock, ChevronRight, ExternalLink, Globe, Map as MapIcon, MapPin, ShieldAlert } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago, date, salary } from "../format.js";
import { industry } from "../constants.js";
import { OfficialLink, Perks, SOURCE_NAME, SaveButton, SourceBadge, VerifiedBadge, placeOf } from "../components/JobCard.jsx";
import { Stars, average } from "../components/Stars.jsx";
import { BackLink, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";
import { Intro, IntroItem, Reveal } from "../components/motion.jsx";

// One job: the title and salary on the page, the address, perks and description in a card; the employer, the
// official ad and a note on the right.

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
      <BackLink to="/jobs">{t("Ҳамаи ҷойҳои корӣ")}</BackLink>

      {job.employer.is_blacklisted && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-error-container p-4 text-on-error-container">
          <ShieldAlert className="h-5 w-5 shrink-0 text-error" aria-hidden />
          <p className="font-semibold">{t("Ин корфармо дар рӯйхати сиёҳ аст. Эҳтиёт шавед!")}</p>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <article className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          {/* The job's header, plain on the page: badges, the title, the salary. */}
          <Intro as="header" className="flex flex-col gap-4">
            <IntroItem className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-container-high px-2 py-1 text-label-sm text-on-surface">
                <Industry className="h-3.5 w-3.5" aria-hidden />
                {industry(job.industry).label}
              </span>
              {job.employer.is_verified && <VerifiedBadge />}
              <SourceBadge />
              <span className="text-body-sm text-on-surface-variant">{ago(job.created_at)}</span>
            </IntroItem>
            <IntroItem as="h1" className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[44px]">{job.title}</IntroItem>
            <IntroItem as="p" className="text-[24px] font-semibold tracking-tight text-primary md:text-[28px]">{salary(job)}</IntroItem>
          </Intro>
          <Reveal className="card flex flex-col gap-6 p-6 md:p-8">
            {placeOf(job) && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-3 text-body-lg">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
                  <span><span className="block text-body-sm text-on-surface-variant">{t("Суроғаи кор")}</span>{placeOf(job)}</span>
                </p>
                <a href={`https://yandex.ru/maps/?text=${encodeURIComponent(placeOf(job))}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] shrink-0 items-center gap-2 self-start rounded-xl px-3.5 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low sm:self-auto">
                  <MapIcon className="h-4 w-4" aria-hidden />
                  {t("Дар харита")}
                </a>
              </div>
            )}
            <Perks job={job} />
            <div className="border-t border-outline-variant pt-6">
              <h2 className="mb-3 text-[19px] font-semibold">{t("Тавсифи кор")}</h2>
              <p className="whitespace-pre-line text-[16px] leading-7">{job.description}</p>
            </div>
            <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <CalendarClock className="h-4 w-4" aria-hidden />
              {t("Эълон то {0} фаъол аст", date(job.expires_at))}
            </p>
          </Reveal>
        </article>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <Link to={`/employers/${job.employer.id}`} className="card group flex flex-col gap-3 p-5 transition-colors hover:ring-outline/50">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
                <Building2 className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-label-lg">{job.employer.name}</p>
                <p className="text-body-sm text-on-surface-variant">{job.employer.city}</p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 text-outline transition-transform group-hover:translate-x-0.5" aria-hidden />
            </div>
            <div className="flex items-center gap-2">
              <Stars value={rating ?? 0} />
              <span className="text-label-md">{rating ? rating.toFixed(1) : "—"}</span>
              <span className="text-body-sm text-on-surface-variant">({t("{0} шарҳ", reviews.data?.count ?? 0)})</span>
            </div>
          </Link>
          {!closed && (
            <div className="fixed bottom-[96px] left-4 right-20 z-40 flex gap-2 lg:static">
              <OfficialLink job={job} className="min-h-[48px] flex-1 text-label-lg shadow-lg lg:shadow-none" />
              <SaveButton job={job} className="min-h-[48px] bg-surface-container-lowest shadow-lg lg:shadow-none" />
            </div>
          )}
          {job.employer.website && (
            <a href={job.employer.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
              <Globe className="h-4 w-4" aria-hidden />
              {t("Ширкат дар сайти расмӣ")}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
          <p className="px-1 text-body-sm text-on-surface-variant">
            {t("Ин эълон аз сайти давлатии «{0}» гирифта шудааст. Ариза ва тамос бо корфармо — дар он сайт. Пеш аз сафар шартҳоро бо корфармо санҷед.", SOURCE_NAME)}
          </p>
          {closed && <p className="card p-4 text-body-md text-on-surface-variant">{t("Ин эълон пӯшида аст.")}</p>}
        </aside>
      </div>
    </div>
  );
}

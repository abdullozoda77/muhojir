import { useParams } from "react-router-dom";
import { Building2, ExternalLink, ShieldAlert } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { JobRow, SourceBadge, VerifiedBadge } from "../components/JobCard.jsx";
import { PayStats, ReviewList, useReviews } from "../components/EmployerReview.jsx";
import { BackLink, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";
import { Intro, IntroItem, Reveal } from "../components/motion.jsx";
import { ReportsList } from "../components/Blacklist.jsx";

export default function EmployerPage() {
  const { id } = useParams();
  const employer = useApi(`/jobs/employers/${id}/`);
  const reviews = useReviews(id);
  const jobs = useApi(`/jobs/jobs/?employer=${id}`);

  if (employer.loading && !employer.data) return <Skeleton className="h-96" />;
  if (employer.error) return employer.error.status === 404 ? <EmptyState title={t("Корфармо ёфт нашуд")} /> : <ErrorBox error={employer.error} />;

  const e = employer.data;
  return (
    <div className="flex flex-col gap-6">
      <BackLink to="/jobs">{t("Ҷойи кор")}</BackLink>

      {e.is_blacklisted && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-error-container p-5 text-on-error-container">
          <ShieldAlert className="h-6 w-6 shrink-0 text-error" aria-hidden />
          <div>
            <p className="text-[17px] font-semibold text-error">{t("Ин ширкат дар рӯйхати сиёҳ аст")}</p>
            {e.blacklist_reason && <p className="mt-1 text-body-md"><strong>{t("Сабаб")}:</strong> {e.blacklist_reason}</p>}
            <p className="mt-1 text-body-sm">{t("Ба ин ширкат кор накунед.")}</p>
          </div>
        </div>
      )}

      {e.reports_count > 0 && (
        <section className="card flex flex-col gap-4 border-l-[3px] border-error p-5">
          <p className="flex items-center gap-2 font-semibold text-error">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
            {t("Коргарон ин корфарморо ба рӯйхати сиёҳ илова кардаанд: {0}", e.reports_count)}
          </p>
          <ReportsList employerId={e.id} tick={`${e.reports_count}-${e.not_paid}`} onChange={employer.reload} />
        </section>
      )}

      <Intro as="section" className="flex flex-col gap-5 md:flex-row md:items-center">
        <IntroItem className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low ring-1 ring-outline-variant">
          <Building2 className="h-7 w-7" aria-hidden />
        </IntroItem>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <IntroItem className="flex flex-wrap items-center gap-2">
            {e.is_verified && <VerifiedBadge />}
            {e.source === "trudvsem" && <SourceBadge />}
          </IntroItem>
          <IntroItem as="h1" className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[40px]">{e.name}</IntroItem>
          <IntroItem as="p" className="text-body-md text-on-surface-variant">{[e.city, e.inn && `ИНН: ${e.inn}`].filter(Boolean).join(" · ")}</IntroItem>
          <IntroItem>
            <PayStats employer={e} />
          </IntroItem>
        </div>
        {e.website && (
          <a href={e.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low md:self-auto">
            <ExternalLink className="h-4 w-4" aria-hidden />
            {t("Сайт")}
          </a>
        )}
      </Intro>
      <div className="h-px bg-outline-variant" />
      {e.description && <p className="max-w-3xl whitespace-pre-line text-[16px] leading-7 text-on-surface-variant">{e.description}</p>}

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <Reveal as="section" className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <h2 className="text-[20px] font-semibold">{t("Шарҳҳои коргарон")}</h2>
          <ReviewList employerId={e.id} reviews={reviews} onChange={employer.reload} />
        </Reveal>
        <Reveal as="section" delay={0.1} className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <h2 className="text-[20px] font-semibold">{t("Эълонҳои ин ширкат")}</h2>
          {jobs.data?.results?.length ? (
            <div className="card flex flex-col divide-y divide-outline-variant p-2">
              {jobs.data.results.map((j) => (
                <JobRow key={j.id} job={j} compact />
              ))}
            </div>
          ) : (
            <p className="card p-7 text-body-md text-on-surface-variant">{t("Ҳоло эълони фаъол нест.")}</p>
          )}
        </Reveal>
      </div>
    </div>
  );
}

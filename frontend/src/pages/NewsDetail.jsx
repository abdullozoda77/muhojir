import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";

export default function NewsDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi(`/documents/news/${id}/`);
  if (loading) return <Skeleton className="h-96" />;
  if (error) return error.status === 404 ? <EmptyState title={t("Хабар ёфт нашуд")} /> : <ErrorBox error={error} />;
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link to="/guides#news" className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full px-4 text-label-md text-on-surface-variant ring-1 ring-outline-variant hover:bg-surface-container-lowest hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("Ҳамаи хабарҳо")}
      </Link>
      {/* The news header: dark blue with the flag line, like a job's. */}
      <header className="relative flex flex-col gap-4 overflow-hidden rounded-[36px] bg-navy p-6 text-white md:p-9">
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-container/50 blur-3xl" />
        <div className="flag-line absolute inset-x-0 bottom-0 h-[5px]" />
        <span className="relative inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-label-md text-gold ring-1 ring-white/20">
          <CalendarDays className="h-4 w-4" aria-hidden />
          {date(data.published_at || data.created_at)}
        </span>
        <h1 className="relative font-display text-[30px] font-black leading-[1.1] md:text-[44px]">{data.title}</h1>
        {data.summary && <p className="relative text-body-lg text-white/80 md:text-[18px] md:leading-7">{data.summary}</p>}
      </header>
      <div className="card whitespace-pre-line p-6 text-body-lg md:p-9">{data.body}</div>
      {data.source_url && (
        <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 self-start rounded-full bg-surface-container-lowest px-6 text-label-lg text-primary ring-1 ring-outline-variant hover:bg-surface-container-low">
          {t("Манбаъ")}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}
    </article>
  );
}

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
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
    <article className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to="/guides#news" className="inline-flex min-h-[44px] items-center gap-2 self-start text-label-md text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("Ҳамаи хабарҳо")}
      </Link>
      <span className="text-label-md text-secondary">{date(data.published_at || data.created_at)}</span>
      <h1 className="text-headline-lg md:text-headline-xl">{data.title}</h1>
      <p className="text-body-lg font-semibold text-on-surface-variant">{data.summary}</p>
      <div className="card whitespace-pre-line p-4 text-body-lg md:p-8">{data.body}</div>
      {data.source_url && (
        <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 self-start rounded-xl bg-surface-container-low px-5 text-label-lg text-primary hover:bg-surface-container">
          {t("Манбаъ")}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}
    </article>
  );
}

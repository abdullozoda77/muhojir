import { useParams } from "react-router-dom";
import { CalendarDays, ExternalLink } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { date } from "../format.js";
import { BackLink, EmptyState, ErrorBox, Skeleton } from "../components/ui.jsx";
import { Intro, IntroItem, Reveal } from "../components/motion.jsx";

// One law news item, set like an article: the date, a big title, the summary as a lead, then the text.
export default function NewsDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi(`/documents/news/${id}/`);
  if (loading) return <Skeleton className="h-96" />;
  if (error) return error.status === 404 ? <EmptyState title={t("Хабар ёфт нашуд")} /> : <ErrorBox error={error} />;
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 pt-2 md:pt-6">
      <BackLink to="/guides#news">{t("Ҳамаи хабарҳо")}</BackLink>
      <Intro as="header" className="flex flex-col gap-4">
        <IntroItem as="span" className="inline-flex items-center gap-2 text-label-md text-on-surface-variant">
          <CalendarDays className="h-4 w-4" aria-hidden />
          {date(data.published_at || data.created_at)}
        </IntroItem>
        <IntroItem as="h1" className="text-[32px] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[44px]">{data.title}</IntroItem>
        {data.summary && <IntroItem as="p" className="text-[18px] leading-8 text-on-surface-variant md:text-[20px]">{data.summary}</IntroItem>}
      </Intro>
      <Reveal className="whitespace-pre-line border-t border-outline-variant pt-8 text-[17px] leading-8">{data.body}</Reveal>
      {data.source_url && (
        <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
          {t("Манбаъ")}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      )}
    </article>
  );
}

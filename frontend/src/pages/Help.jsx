import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ExternalLink, Flag, MessageCircleQuestion, Phone, Scale, SearchCheck } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { PageHeader, Skeleton } from "../components/ui.jsx";

const KINDS = {
  info: { label: () => t("Дар бораи патент хонед"), icon: BookOpen },
  embassy: { label: () => t("Сафорат ва консулгарӣ"), icon: Flag },
  hotline: { label: () => t("Хатҳои ёрӣ"), icon: Phone },
  lawyer: { label: () => t("Ҳуқуқшиносон"), icon: Scale },
  other: { label: () => t("Дигар"), icon: MessageCircleQuestion },
};

function Contacts() {
  const { data, loading } = useApi("/help/contacts/?page_size=100");
  const list = data?.results || [];
  if (loading) return <Skeleton className="h-40" />;
  if (!list.length) return <p className="card p-6 text-body-md text-on-surface-variant">{t("Сайтҳои расмӣ ба наздикӣ аз ҷониби админ илова мешаванд.")}</p>;
  return Object.entries(KINDS)
    .filter(([kind]) => list.some((c) => c.kind === kind))
    .map(([kind, info]) => (
      <section key={kind} className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-headline-sm">
          <info.icon className="h-5 w-5 text-secondary" aria-hidden />
          {info.label()}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list
            .filter((c) => c.kind === kind)
            .map((c) => (
              <article key={c.id} className="card flex flex-col gap-2 p-4">
                <h3 className="text-label-lg">{c.title}</h3>
                {c.region_name && <p className="text-body-sm text-on-surface-variant">{c.region_name}</p>}
                {c.description && <p className="whitespace-pre-line text-body-sm">{c.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-primary px-4 text-label-md text-on-primary">
                      <Phone className="h-4 w-4" aria-hidden />
                      {c.phone}
                    </a>
                  )}
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-surface-container-low px-4 text-label-md text-primary hover:bg-surface-container">
                      {c.phone ? t("Сайт") : t("Кушодани сайт")}
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </div>
              </article>
            ))}
        </div>
      </section>
    ));
}

export default function Help() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Кӯмак ва бехатарӣ")} title={t("Маркази ёрии ҳуқуқӣ")} text={t("Сайтҳои расмӣ дар бораи патент ва қонунҳои Русия.")} />
      <Link to="/checks" className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-banner p-4 text-white shadow-sm md:p-6">
        <span className="flex items-center gap-3">
          <SearchCheck className="h-7 w-7 shrink-0" aria-hidden />
          <span>
            <span className="block text-headline-sm">{t("Санҷиши ҳуҷҷатҳо")}</span>
            <span className="text-body-sm text-on-navy">{t("Патент, манъи даромадан ва қарзҳоро дар сайтҳои расмӣ санҷед.")}</span>
          </span>
        </span>
        <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
      </Link>
      <Contacts />
    </div>
  );
}

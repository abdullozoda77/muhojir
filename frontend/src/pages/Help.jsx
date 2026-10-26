import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ExternalLink, Flag, MessageCircleQuestion, Phone, Scale, SearchCheck } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { PageHeader, Skeleton } from "../components/ui.jsx";
import { Reveal } from "../components/motion.jsx";

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
  if (!list.length) return <p className="card p-7 text-body-md text-on-surface-variant">{t("Сайтҳои расмӣ ба наздикӣ аз ҷониби админ илова мешаванд.")}</p>;
  return Object.entries(KINDS)
    .filter(([kind]) => list.some((c) => c.kind === kind))
    .map(([kind, info]) => (
      <Reveal as="section" key={kind} className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-[19px] font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15">
            <info.icon className="h-5 w-5" aria-hidden />
          </span>
          {info.label()}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list
            .filter((c) => c.kind === kind)
            .map((c) => (
              <article key={c.id} className="card flex flex-col gap-2 p-5 transition-colors hover:ring-outline/50">
                <h3 className="text-[16px] font-semibold leading-snug">{c.title}</h3>
                {c.region_name && <p className="text-body-sm text-on-surface-variant">{c.region_name}</p>}
                {c.description && <p className="whitespace-pre-line text-body-sm text-on-surface-variant">{c.description}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90">
                      <Phone className="h-4 w-4" aria-hidden />
                      {c.phone}
                    </a>
                  )}
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
                      {c.phone ? t("Сайт") : t("Кушодани сайт")}
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </div>
              </article>
            ))}
        </div>
      </Reveal>
    ));
}

export default function Help() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Кӯмак ва бехатарӣ")} title={t("Маркази ёрии ҳуқуқӣ")} text={t("Сайтҳои расмӣ дар бораи патент ва қонунҳои Русия.")} icon={Scale} />
      <Link to="/checks" className="card group flex items-center justify-between gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(16_36_84/0.35)] hover:ring-outline/50 md:p-6">
        <span className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink">
            <SearchCheck className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-[18px] font-semibold leading-tight">{t("Санҷиши ҳуҷҷатҳо")}</span>
            <span className="text-body-sm text-on-surface-variant">{t("Патент, манъи даромадан ва қарзҳоро дар сайтҳои расмӣ санҷед.")}</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
      <Contacts />
    </div>
  );
}

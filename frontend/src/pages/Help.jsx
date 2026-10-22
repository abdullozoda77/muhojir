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
  if (!list.length) return <p className="card p-7 text-body-md text-on-surface-variant">{t("Сайтҳои расмӣ ба наздикӣ аз ҷониби админ илова мешаванд.")}</p>;
  return Object.entries(KINDS)
    .filter(([kind]) => list.some((c) => c.kind === kind))
    .map(([kind, info]) => (
      <section key={kind} className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 font-display text-[22px] font-extrabold text-navy dark:text-on-surface">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
            <info.icon className="h-5 w-5" aria-hidden />
          </span>
          {info.label()}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list
            .filter((c) => c.kind === kind)
            .map((c) => (
              <article key={c.id} className="card flex flex-col gap-2 p-6 transition-transform hover:-translate-y-0.5">
                <h3 className="font-display text-[18px] font-bold leading-snug">{c.title}</h3>
                {c.region_name && <p className="text-body-sm text-on-surface-variant">{c.region_name}</p>}
                {c.description && <p className="whitespace-pre-line text-body-sm">{c.description}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-navy px-5 text-label-md text-white hover:brightness-125 dark:bg-primary dark:text-on-primary">
                      <Phone className="h-4 w-4" aria-hidden />
                      {c.phone}
                    </a>
                  )}
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-surface-container-lowest px-5 text-label-md text-primary ring-1 ring-outline-variant hover:bg-surface-container-low">
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
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Кӯмак ва бехатарӣ")} title={t("Маркази ёрии ҳуқуқӣ")} text={t("Сайтҳои расмӣ дар бораи патент ва қонунҳои Русия.")} icon={Scale} />
      {/* The way to the self-checks: dark blue, like a job's header, with the flag line at its foot. */}
      <Link to="/checks" className="group relative flex min-h-[64px] items-center justify-between gap-4 overflow-hidden rounded-[32px] bg-navy p-6 text-white shadow-[0_18px_36px_-18px_rgb(16_38_92/0.8)] md:p-8">
        <div aria-hidden className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
        <div className="flag-line absolute inset-x-0 bottom-0 h-[5px]" />
        <span className="relative flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <SearchCheck className="h-6 w-6" aria-hidden />
          </span>
          <span>
            <span className="block font-display text-[22px] font-extrabold leading-tight md:text-[26px]">{t("Санҷиши ҳуҷҷатҳо")}</span>
            <span className="text-body-md text-white/75">{t("Патент, манъи даромадан ва қарзҳоро дар сайтҳои расмӣ санҷед.")}</span>
          </span>
        </span>
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-navy transition-transform group-hover:translate-x-1">
          <ArrowRight className="h-5 w-5" aria-hidden />
        </span>
      </Link>
      <Contacts />
    </div>
  );
}

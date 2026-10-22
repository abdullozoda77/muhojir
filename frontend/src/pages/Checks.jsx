import { ExternalLink, Info, SearchCheck } from "lucide-react";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";

// Official pages where people check their own papers (admins keep the list: help contacts of kind "mvd_check").
// Each description holds the steps, one per line.
const stepsOf = (check) => (check.description || "").split("\n").map((s) => s.trim()).filter(Boolean);

export default function Checks() {
  const { data, error, loading } = useApi("/help/contacts/?kind=mvd_check&page_size=50");
  const checks = data?.results || [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Сайтҳои расмии Русия")} title={t("Санҷиши ҳуҷҷатҳо")} text={t("Худатон санҷед: патент эътибор дорад, манъи даромадан ё қарз нест.")} icon={SearchCheck} />
      <ErrorBox error={error} />
      <p className="flex items-start gap-4 rounded-[24px] bg-primary-fixed/70 p-5 text-body-md text-on-primary-fixed ring-1 ring-primary/15">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-navy text-white dark:bg-primary dark:text-on-primary">
          <Info className="h-5 w-5" aria-hidden />
        </span>
        {t("Сайтҳои МВД танҳо аз интернети Русия кушода мешаванд. Агар дар Тоҷикистон бошед ва сайт кушода нашавад, аз хешовандон дар Русия хоҳиш кунед.")}
      </p>
      {loading ? (
        <Skeleton className="h-64" />
      ) : checks.length === 0 ? (
        <EmptyState icon={SearchCheck} title={t("Санҷишҳо ба наздикӣ илова мешаванд")} />
      ) : (
        <Stagger className="grid gap-5 lg:grid-cols-2">
          {checks.map((check) => (
            <StaggerItem key={check.id} className="card flex flex-col gap-5 p-6 md:p-7">
              <h2 className="flex items-center gap-3 font-display text-[22px] font-extrabold text-navy dark:text-on-surface">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed">
                  <SearchCheck className="h-5 w-5" aria-hidden />
                </span>
                {check.title}
              </h2>
              <ol className="flex flex-col gap-3">
                {stepsOf(check).map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-body-md">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-label-sm text-white dark:bg-primary dark:text-on-primary">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              {check.website && (
                <a href={check.website} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 self-start rounded-full bg-navy px-6 text-label-lg text-white shadow-[0_10px_22px_-10px_rgb(16_38_92/0.8)] transition-all hover:-translate-y-px hover:brightness-125 dark:bg-primary dark:text-on-primary">
                  {t("Санҷидан")}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

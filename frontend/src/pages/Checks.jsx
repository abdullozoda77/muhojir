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
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Сайтҳои расмии Русия")} title={t("Санҷиши ҳуҷҷатҳо")} text={t("Худатон санҷед: патент эътибор дорад, манъи даромадан ё қарз нест.")} />
      <ErrorBox error={error} />
      <p className="flex items-start gap-3 rounded-2xl bg-primary-fixed/60 p-4 text-body-md">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        {t("Сайтҳои МВД танҳо аз интернети Русия кушода мешаванд. Агар дар Тоҷикистон бошед ва сайт кушода нашавад, аз хешовандон дар Русия хоҳиш кунед.")}
      </p>
      {loading ? (
        <Skeleton className="h-64" />
      ) : checks.length === 0 ? (
        <EmptyState icon={SearchCheck} title={t("Санҷишҳо ба наздикӣ илова мешаванд")} />
      ) : (
        <Stagger className="grid gap-4 lg:grid-cols-2">
          {checks.map((check) => (
            <StaggerItem key={check.id} className="card flex flex-col gap-4 p-4 md:p-6">
              <h2 className="flex items-center gap-2 text-headline-sm">
                <SearchCheck className="h-6 w-6 shrink-0 text-secondary" aria-hidden />
                {check.title}
              </h2>
              <ol className="flex flex-col gap-2.5">
                {stepsOf(check).map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-body-md">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-label-sm text-on-primary-fixed">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              {check.website && (
                <a href={check.website} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 self-start rounded-xl bg-primary px-5 text-label-lg text-on-primary hover:brightness-110">
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

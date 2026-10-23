import { useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Bookmark, Briefcase, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { industry } from "../constants.js";
import { num } from "../format.js";
import { JobRow } from "../components/JobCard.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

function Alerts() {
  const { data, error, loading, reload } = useApi("/jobs/alerts/");
  const [busy, setBusy] = useState(null);
  const alerts = data || [];

  const change = async (alert, body) => {
    setBusy(alert.id);
    await api(`/jobs/alerts/${alert.id}/`, body ? { method: "PATCH", body } : { method: "DELETE" }).catch(() => {});
    setBusy(null);
    reload();
  };

  const describe = (a) =>
    [
      a.search && `«${a.search}»`,
      a.industry && industry(a.industry).label,
      a.city,
      a.min_salary && t("аз {0} ₽", num(a.min_salary)),
      a.housing_provided && t("бо манзил"),
    ].filter(Boolean).join(" · ");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-[24px] font-extrabold text-navy dark:text-on-surface">
        <BellRing className="h-5 w-5 text-secondary" aria-hidden />
        {t("Огоҳиҳо дар бораи кори нав")}
      </h2>
      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-24" />
      ) : alerts.length === 0 ? (
        <p className="card p-4 text-body-md text-on-surface-variant">
          {t("Дар саҳифаи «Ҷойи кор» касб ё шаҳрро интихоб кунед ва «Дар бораи кори нав хабар диҳед»-ро пахш кунед. Ҳар рӯз, вақте кори нав пайдо шавад, огоҳӣ меояд.")}
        </p>
      ) : (
        alerts.map((a) => (
          <div key={a.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link to={`/jobs?${new URLSearchParams(Object.entries({ search: a.search, city: a.city, industry: a.industry, housing_provided: a.housing_provided ? "true" : "" }).filter(([, v]) => v))}`} className="text-label-lg hover:text-primary">
              {describe(a)}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-surface-container-low px-3 text-label-md">
                <input type="checkbox" className="h-5 w-5 rounded text-primary" checked={a.is_active} disabled={busy === a.id} onChange={(e) => change(a, { is_active: e.target.checked })} />
                {t("Фаъол")}
              </label>
              <Button variant="ghost" icon={Trash2} disabled={busy === a.id} onClick={() => change(a)} aria-label={t("Нест кардан")} />
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export default function SavedJobs() {
  const saved = useApi("/jobs/jobs/?saved=true&page_size=100");
  const [removed, setRemoved] = useState([]);
  const jobs = (saved.data?.results || []).filter((j) => !removed.includes(j.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Ҷойи кор")} title={t("Захира ва огоҳиҳо")} text={t("Ҷойҳои кори захирашуда ва огоҳӣ дар бораи эълонҳои нав.")} />
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-[24px] font-extrabold text-navy dark:text-on-surface">
          <Bookmark className="h-5 w-5 text-secondary" aria-hidden />
          {t("Ҷойҳои захирашуда")}
        </h2>
        <ErrorBox error={saved.error} />
        {saved.loading ? (
          <Skeleton className="h-40" />
        ) : jobs.length === 0 ? (
          <EmptyState icon={Briefcase} title={t("Ҳоло ҷойи кори захирашуда нест")} text={t("Дар рӯйхати ҷойҳои кор тугмаи захираро пахш кунед. Эълонҳои пӯшида аз ин ҷо худ ба худ мераванд.")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onSaveChange={(isSaved) => !isSaved && setRemoved((r) => [...r, job.id])} />
            ))}
          </div>
        )}
      </section>
      <Alerts />
    </div>
  );
}

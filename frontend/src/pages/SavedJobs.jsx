import { useState } from "react";
import { Link } from "react-router-dom";
import { BedDouble, BellPlus, BellRing, Bookmark, Briefcase, Trash2 } from "lucide-react";
import { api } from "../api.js";
import CityInput from "../components/CityInput.jsx";
import PushToggle from "../components/PushToggle.jsx";
import TelegramConnect from "../components/TelegramConnect.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { INDUSTRIES, industry } from "../constants.js";
import { num } from "../format.js";
import { JobRow } from "../components/JobCard.jsx";
import { Button, EmptyState, ErrorBox, Field, PageHeader, Skeleton, Switch } from "../components/ui.jsx";

const EMPTY = { search: "", city: "", industry: "", min_salary: "", housing_provided: false };

const alertLink = (a) =>
  `/jobs?${new URLSearchParams(Object.entries({ search: a.search, city: a.city, industry: a.industry, min_salary: a.min_salary || "", housing_provided: a.housing_provided ? "true" : "" }).filter(([, v]) => v))}`;

function NewAlert({ onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const empty = !form.search.trim() && !form.city.trim() && !form.industry && !form.min_salary && !form.housing_provided;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/jobs/alerts/", { method: "POST", body: { ...form, min_salary: form.min_salary ? Number(form.min_salary) : null } });
      setForm(EMPTY);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
      <h3 className="flex items-center gap-2 text-label-lg">
        <BellPlus className="h-5 w-5 text-primary" aria-hidden />
        {t("Огоҳии нав")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Касб ё калимаи калидӣ")}>
          <input className="input" value={form.search} onChange={(e) => set("search", e.target.value)} placeholder={t("Масалан: кафшергар, ронанда, анбор")} maxLength={100} />
        </Field>
        <Field label={t("Шаҳр")}>
          <CityInput className="input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Масалан: Москва")} />
        </Field>
        <Field label={t("Соҳа")}>
          <select className="input" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
            <option value="">{t("Ҳама соҳаҳо")}</option>
            {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </Field>
        <Field label={t("Маош аз (₽ дар як моҳ)")}>
          <input className="input" type="number" inputMode="numeric" min="0" step="5000" value={form.min_salary} onChange={(e) => set("min_salary", e.target.value)} placeholder="80000" />
        </Field>
      </div>
      <Switch checked={form.housing_provided} onChange={(v) => set("housing_provided", v)} icon={BedDouble} title={t("Манзил медиҳанд")} />
      <ErrorBox error={error} />
      <Button type="submit" icon={BellPlus} loading={busy} disabled={empty} className="self-start">
        {t("Сабт кардани огоҳӣ")}
      </Button>
    </form>
  );
}

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
      <h2 className="flex items-center gap-2 text-[19px] font-semibold">
        <BellRing className="h-5 w-5 text-on-surface-variant" aria-hidden />
        {t("Огоҳиҳо дар бораи кори нав")}
      </h2>
      <ErrorBox error={error} />
      {loading ? (
        <Skeleton className="h-24" />
      ) : alerts.length === 0 ? (
        <p className="card p-5 text-body-md text-on-surface-variant">
          {t("Ҳоло огоҳӣ нест. Дар поён огоҳии нав созед ё дар саҳифаи «Ҷойи кор» тугмаи «Дар бораи кори нав хабар диҳед»-ро пахш кунед.")}
        </p>
      ) : (
        <div className="card flex flex-col divide-y divide-outline-variant">
        {alerts.map((a) => (
          <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link to={alertLink(a)} className="text-label-lg transition-colors hover:text-primary">
              {describe(a)}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-3 text-label-md ring-1 ring-inset ring-outline-variant">
                <input type="checkbox" className="h-5 w-5 rounded text-primary" checked={a.is_active} disabled={busy === a.id} onChange={(e) => change(a, { is_active: e.target.checked })} />
                {t("Фаъол")}
              </label>
              <Button variant="ghost" icon={Trash2} disabled={busy === a.id} onClick={() => change(a)} aria-label={t("Нест кардан")} />
            </div>
          </div>
        ))}
        </div>
      )}
      <NewAlert onSaved={reload} />
      <div className="flex flex-col gap-3">
        <h3 className="text-label-lg">{t("Огоҳӣ ба куҷо ояд")}</h3>
        <p className="-mt-1 text-body-sm text-on-surface-variant">{t("Ҳар саҳар, вақте ҷойҳои нав аз «Работа России» меоянд, мо онҳоро бо огоҳиҳои шумо муқоиса мекунем.")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <TelegramConnect />
          <PushToggle />
        </div>
      </div>
    </section>
  );
}

export default function SavedJobs() {
  const saved = useApi("/jobs/jobs/?saved=true&page_size=100");
  const [removed, setRemoved] = useState([]);
  const jobs = (saved.data?.results || []).filter((j) => !removed.includes(j.id));

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow={t("Ҷойи кор")} icon={Bookmark} title={t("Захира ва огоҳиҳо")} text={t("Ҷойҳои кори захирашуда ва огоҳӣ дар бораи эълонҳои нав.")} />
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold">
          <Bookmark className="h-5 w-5 text-on-surface-variant" aria-hidden />
          {t("Ҷойҳои захирашуда")}
        </h2>
        <ErrorBox error={saved.error} />
        {saved.loading ? (
          <Skeleton className="h-40" />
        ) : jobs.length === 0 ? (
          <EmptyState icon={Briefcase} title={t("Ҳоло ҷойи кори захирашуда нест")} text={t("Дар рӯйхати ҷойҳои кор тугмаи захираро пахш кунед. Эълонҳои пӯшида аз ин ҷо худ ба худ мераванд.")} />
        ) : (
          <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <StaggerItem key={job.id} className="flex min-w-0">
                <JobRow job={job} onSaveChange={(isSaved) => !isSaved && setRemoved((r) => [...r, job.id])} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
      <Alerts />
    </div>
  );
}

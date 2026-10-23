import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BedDouble, BellPlus, BookOpen, Briefcase, Check, FileCheck2, MapPin, Search, ShieldAlert, ShieldCheck, Soup } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { INDUSTRIES } from "../constants.js";
import { JobRow } from "../components/JobCard.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

const TOGGLES = [
  ["housing_provided", BedDouble, () => t("Манзил медиҳанд")],
  ["meals_provided", Soup, () => t("Хӯрок медиҳанд")],
  ["helps_with_documents", FileCheck2, () => t("Ёрӣ бо ҳуҷҷатҳо")],
];

function Blacklist() {
  const { data } = useApi("/jobs/employers/?is_blacklisted=true&page_size=5");
  return (
    <div className="card flex scroll-mt-28 flex-col gap-4 border-l-[3px] border-error p-5" id="blacklist">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-error" aria-hidden />
        <div>
          <h2 className="text-[16px] font-semibold">{t("Рӯйхати сиёҳи корфармоён")}</h2>
          <p className="text-body-sm text-on-surface-variant">{t("Ширкатҳое, ки админ аз рӯи шикоятҳо санҷидааст")}</p>
        </div>
      </div>
      {data?.results?.length ? (
        data.results.map((e) => (
          <Link key={e.id} to={`/employers/${e.id}`} className="flex flex-col gap-1.5 rounded-xl p-4 ring-1 ring-outline-variant transition-colors hover:bg-surface-container-low">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label-lg font-semibold text-error">{e.name}</span>
              <span className="rounded-md bg-error-container px-2 py-0.5 text-label-sm text-on-error-container">{t("ХАТАР")}</span>
            </div>
            <span className="font-mono text-body-sm text-on-surface-variant">
              {[e.inn && `ИНН: ${e.inn}`, e.city].filter(Boolean).join(" • ")}
            </span>
            {e.blacklist_reason && (
              <p className="rounded bg-surface-container-low p-2 text-body-sm text-on-surface-variant">
                <strong>{t("Сабаб")}:</strong> {e.blacklist_reason}
              </p>
            )}
          </Link>
        ))
      ) : (
        <p className="rounded-xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">{t("Ҳоло дар рӯйхати сиёҳ ширкат нест.")}</p>
      )}
      <p className="text-body-sm text-on-surface-variant">
        {t("Агар корфармо маош надода бошад, дар саҳифаи ӯ шарҳ нависед ва «Маош надоданд»-ро қайд кунед. Админ шикоятҳоро месанҷад.")}
      </p>
    </div>
  );
}

function WhereJobsComeFrom() {
  return (
    <div className="card flex flex-col gap-3 p-6">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        <ShieldCheck className="h-5 w-5 text-on-surface-variant" aria-hidden />
        {t("Ин ҷойҳои кор аз куҷоянд")}
      </h2>
      {[
        t("Ҳамаи эълонҳо аз сайти давлатии «Работа России» (trudvsem.ru) гирифта мешаванд ва ҳар рӯз нав мешаванд."),
        t("Эълонҳои агентиҳои миёнарав нишон дода намешаванд."),
        t("Тамос ва ариза — дар эълони расмӣ. Пеш аз оғози кор ба касе пул надиҳед."),
      ].map((text, i) => (
        <div key={text} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-outline">{i + 1}</span>
          <p className="text-body-sm text-on-surface-variant">{text}</p>
        </div>
      ))}
    </div>
  );
}

// "Tell me about new jobs like these": keeps the current filters as an alert (see jobs/alerts.py on the server).
function AlertButton({ params }) {
  const { user } = useAuth();
  const [state, setState] = useState("idle");
  const filters = {
    search: params.get("search") || "",
    city: params.get("city") || "",
    industry: params.get("industry") || "",
    housing_provided: params.get("housing_provided") === "true",
  };
  const query = params.toString();
  useEffect(() => setState("idle"), [query]);
  if (!user) return null;
  const empty = !filters.search && !filters.city && !filters.industry && !filters.housing_provided;

  const save = async () => {
    setState("busy");
    try {
      await api("/jobs/alerts/", { method: "POST", body: filters });
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <Link to="/saved-jobs" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-tertiary-fixed px-3.5 text-label-md text-on-tertiary-fixed">
        <Check className="h-4 w-4" aria-hidden />
        {t("Огоҳӣ сабт шуд")}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={save}
      disabled={empty || state === "busy"}
      title={empty ? t("Аввал касб, шаҳр ё соҳаро интихоб кунед") : undefined}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
    >
      <BellPlus className="h-4 w-4" aria-hidden />
      {state === "error" ? t("Нашуд, боз кӯшиш кунед") : t("Дар бораи кори нав хабар диҳед")}
    </button>
  );
}

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const [page, setPage] = useState({ results: [], count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  const query = params.toString();
  const update = (key, value) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  // Typing in the search and city boxes updates the list half a second after the last key.
  useEffect(() => {
    const id = setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of [["search", search.trim()], ["city", city.trim()]]) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    }, 500);
    return () => clearTimeout(id);
  }, [search, city, setParams]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams(query);
    if (!q.get("ordering")) q.set("ordering", "-created_at");
    api(`/jobs/jobs/?${q}`)
      .then((data) => alive && setPage(data))
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  const loadMore = async () => {
    setMore(true);
    try {
      const data = await api(page.next.slice(page.next.indexOf("/api") + 4));
      setPage((p) => ({ ...data, results: [...p.results, ...data.results] }));
    } catch (err) {
      setError(err);
    } finally {
      setMore(false);
    }
  };

  const activeIndustry = params.get("industry");
  const ordering = params.get("ordering") || "-created_at";
  const jobs = page.results;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Аз сайти давлатии «Работа России»")} title={t("Ҷойи кор")} text={t("Ҷойҳои кори воқеӣ бо суроға. Ариза дар эълони расмӣ дода мешавад.")} icon={Briefcase}>
        <a href="#blacklist" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-label-md text-error ring-1 ring-inset ring-outline-variant transition-colors hover:bg-error-container">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {t("Рӯйхати сиёҳ")}
        </a>
      </PageHeader>

      {/* One big search bar: the job and the city, like a travel site. */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-lowest p-1.5 ring-1 ring-outline-variant transition-shadow focus-within:ring-2 focus-within:ring-primary/40 md:flex-row md:items-center">
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <Search className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Касб ё калимаи калидӣ")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Масалан: кафшергар, ронанда, анбор")} />
            </span>
          </label>
          <span className="hidden h-10 w-px bg-outline-variant md:block" />
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <MapPin className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Шаҳр")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("Масалан: Москва")} list="cities" />
            </span>
            <datalist id="cities">
              {["Москва", "Санкт-Петербург", "Екатеринбург", "Новосибирск", "Казань", "Краснодар", "Самара"].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <span className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-label-lg tabular-nums text-on-ink">
            <Search className="h-4 w-4" aria-hidden />
            {loading ? "…" : t("{0} ҷой", page.count)}
          </span>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => update("industry", "")} aria-pressed={!activeIndustry} className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-4 text-label-md transition-colors ${!activeIndustry ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
            {t("Ҳама соҳаҳо")}
          </button>
          {INDUSTRIES.map((i) => (
            <button key={i.value} type="button" onClick={() => update("industry", activeIndustry === i.value ? "" : i.value)} aria-pressed={activeIndustry === i.value} className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-label-md transition-colors ${activeIndustry === i.value ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
              <i.icon className="h-4 w-4" aria-hidden />
              {i.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {TOGGLES.map(([key, Icon, label]) => {
              const on = params.get(key) === "true";
              return (
                <button key={key} type="button" onClick={() => update(key, on ? "" : "true")} aria-pressed={on} className={`flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-label-md transition-colors ${on ? "bg-tertiary-fixed text-on-tertiary-fixed ring-1 ring-inset ring-tertiary-container" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
                  {on ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                  {label()}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 self-end lg:self-auto">
            <AlertButton params={params} />
            <div className="inline-flex rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
              {[
                ["-created_at", t("Навтаринҳо")],
                ["-salary_to", t("Маоши баланд")],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => update("ordering", value === "-created_at" ? "" : value)} aria-pressed={ordering === value} className={`min-h-[34px] rounded-lg px-3.5 text-label-md transition-colors ${ordering === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <ErrorBox error={error} />
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>
          ) : jobs.length === 0 ? (
            <EmptyState icon={Briefcase} title={t("Чунин ҷойи кор ёфт нашуд")} text={t("Филтрҳоро кам кунед ё шаҳри дигарро нависед.")} />
          ) : (
            <>
              <Stagger key={query} className="grid gap-4 md:grid-cols-2">
                {jobs.map((job) => (
                  <StaggerItem key={job.id} className="flex min-w-0">
                    <JobRow job={job} />
                  </StaggerItem>
                ))}
              </Stagger>
              {page.next && (
                <Button variant="plain" loading={more} onClick={loadMore} className="self-center">
                  {t("Боз нишон додан")}
                </Button>
              )}
            </>
          )}
        </div>
        <aside className="grid gap-4 md:grid-cols-2 xl:sticky xl:top-24 xl:flex xl:flex-col">
          <Blacklist />
          <WhereJobsComeFrom />
          <Link to="/help" className="card group flex flex-col gap-2 p-5 transition-colors hover:ring-outline/50">
            <span className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-on-surface-variant" aria-hidden />
              <span className="text-[16px] font-semibold">{t("Ҳуқуқҳои худро донед")}</span>
            </span>
            <span className="text-body-sm text-on-surface-variant">{t("Қонунҳои Русия дар бораи кори муҳоҷирон — дар сайтҳои расмӣ.")}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-label-md text-primary">
              {t("Сайтҳои расмӣ")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

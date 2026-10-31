import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BedDouble, BellPlus, BookOpen, Briefcase, Check, FileCheck2, MapPin, Search, ShieldAlert, ShieldCheck, Soup } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { INDUSTRIES } from "../constants.js";
import { JobRow } from "../components/JobCard.jsx";
import { BlacklistCompany } from "../components/Blacklist.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { ActiveFilters, ChipRow, FilterBar, FilterGroup, FilterSheet, OptionGrid, SortSelect, chipClass } from "../components/Filters.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton, Switch } from "../components/ui.jsx";

const TOGGLES = [
  ["housing_provided", BedDouble, () => t("Манзил медиҳанд")],
  ["meals_provided", Soup, () => t("Хӯрок медиҳанд")],
  ["helps_with_documents", FileCheck2, () => t("Ёрӣ бо ҳуҷҷатҳо")],
];

function Blacklist() {
  const { data, reload } = useApi("/jobs/blacklist/?page_size=4&reports=2");
  return (
    <div className="card flex scroll-mt-28 flex-col gap-4 border-l-[3px] border-error p-5" id="blacklist">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-error" aria-hidden />
        <div>
          <h2 className="text-[16px] font-semibold">{t("Рӯйхати сиёҳи корфармоён")}</h2>
          <p className="text-body-sm text-on-surface-variant">{t("Шикоятҳои коргарон ва ширкатҳое, ки админ санҷидааст")}</p>
        </div>
      </div>
      {data?.results?.length ? (
        data.results.map((e) => <BlacklistCompany key={e.id} e={e} onChange={reload} />)
      ) : (
        <p className="rounded-xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">{t("Ҳоло дар рӯйхати сиёҳ ширкат нест.")}</p>
      )}
      {data?.count > 0 && (
        <Link to="/blacklist" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-label-md text-error ring-1 ring-inset ring-outline-variant transition-colors hover:bg-error-container">
          {t("Ҳамаи рӯйхат ({0})", data.count)}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
      <p className="text-body-sm text-on-surface-variant">
        {t("Корфармо маош надод ё фиреб дод? Дар эълони кор тугмаи {0}-ро пахш кунед ва сабабро нависед — ҳама онро мебинанд.", "⊘")}
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
      <Link to="/saved-jobs" aria-label={t("Огоҳӣ сабт шуд")} className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-tertiary-fixed px-3 text-label-md text-on-tertiary-fixed">
        <Check className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t("Огоҳӣ сабт шуд")}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={save}
      disabled={empty || state === "busy"}
      title={empty ? t("Аввал касб, шаҳр ё соҳаро интихоб кунед") : t("Дар бораи кори нав хабар диҳед")}
      aria-label={t("Дар бораи кори нав хабар диҳед")}
      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-3 text-label-md text-on-surface ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
    >
      <BellPlus className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{state === "error" ? t("Нашуд, боз кӯшиш кунед") : t("Дар бораи кори нав хабар диҳед")}</span>
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
  const [sheet, setSheet] = useState(false);

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
  const active = TOGGLES.filter(([key]) => params.get(key) === "true").map(([key, , label]) => ({ key, label: label(), onRemove: () => update(key, "") }));
  const resetFilters = () => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key] of TOGGLES) next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Аз сайти давлатии «Работа России»")} title={t("Ҷойи кор")} text={t("Ҷойҳои кори воқеӣ бо суроға. Ариза дар эълони расмӣ дода мешавад.")} icon={Briefcase}>
        <Link to="/blacklist" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-label-md text-error ring-1 ring-inset ring-outline-variant transition-colors hover:bg-error-container">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {t("Рӯйхати сиёҳ")}
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-lowest p-1.5 ring-1 ring-outline-variant transition-shadow focus-within:ring-2 focus-within:ring-primary/40 md:flex-row md:items-center">
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <Search className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Касб ё калимаи калидӣ")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Масалан: кафшергар, ронанда, анбор")} />
            </span>
          </label>
          <span className="mx-4 h-px bg-outline-variant md:mx-0 md:h-10 md:w-px" />
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
          <span className="hidden h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-label-lg tabular-nums text-on-ink md:flex">
            <Search className="h-4 w-4" aria-hidden />
            {loading ? "…" : t("{0} ҷой", page.count)}
          </span>
        </div>

        <ChipRow>
          <button type="button" onClick={() => update("industry", "")} aria-pressed={!activeIndustry} className={chipClass(!activeIndustry)}>
            {t("Ҳама соҳаҳо")}
          </button>
          {INDUSTRIES.map((i) => (
            <button key={i.value} type="button" onClick={() => update("industry", activeIndustry === i.value ? "" : i.value)} aria-pressed={activeIndustry === i.value} className={chipClass(activeIndustry === i.value)}>
              <i.icon className="h-4 w-4" aria-hidden />
              {i.label}
            </button>
          ))}
        </ChipRow>

        <div className="flex flex-col gap-3">
          <FilterBar
            count={active.length}
            onOpen={() => setSheet(true)}
            sort={
              <SortSelect
                value={ordering}
                onChange={(v) => update("ordering", v === "-created_at" ? "" : v)}
                options={[
                  ["-created_at", t("Навтаринҳо")],
                  ["-salary_to", t("Маоши баланд")],
                ]}
              />
            }
          >
            <AlertButton params={params} />
          </FilterBar>
          <ActiveFilters items={active} onReset={resetFilters} />
        </div>
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} onReset={resetFilters} count={active.length} total={page.count} loading={loading}>
        <FilterGroup title={t("Шароит")}>
          {TOGGLES.map(([key, Icon, label]) => (
            <Switch key={key} checked={params.get(key) === "true"} onChange={(on) => update(key, on ? "true" : "")} icon={Icon} title={label()} />
          ))}
        </FilterGroup>
        <FilterGroup title={t("Тартиб")}>
          <OptionGrid
            value={ordering}
            onChange={(v) => update("ordering", v === "-created_at" ? "" : v)}
            options={[
              ["-created_at", t("Навтаринҳо")],
              ["-salary_to", t("Маоши баланд")],
            ]}
          />
        </FilterGroup>
      </FilterSheet>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <p className="-mb-2 text-label-md tabular-nums text-on-surface-variant md:hidden">{loading ? "…" : t("{0} ҷой", page.count)}</p>
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

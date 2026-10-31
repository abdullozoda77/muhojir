import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Camera, MapPin, Pencil, Plus, Search, ShieldAlert, Users } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { CITIES } from "../constants.js";
import { DeleteHousing, FLAGS, FOR_WHOM, HOUSING_KINDS, HousingCard, HousingForm } from "../components/Housing.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { ActiveFilters, ChipRow, FilterBar, FilterGroup, FilterSheet, OptionGrid, SortSelect, chipClass } from "../components/Filters.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton, Switch } from "../components/ui.jsx";

const PRICES = [10000, 15000, 25000, 40000];

function usePaged(path) {
  const [page, setPage] = useState({ results: [], count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    api(path)
      .then((data) => alive && setPage(data))
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);

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
  const replace = (item) => setPage((p) => ({ ...p, results: p.results.map((r) => (r.id === item.id ? item : r)) }));
  const drop = (item) => setPage((p) => ({ ...p, count: p.count - 1, results: p.results.filter((r) => r.id !== item.id) }));
  const prepend = (item) => setPage((p) => (p.results.some((r) => r.id === item.id) ? p : { ...p, count: p.count + 1, results: [item, ...p.results] }));
  return { page, loading, more, error, loadMore, replace, drop, prepend };
}

function Safety() {
  return (
    <div className="card flex flex-col gap-3 border-l-[3px] border-error p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        <ShieldAlert className="h-5 w-5 text-error" aria-hidden />
        {t("Аз фиребгарон эҳтиёт шавед")}
      </h2>
      {[
        t("То хонаро бо чашми худ надидаед, пул ва гарав надиҳед."),
        t("Шартнома ё ақаллан расиди пардохтро талаб кунед."),
        t("Бақайдгирии «бе хона» харидан ғайриқонунӣ аст — танҳо дар ҷое, ки зиндагӣ мекунед."),
      ].map((text, i) => (
        <div key={text} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-outline">{i + 1}</span>
          <p className="text-body-sm text-on-surface-variant">{text}</p>
        </div>
      ))}
    </div>
  );
}

function PostCard({ onNew }) {
  return (
    <div className="card flex flex-col gap-3 border-l-[3px] border-primary p-5">
      <span className="flex items-center gap-2 text-[16px] font-semibold">
        <Building2 className="h-5 w-5 text-primary" aria-hidden />
        {t("Ҷойи холӣ доред?")}
      </span>
      <p className="text-body-sm text-on-surface-variant">{t("Ҷойи хоб, ҳуҷра ё хонаро ройгон эълон кунед. Пас аз санҷиш ҳамватанон онро мебинанд.")}</p>
      <Button icon={Plus} onClick={onNew}>{t("Эълон додан")}</Button>
    </div>
  );
}

export default function Housing() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("max_price") || "");
  const [editing, setEditing] = useState(undefined);
  const [sheet, setSheet] = useState(false);
  const { data: summary, reload: reloadSummary } = useApi("/housing/summary/");
  const mine = params.get("tab") === "mine";

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
          for (const [key, value] of [["search", search.trim()], ["city", city.trim()], ["max_price", maxPrice]]) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    }, 400);
    return () => clearTimeout(id);
  }, [search, city, maxPrice, setParams]);

  const q = new URLSearchParams(params);
  q.delete("tab");
  if (mine) q.set("mine", "true");
  const path = `/housing/?${q}`;
  const { page, loading, more, error, loadMore, replace, drop, prepend } = usePaged(path);
  const kind = params.get("kind");
  const forWhom = params.get("for_whom") || "";
  const ordering = params.get("ordering") || "";
  const cities = summary?.cities?.length ? summary.cities.map((c) => c.name) : CITIES;
  const filtered = ["kind", "for_whom", "max_price", "registration", "utilities_included", "no_deposit", "with_photos", "source", "search", "city"].some((k) => params.get(k));

  const forWhomLabel = FOR_WHOM.find((w) => w.value === forWhom)?.label;
  const sourceLabel = { user: t("Аз корбарони сайт"), telegram: t("Аз Telegram") }[params.get("source")];
  const active = [
    maxPrice && { key: "max_price", label: t("то {0} ₽", Number(maxPrice).toLocaleString("ru-RU")), onRemove: () => setMaxPrice("") },
    forWhomLabel && { key: "for_whom", label: forWhomLabel, onRemove: () => update("for_whom", "") },
    ...FLAGS.filter((f) => params.get(f.key) === "true").map((f) => ({ key: f.key, label: f.label, onRemove: () => update(f.key, "") })),
    params.get("with_photos") === "true" && { key: "with_photos", label: t("Бо акс"), onRemove: () => update("with_photos", "") },
    sourceLabel && { key: "source", label: sourceLabel, onRemove: () => update("source", "") },
  ].filter(Boolean);
  const resetFilters = () => {
    setMaxPrice("");
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of ["for_whom", "max_price", "registration", "utilities_included", "no_deposit", "with_photos", "source"]) next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const saved = (item) => {
    if (mine) {
      if (page.results.some((r) => r.id === item.id)) replace(item);
      else prepend(item);
    } else if (page.results.some((r) => r.id === item.id)) {
      replace(item);
    }
    reloadSummary?.();
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Аз ҳамватанон барои ҳамватанон")} title={t("Манзил")} text={t("Ҷойи хоб, ҳуҷра ва хона барои муҳоҷирон дар шаҳрҳои Русия: бо нарх, метро ва бақайдгирӣ. Бо соҳибхона бевосита гап занед.")} icon={Building2}>
        <div className="flex flex-wrap gap-2">
          {summary && (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md tabular-nums ring-1 ring-inset ring-outline-variant">
              <Building2 className="h-4 w-4 text-primary" aria-hidden />
              {t("{0} эълон", summary.total)}
            </span>
          )}
          <Button icon={Plus} onClick={() => setEditing(null)}>{t("Эълон додан")}</Button>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-5">
        <div className="inline-flex self-start rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
          {[
            ["", Search, t("Ҷустуҷӯ")],
            ["mine", Users, t("Эълонҳои ман")],
          ].map(([value, Icon, label]) => (
            <button key={value || "all"} type="button" onClick={() => update("tab", value)} aria-pressed={(mine ? "mine" : "") === value} className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg px-4 text-label-md transition-colors ${(mine ? "mine" : "") === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-lowest p-1.5 ring-1 ring-outline-variant transition-shadow focus-within:ring-2 focus-within:ring-primary/40 md:flex-row md:items-center">
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <Search className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Метро, ноҳия ё калима")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Масалан: Люблино, Wi-Fi")} />
            </span>
          </label>
          <span className="mx-4 h-px bg-outline-variant md:mx-0 md:h-10 md:w-px" />
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <MapPin className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Шаҳр")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("Масалан: Москва")} list="housing-cities" />
            </span>
            <datalist id="housing-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <span className="hidden h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-label-lg tabular-nums text-on-ink md:flex">
            <Search className="h-4 w-4" aria-hidden />
            {loading ? "…" : t("{0} эълон", page.count)}
          </span>
        </div>

        <ChipRow>
          <button type="button" onClick={() => update("kind", "")} aria-pressed={!kind} className={chipClass(!kind)}>
            {t("Ҳама")}
          </button>
          {HOUSING_KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => update("kind", kind === k.value ? "" : k.value)} aria-pressed={kind === k.value} className={chipClass(kind === k.value)}>
              <k.icon className="h-4 w-4" aria-hidden />
              {k.label}
              {!mine && summary?.kinds?.[k.value] > 0 && <span className="tabular-nums opacity-60">{summary.kinds[k.value]}</span>}
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
                onChange={(v) => update("ordering", v)}
                options={[
                  ["", t("Навтаринҳо")],
                  ["price", t("Арзонтар")],
                  ["-price", t("Гаронтар")],
                ]}
              />
            }
          />
          <ActiveFilters items={active} onReset={resetFilters} />
        </div>
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} onReset={resetFilters} count={active.length} total={page.count} loading={loading}>
        <FilterGroup title={t("Нархи моҳона")}>
          <label className="flex min-h-[48px] items-center gap-3 rounded-xl bg-surface-container-lowest px-4 ring-1 ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary/40">
            <span className="text-label-md text-on-surface-variant">{t("То нарх")}</span>
            <input className="w-full flex-1 border-0 bg-transparent p-0 text-right text-body-lg tabular-nums text-on-surface placeholder:text-outline focus:ring-0" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="20000" />
            <span className="text-[18px] font-semibold text-on-surface-variant" aria-hidden>₽</span>
          </label>
          <OptionGrid
            value={maxPrice}
            onChange={(v) => setMaxPrice(maxPrice === v ? "" : v)}
            options={PRICES.map((p) => [String(p), t("то {0} ₽", p.toLocaleString("ru-RU"))])}
          />
        </FilterGroup>
        <FilterGroup title={t("Барои кӣ")}>
          <OptionGrid value={forWhom} onChange={(v) => update("for_whom", v)} options={[["", t("Барои ҳама")], ...FOR_WHOM.filter((w) => w.value !== "any").map((w) => [w.value, w.label])]} />
        </FilterGroup>
        <FilterGroup title={t("Шароит")}>
          {FLAGS.map((f) => (
            <Switch key={f.key} checked={params.get(f.key) === "true"} onChange={(on) => update(f.key, on ? "true" : "")} icon={f.icon} title={f.label} />
          ))}
          <Switch checked={params.get("with_photos") === "true"} onChange={(on) => update("with_photos", on ? "true" : "")} icon={Camera} title={t("Бо акс")} />
        </FilterGroup>
        <FilterGroup title={t("Манбаъ")}>
          <OptionGrid
            value={params.get("source") || ""}
            onChange={(v) => update("source", v)}
            options={[
              ["", t("Ҳамаи манбаъҳо")],
              ["user", t("Аз корбарони сайт")],
              ["telegram", t("Аз Telegram")],
            ]}
          />
        </FilterGroup>
      </FilterSheet>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <p className="-mb-2 text-label-md tabular-nums text-on-surface-variant md:hidden">{loading ? "…" : t("{0} эълон", page.count)}</p>
          <ErrorBox error={error} />
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-80" />)}
            </div>
          ) : page.results.length === 0 ? (
            <EmptyState icon={Building2} title={mine ? t("Шумо ҳанӯз эълон надодаед") : t("Эълон ёфт нашуд")} text={mine ? t("Ҷойи холӣ доред? Онро эълон кунед — пас аз санҷиш ҳама мебинанд.") : filtered ? t("Филтрҳоро кам кунед ё шаҳри дигарро нависед.") : t("Ҳоло эълон нест. Аввалин шуда эълон диҳед.")}>
              <Button icon={Plus} onClick={() => setEditing(null)}>{t("Эълон додан")}</Button>
            </EmptyState>
          ) : (
            <>
              <Stagger key={path} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {page.results.map((item) => (
                  <StaggerItem key={item.id} className="flex min-w-0">
                    <HousingCard item={item}>
                      {item.is_mine && (
                        <div className="flex items-center gap-2 border-t border-outline-variant p-3">
                          {item.status === "rejected" && item.reject_reason && (
                            <p className="flex-1 text-body-sm text-error">{item.reject_reason}</p>
                          )}
                          <button type="button" onClick={() => setEditing(item)} className="ml-auto inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-label-md ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low">
                            <Pencil className="h-4 w-4" aria-hidden />
                            {t("Таҳрир")}
                          </button>
                          <DeleteHousing item={item} onDeleted={(d) => { drop(d); reloadSummary?.(); }} />
                        </div>
                      )}
                    </HousingCard>
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
          <PostCard onNew={() => setEditing(null)} />
          <Safety />
        </aside>
      </div>

      <HousingForm open={editing !== undefined} item={editing} onClose={() => setEditing(undefined)} onSaved={saved} />
    </div>
  );
}

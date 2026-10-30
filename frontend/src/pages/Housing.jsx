import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Camera, Check, MapPin, Pencil, Plus, Search, ShieldAlert, SlidersHorizontal, Users } from "lucide-react";
import { api } from "../api.js";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { CITIES } from "../constants.js";
import { DeleteHousing, FLAGS, FOR_WHOM, HOUSING_KINDS, HousingCard, HousingForm } from "../components/Housing.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

const chip = (on) =>
  `flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-label-md transition-colors ${on ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`;

const toggle = (on) =>
  `flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-label-md transition-colors ${on ? "bg-tertiary-fixed text-on-tertiary-fixed ring-1 ring-inset ring-tertiary-container" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`;

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
  const filtered = ["kind", "for_whom", "max_price", "registration", "utilities_included", "no_deposit", "with_photos", "search", "city"].some((k) => params.get(k));

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
          <span className="hidden h-10 w-px bg-outline-variant md:block" />
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <MapPin className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Шаҳр")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("Масалан: Москва")} list="housing-cities" />
            </span>
            <datalist id="housing-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <span className="hidden h-10 w-px bg-outline-variant md:block" />
          <label className="flex items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low md:w-48">
            <span className="text-[18px] font-semibold text-on-surface-variant" aria-hidden>₽</span>
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("То нарх")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg tabular-nums text-on-surface placeholder:text-outline focus:ring-0" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="20000" />
            </span>
          </label>
          <span className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-label-lg tabular-nums text-on-ink">
            <Search className="h-4 w-4" aria-hidden />
            {loading ? "…" : t("{0} эълон", page.count)}
          </span>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => update("kind", "")} aria-pressed={!kind} className={chip(!kind)}>
            {t("Ҳама")}
          </button>
          {HOUSING_KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => update("kind", kind === k.value ? "" : k.value)} aria-pressed={kind === k.value} className={chip(kind === k.value)}>
              <k.icon className="h-4 w-4" aria-hidden />
              {k.label}
              {!mine && summary?.kinds?.[k.value] > 0 && <span className="tabular-nums opacity-60">{summary.kinds[k.value]}</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-outline" aria-hidden />
          <select aria-label={t("Барои кӣ")} value={forWhom} onChange={(e) => update("for_whom", e.target.value)} className="min-h-[40px] rounded-lg border-0 bg-transparent py-0 pl-3 pr-8 text-label-md text-on-surface-variant ring-1 ring-inset ring-outline-variant focus:ring-2 focus:ring-primary/40">
            <option value="">{t("Барои ҳама")}</option>
            {FOR_WHOM.filter((w) => w.value !== "any").map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          {FLAGS.map((f) => {
            const on = params.get(f.key) === "true";
            return (
              <button key={f.key} type="button" onClick={() => update(f.key, on ? "" : "true")} aria-pressed={on} className={toggle(on)}>
                {on ? <Check className="h-4 w-4" aria-hidden /> : <f.icon className="h-4 w-4" aria-hidden />}
                {f.label}
              </button>
            );
          })}
          <button type="button" onClick={() => update("with_photos", params.get("with_photos") === "true" ? "" : "true")} aria-pressed={params.get("with_photos") === "true"} className={toggle(params.get("with_photos") === "true")}>
            {params.get("with_photos") === "true" ? <Check className="h-4 w-4" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            {t("Бо акс")}
          </button>
          <div className="ml-auto inline-flex rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
            {[
              ["", t("Навтаринҳо")],
              ["price", t("Арзонтар")],
              ["-price", t("Гаронтар")],
            ].map(([value, label]) => (
              <button key={value || "new"} type="button" onClick={() => update("ordering", value)} aria-pressed={ordering === value} className={`min-h-[34px] rounded-lg px-3.5 text-label-md transition-colors ${ordering === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {!maxPrice && (
          <div className="flex flex-wrap gap-1.5">
            {PRICES.map((p) => (
              <button key={p} type="button" onClick={() => setMaxPrice(String(p))} className="min-h-[32px] rounded-full px-3 text-label-sm tabular-nums text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface">
                {t("то {0} ₽", p.toLocaleString("ru-RU"))}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
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

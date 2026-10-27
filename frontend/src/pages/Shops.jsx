import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, MapPin, Package, Search, Store, Truck } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { CITIES, SHOP_CATEGORIES, SHOP_ORIGINS } from "../constants.js";
import { ProductCard, ShopCard } from "../components/Shop.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, EmptyState, ErrorBox, PageHeader, Skeleton } from "../components/ui.jsx";

const chip = (on) =>
  `flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-label-md transition-colors ${on ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`;

function usePaged(path) {
  const [page, setPage] = useState({ results: [], count: 0, next: null });
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  return { page, loading, more, error, loadMore };
}

function OpenShop() {
  const { user } = useAuth();
  return (
    <div className="card flex flex-col gap-3 border-l-[3px] border-primary p-5">
      <span className="flex items-center gap-2 text-[16px] font-semibold">
        <Store className="h-5 w-5 text-primary" aria-hidden />
        {t("Мағоза доред?")}
      </span>
      <p className="text-body-sm text-on-surface-variant">
        {t("Мағоза, нонвойхона ё ошхонаи худро ройгон илова кунед: молҳо, нарх ва телефон. Пас аз санҷиш ҳама онро мебинанд.")}
      </p>
      <Link to={user ? "/shops/my" : "/login"} state={user ? undefined : { from: "/shops/my" }} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90">
        {user ? t("Мағозаҳои ман") : t("Ворид шавед ва мағоза кушоед")}
      </Link>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <h2 className="text-[16px] font-semibold">{t("Чӣ тавр харидан мумкин")}</h2>
      {[
        t("Мағоза ё молро ёбед — нарх ва суроға дар саҳифаи мағоза."),
        t("Бо телефон, WhatsApp ё Telegram ба фурӯшанда бевосита нависед."),
        t("Пулро танҳо вақте диҳед, ки молро дидед ё гирифтед."),
      ].map((text, i) => (
        <div key={text} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-outline">{i + 1}</span>
          <p className="text-body-sm text-on-surface-variant">{text}</p>
        </div>
      ))}
    </div>
  );
}

export default function Shops() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const { data: summary } = useApi("/market/shops/summary/");
  const tab = params.get("tab") === "products" ? "products" : "shops";

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
    }, 400);
    return () => clearTimeout(id);
  }, [search, city, setParams]);

  const q = new URLSearchParams(params);
  q.delete("tab");
  if (tab === "products") q.set("page_size", "24");
  const path = tab === "products" ? `/market/products/?${q}` : `/market/shops/?${q}`;
  const { page, loading, more, error, loadMore } = usePaged(path);
  const category = params.get("category");
  const origin = params.get("origin");
  const delivery = params.get("delivery") === "true";
  const cities = summary?.cities?.length ? summary.cities.map((c) => c.name) : CITIES;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Аз ҳамватанон барои ҳамватанон")} title={t("Мағозаҳои тоҷикӣ ва ӯзбекӣ")} text={t("Озуқа, гӯшти ҳалол, нони тандирӣ, меваи хушк ва ошхонаҳо дар шаҳрҳои Русия. Бо фурӯшанда бевосита гап занед.")} icon={Store}>
        {summary && (
          <div className="flex gap-2">
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md tabular-nums ring-1 ring-inset ring-outline-variant">
              <Store className="h-4 w-4 text-primary" aria-hidden />
              {t("{0} мағоза", summary.shops)}
            </span>
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md tabular-nums ring-1 ring-inset ring-outline-variant">
              <Package className="h-4 w-4 text-primary" aria-hidden />
              {t("{0} мол", summary.products)}
            </span>
          </div>
        )}
      </PageHeader>

      <div className="flex flex-col gap-5">
        <div className="inline-flex self-start rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
          {[
            ["shops", Store, t("Мағозаҳо")],
            ["products", Package, t("Молҳо")],
          ].map(([value, Icon, label]) => (
            <button key={value} type="button" onClick={() => update("tab", value === "shops" ? "" : value)} aria-pressed={tab === value} className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg px-4 text-label-md transition-colors ${tab === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-lowest p-1.5 ring-1 ring-outline-variant transition-shadow focus-within:ring-2 focus-within:ring-primary/40 md:flex-row md:items-center">
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <Search className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{tab === "products" ? t("Чӣ меҷӯед?") : t("Мағоза ё мол")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Масалан: курага, гӯшти гӯсфанд, нон")} />
            </span>
          </label>
          <span className="hidden h-10 w-px bg-outline-variant md:block" />
          <label className="flex flex-1 items-center gap-3 rounded-xl px-4 py-2 transition-colors hover:bg-surface-container-low">
            <MapPin className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-label-sm text-on-surface-variant">{t("Шаҳр")}</span>
              <input className="w-full border-0 bg-transparent p-0 text-body-lg text-on-surface placeholder:text-outline focus:ring-0" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("Масалан: Москва")} list="shop-cities" />
            </span>
            <datalist id="shop-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <span className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-label-lg tabular-nums text-on-ink">
            <Search className="h-4 w-4" aria-hidden />
            {loading ? "…" : tab === "products" ? t("{0} мол", page.count) : t("{0} мағоза", page.count)}
          </span>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => update("category", "")} aria-pressed={!category} className={chip(!category)}>
            {t("Ҳама")}
          </button>
          {SHOP_CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => update("category", category === c.value ? "" : c.value)} aria-pressed={category === c.value} className={chip(category === c.value)}>
              <c.icon className="h-4 w-4" aria-hidden />
              {c.label}
              {summary?.categories?.[c.value] > 0 && <span className="tabular-nums opacity-60">{summary.categories[c.value]}</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
            {[{ value: "", flag: "", label: t("Ҳама") }, ...SHOP_ORIGINS.filter((o) => o.value !== "mixed")].map((o) => (
              <button key={o.value} type="button" onClick={() => update("origin", o.value)} aria-pressed={(origin || "") === o.value} className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3.5 text-label-md transition-colors ${(origin || "") === o.value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
                {o.flag && <span aria-hidden>{o.flag}</span>}
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => update("delivery", delivery ? "" : "true")} aria-pressed={delivery} className={`flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-label-md transition-colors ${delivery ? "bg-tertiary-fixed text-on-tertiary-fixed ring-1 ring-inset ring-tertiary-container" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
            {delivery ? <Check className="h-4 w-4" aria-hidden /> : <Truck className="h-4 w-4" aria-hidden />}
            {t("Бо расонидан")}
          </button>
          {tab === "products" && (
            <div className="ml-auto inline-flex rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant">
              {[
                ["", t("Навтаринҳо")],
                ["price", t("Арзонтар")],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => update("ordering", value)} aria-pressed={(params.get("ordering") || "") === value} className={`min-h-[34px] rounded-lg px-3.5 text-label-md transition-colors ${(params.get("ordering") || "") === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <ErrorBox error={error} />
          {loading ? (
            <div className={`grid gap-4 ${tab === "products" ? "grid-cols-2 md:grid-cols-3" : "md:grid-cols-2"}`}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={tab === "products" ? "h-64" : "h-44"} />)}
            </div>
          ) : page.results.length === 0 ? (
            <EmptyState icon={tab === "products" ? Package : Store} title={tab === "products" ? t("Мол ёфт нашуд") : t("Мағоза ёфт нашуд")} text={t("Филтрҳоро кам кунед ё шаҳри дигарро нависед. Мағоза доред? Онро аввалин шуда илова кунед.")}>
              <Link to="/shops/my" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-md text-on-ink hover:bg-ink/90">
                <Store className="h-4 w-4" aria-hidden />
                {t("Мағоза илова кардан")}
              </Link>
            </EmptyState>
          ) : (
            <>
              <Stagger key={path} className={`grid gap-4 ${tab === "products" ? "grid-cols-2 md:grid-cols-3" : "md:grid-cols-2"}`}>
                {page.results.map((item) => (
                  <StaggerItem key={item.id} className="flex min-w-0">
                    {tab === "products" ? <ProductCard product={item} showShop /> : <ShopCard shop={item} />}
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
          <OpenShop />
          <HowItWorks />
        </aside>
      </div>
    </div>
  );
}

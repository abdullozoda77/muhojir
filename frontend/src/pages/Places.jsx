import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Banknote, Building2, Clock, ExternalLink, Flag, Globe, HeartPulse, Languages, List, LocateFixed, Map as MapIcon, MapPin, Moon,
  Phone, Plus, Search, ShoppingBasket, Stamp, Store, Utensils,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import Map3D from "../components/Map3D.jsx";
import { Stars, StarPicker } from "../components/Stars.jsx";
import { Stagger, StaggerItem } from "../components/motion.jsx";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";

// Useful places on a map: migration centers, clinics, notaries, translators, the embassy, mosques, Tajik cafes,
// halal shops, money transfers. The data is from OpenStreetMap; people rate places and suggest new ones.

export const PLACE_KINDS = [
  { value: "migration", label: () => t("Марказҳои муҳоҷират"), icon: Building2, color: "#1447a8" },
  { value: "medical", label: () => t("Ташхиси тиббӣ"), icon: HeartPulse, color: "#c2185b" },
  { value: "notary", label: () => t("Нотариус"), icon: Stamp, color: "#6a1b9a" },
  { value: "translation", label: () => t("Тарҷума"), icon: Languages, color: "#00838f" },
  { value: "embassy", label: () => t("Сафорат ва консулгарӣ"), icon: Flag, color: "#d32f2f" },
  { value: "mosque", label: () => t("Масҷид"), icon: Moon, color: "#2e7d32" },
  { value: "food", label: () => t("Ошхонаи тоҷикӣ ва ӯзбекӣ"), icon: Utensils, color: "#ef6c00" },
  { value: "halal", label: () => t("Мағозаи ҳалол"), icon: ShoppingBasket, color: "#558b2f" },
  { value: "money", label: () => t("Интиқоли пул"), icon: Banknote, color: "#5d4037" },
];
const kind = (value) => PLACE_KINDS.find((k) => k.value === value) || { label: () => value, icon: Store, color: "#455a64" };
const COLORS = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.color]));

// Where the map opens for each region (latitude, longitude, zoom).
const REGION_VIEW = {
  "Москва": [55.751, 37.618, 10],
  "Московская область": [55.75, 37.6, 8],
  "Санкт-Петербург": [59.939, 30.316, 10],
  "Свердловская область": [56.838, 60.605, 9],
  "Новосибирская область": [55.03, 82.92, 9],
  "Республика Татарстан": [55.79, 49.12, 9],
  "Краснодарский край": [45.035, 38.975, 8],
  "Самарская область": [53.195, 50.1, 9],
};

function PlaceCard({ place, onOpen }) {
  const k = kind(place.category);
  return (
    <button type="button" onClick={() => onOpen(place.id)} className="flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-surface-container-low">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: k.color }}>
        <k.icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-label-lg font-bold">{place.name}</span>
        <span className="text-body-sm text-on-surface-variant">{k.label()}{place.address && ` · ${place.address}`}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
          {place.rating ? (
            <span className="inline-flex items-center gap-1">
              <Stars value={place.rating} size="h-3.5 w-3.5" /> {place.rating} ({place.reviews_count})
            </span>
          ) : (
            <span>{t("Ҳоло баҳо нест")}</span>
          )}
          {place.distance_km != null && <span className="text-primary">{t("{0} км", place.distance_km)}</span>}
          {!place.is_approved && <span className="rounded bg-warning-fixed px-1.5 py-0.5 text-on-warning-fixed">{t("Интизори санҷиш")}</span>}
        </span>
      </span>
    </button>
  );
}

function PlaceDetails({ placeId, onClose }) {
  const { user } = useAuth();
  const { data: place, reload } = useApi(placeId ? `/places/${placeId}/` : null);
  const { data: reviews, reload: reloadReviews } = useApi(placeId ? `/places/${placeId}/reviews/?page_size=50` : null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRating(place?.my_review?.rating || 0);
    setText(place?.my_review?.text || "");
  }, [place]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/places/${placeId}/reviews/mine/`, { method: "PUT", body: { rating, text: text.trim() } });
      reload();
      reloadReviews();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const k = place ? kind(place.category) : null;
  const directions = place?.lat ? `https://yandex.ru/maps/?rtext=~${place.lat},${place.lon}&rtt=mt` : null;
  return (
    <Drawer open={Boolean(placeId)} onClose={onClose} title={place?.name || "…"} subtitle={k?.label()} icon={k?.icon || MapPin}>
      {!place ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-low p-4">
            {place.address && <span className="flex items-start gap-2 text-body-md"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{place.address}</span>}
            {place.opening_hours && <span className="flex items-start gap-2 text-body-md"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{place.opening_hours}</span>}
            {place.phone && <a href={`tel:${place.phone.split(";")[0]}`} className="flex items-center gap-2 text-body-md text-primary"><Phone className="h-4 w-4" aria-hidden />{place.phone}</a>}
            {place.website && <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-body-md text-primary"><Globe className="h-4 w-4 shrink-0" aria-hidden />{place.website.replace(/^https?:\/\//, "")}</a>}
            {place.description && <p className="text-body-sm text-on-surface-variant">{place.description}</p>}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl bg-primary px-4 text-label-md text-on-primary">
                {t("Роҳ то ин ҷо")}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Stars value={place.rating || 0} size="h-5 w-5" />
            <span className="text-label-lg">{place.rating ? `${place.rating} · ${t("{0} шарҳ", place.reviews_count)}` : t("Ҳоло баҳо нест")}</span>
          </div>

          {user ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-surface-container p-4">
              <span className="text-label-lg">{place.my_review ? t("Шарҳи шумо") : t("Баҳо диҳед")}</span>
              <StarPicker value={rating} onChange={setRating} />
              <textarea className="input h-24 py-3" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("Чӣ хуб буд ё чӣ бад буд? (ихтиёрӣ)")} />
              <ErrorBox error={error} />
              <Button onClick={save} loading={busy} disabled={!rating} className="self-start">{t("Сабт кардан")}</Button>
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">{t("Барои баҳо додан ворид шавед.")}</p>
          )}

          <div className="flex flex-col gap-3">
            {(reviews?.results || []).map((r) => (
              <div key={r.id} className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-label-md">{r.author_name}{r.is_mine && ` (${t("шумо")})`}</span>
                  <span className="text-label-sm text-on-surface-variant">{ago(r.created_at)}</span>
                </span>
                <Stars value={r.rating} />
                {r.text && <p className="text-body-sm">{r.text}</p>}
              </div>
            ))}
          </div>
          <p className="text-label-sm text-on-surface-variant">{place.source === "osm" ? t("Маълумот аз OpenStreetMap") : t("Пешниҳоди корбар")}</p>
        </div>
      )}
    </Drawer>
  );
}

function SuggestPlace({ open, onClose, regions, onSaved }) {
  const empty = { category: "food", name: "", region: "Москва", city: "", address: "", phone: "", website: "", opening_hours: "", description: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/places/", { method: "POST", body: form });
      setDone(true);
      setForm(empty);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setDone(false);
    onClose();
  };

  return (
    <Drawer open={open} onClose={close} title={t("Ҷойи навро пешниҳод кунед")} subtitle={t("Пас аз санҷиши муҳаррир ба ҳама нишон дода мешавад")} icon={Plus}>
      {done ? (
        <EmptyState icon={Plus} title={t("Ташаккур!")} text={t("Пешниҳоди шумо сабт шуд. Пас аз санҷиш дар харита пайдо мешавад.")}>
          <Button onClick={close}>{t("Пӯшидан")}</Button>
        </EmptyState>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label={t("Намуд")} required>
            <select className="input" value={form.category} onChange={set("category")}>
              {PLACE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label()}</option>)}
            </select>
          </Field>
          <Field label={t("Ном")} required error={error?.data?.name}>
            <input className="input" value={form.name} onChange={set("name")} required minLength={2} maxLength={200} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("Минтақа")} required>
              <input className="input" value={form.region} onChange={set("region")} list="place-regions" required />
              <datalist id="place-regions">{regions.map((r) => <option key={r} value={r} />)}</datalist>
            </Field>
            <Field label={t("Шаҳр")}>
              <input className="input" value={form.city} onChange={set("city")} />
            </Field>
          </div>
          <Field label={t("Суроға")} required error={error?.data?.address}>
            <input className="input" value={form.address} onChange={set("address")} required minLength={3} placeholder={t("Кӯча, хона")} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("Телефон")}><input className="input" value={form.phone} onChange={set("phone")} /></Field>
            <Field label={t("Вақти корӣ")}><input className="input" value={form.opening_hours} onChange={set("opening_hours")} placeholder="Пн–Сб 09:00–20:00" /></Field>
          </div>
          <Field label={t("Сайт")}><input className="input" value={form.website} onChange={set("website")} placeholder="https://" /></Field>
          <Field label={t("Тавсиф")}><textarea className="input h-24 py-3" value={form.description} onChange={set("description")} maxLength={1000} /></Field>
          <ErrorBox error={error} />
          <Button type="submit" loading={busy} icon={Plus}>{t("Пешниҳод кардан")}</Button>
        </form>
      )}
    </Drawer>
  );
}

export default function Places() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [near, setNear] = useState(null);
  const [locating, setLocating] = useState(false);
  const [view, setView] = useState("list"); // phones: list or map
  const [openId, setOpenId] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [page, setPage] = useState({ results: [], count: 0, next: null });
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  const category = params.get("category") || "";
  const region = params.get("region") || (near ? "" : "Москва");
  const { data: summary, reload: reloadSummary } = useApi(`/places/summary/?region=${encodeURIComponent(region)}`);

  const update = useCallback((key, value) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    const id = setTimeout(() => update("search", search.trim()), 500);
    return () => clearTimeout(id);
  }, [search, update]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (region) q.set("region", region);
    if (params.get("search")) q.set("search", params.get("search"));
    return q.toString();
  }, [category, region, params]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const list = new URLSearchParams(query);
    list.set("page_size", "20");
    if (near) list.set("near", `${near.lat},${near.lon}`);
    Promise.all([api(`/places/?${list}`), api(`/places/map/?${query}`)])
      .then(([data, map]) => {
        if (!alive) return;
        setPage(data);
        setPoints(map);
      })
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query, near]);

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

  const locate = () => {
    if (near) {
      setNear(null);
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        update("region", "");
        setLocating(false);
      },
      () => {
        setError(new Error(t("Ҷойгиршавии шуморо муайян карда нашуд. Иҷозатро дар браузер санҷед.")));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const regions = summary?.regions?.map((r) => r.name) || Object.keys(REGION_VIEW);
  const counts = summary?.categories || {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t("Харитаи ҷойҳои муфид")} title={t("Ҷойҳо дар Русия")} text={t("Марказҳои муҳоҷират, нотариус, сафорат, масҷидҳо, ошхонаҳои тоҷикӣ ва дигар ҷойҳо — бо суроға ва баҳои одамон.")}>
        {user && <Button variant="accent" icon={Plus} onClick={() => setSuggesting(true)}>{t("Ҷойи нав")}</Button>}
      </PageHeader>

      <div className="card flex flex-col gap-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-12">
          <label className="md:col-span-6">
            <span className="label flex items-center gap-1 text-on-surface-variant"><Search className="h-4 w-4 text-primary" aria-hidden />{t("Ном ё кӯча")}</span>
            <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Масалан: чайхана, Ленина")} />
          </label>
          <label className="md:col-span-4">
            <span className="label flex items-center gap-1 text-on-surface-variant"><MapPin className="h-4 w-4 text-primary" aria-hidden />{t("Минтақа")}</span>
            <select className="input" value={region} onChange={(e) => (setNear(null), update("region", e.target.value))}>
              {near && <option value="">{t("Дар наздикии ман")}</option>}
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="flex items-end md:col-span-2">
            <Button variant={near ? "primary" : "soft"} icon={LocateFixed} loading={locating} onClick={locate} className="w-full">
              {near ? t("Наздик ✓") : t("Наздики ман")}
            </Button>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => update("category", "")} aria-pressed={!category} className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-lg px-4 text-label-md ${!category ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"}`}>
            {t("Ҳама")}
          </button>
          {PLACE_KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => update("category", category === k.value ? "" : k.value)} aria-pressed={category === k.value} className={`flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-label-md ${category === k.value ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"}`}>
              <k.icon className="h-4 w-4" aria-hidden style={category === k.value ? undefined : { color: k.color }} />
              {k.label()}
              {counts[k.value] > 0 && <span className="text-label-sm opacity-70">{counts[k.value]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="inline-flex self-start rounded-xl bg-surface-container-highest p-1 xl:hidden" role="group">
        {[["list", List, t("Рӯйхат")], ["map", MapIcon, t("Харита")]].map(([value, Icon, label]) => (
          <button key={value} type="button" onClick={() => setView(value)} aria-pressed={view === value} className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-label-md ${view === value ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <ErrorBox error={error} />
      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className={`flex flex-col gap-3 xl:col-span-5 ${view === "map" ? "hidden xl:flex" : ""}`}>
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-headline-sm">{near ? t("Дар наздикии шумо") : t("Ҷойҳо")}</h2>
            {!loading && <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-primary">{page.count}</span>}
          </div>
          {loading ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
          ) : page.results.length === 0 ? (
            <EmptyState icon={MapPin} title={t("Ҷой ёфт нашуд")} text={t("Намуд ё минтақаи дигарро интихоб кунед.")} />
          ) : (
            <>
              <Stagger key={query + (near ? "near" : "")} className="flex flex-col divide-y divide-surface-container rounded-3xl bg-surface-container-lowest p-1 shadow-sm">
                {page.results.map((place) => (
                  <StaggerItem key={place.id}>
                    <PlaceCard place={place} onOpen={setOpenId} />
                  </StaggerItem>
                ))}
              </Stagger>
              {page.next && <Button variant="soft" loading={more} onClick={loadMore} className="self-center">{t("Боз нишон додан")}</Button>}
            </>
          )}
        </div>
        <div className={`xl:sticky xl:top-24 xl:col-span-7 ${view === "list" ? "hidden xl:block" : ""}`}>
          <Map3D points={points} colors={COLORS} region={region} regionView={REGION_VIEW[region] || REGION_VIEW["Москва"]} selectedId={openId} onOpen={setOpenId} />
          <p className="mt-2 px-1 text-label-sm text-on-surface-variant">{t("Маълумот аз OpenStreetMap. Агар хато бинед, ҷойи навро пешниҳод кунед.")}</p>
        </div>
      </div>

      <PlaceDetails placeId={openId} onClose={() => setOpenId(null)} />
      <SuggestPlace open={suggesting} onClose={() => setSuggesting(false)} regions={regions} onSaved={reloadSummary} />
    </div>
  );
}

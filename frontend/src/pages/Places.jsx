import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Banknote, BedDouble, Building2, Camera, Car, Clock, ExternalLink, Flag, Footprints, Globe, HeartPulse, Languages, List, LocateFixed, Map as MapIcon, MapPin,
  MapPinned, Moon, PanelLeftClose, Phone, Plus, Route, Search, ShoppingBasket, Stamp, Store, Utensils,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import Map3D from "../components/Map3D.jsx";
import { Stars, StarPicker } from "../components/Stars.jsx";
import { EASE, Stagger, StaggerItem, m } from "../components/motion.jsx";
import { Button, Drawer, EmptyState, ErrorBox, Field, PageHeader, Skeleton } from "../components/ui.jsx";

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
  { value: "hostel", label: () => t("Хостел"), icon: BedDouble, color: "#3949ab" },
  { value: "market", label: () => t("Бозор"), icon: Store, color: "#f9a825" },
  { value: "photo", label: () => t("Акс барои ҳуҷҷат"), icon: Camera, color: "#546e7a" },
];
const kind = (value) => PLACE_KINDS.find((k) => k.value === value) || { label: () => value, icon: Store, color: "#455a64" };
const COLORS = Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.color]));

const REGION_VIEW = {
  "Москва": [55.751, 37.618, 10],
  "Московская область": [55.75, 37.6, 8],
  "Санкт-Петербург": [59.939, 30.316, 10],
  "Свердловская область": [56.838, 60.605, 9],
  "Новосибирская область": [55.03, 82.92, 9],
  "Республика Татарстан": [55.79, 49.12, 9],
  "Краснодарский край": [45.035, 38.975, 8],
  "Самарская область": [53.195, 50.1, 9],
  "Ленинградская область": [59.9, 30.6, 8],
  "Нижегородская область": [56.327, 44.006, 9],
  "Челябинская область": [55.16, 61.4, 9],
  "Тюменская область": [57.153, 65.534, 9],
  "Ханты-Мансийский автономный округ — Югра": [61.25, 73.4, 8],
  "Ямало-Ненецкий автономный округ": [66.53, 66.6, 7],
  "Ростовская область": [47.222, 39.72, 9],
  "Красноярский край": [56.01, 92.87, 9],
  "Иркутская область": [52.287, 104.28, 9],
  "Калужская область": [54.513, 36.261, 9],
  "Тульская область": [54.193, 37.617, 9],
  "Воронежская область": [51.66, 39.2, 9],
  "Пермский край": [58.01, 56.25, 9],
  "Республика Башкортостан": [54.735, 55.958, 9],
  "Омская область": [54.989, 73.368, 9],
  "Волгоградская область": [48.708, 44.513, 9],
  "Саратовская область": [51.533, 46.034, 9],
  "Ярославская область": [57.626, 39.894, 9],
  "Владимирская область": [56.129, 40.407, 9],
  "Калининградская область": [54.71, 20.51, 9],
  "Белгородская область": [50.595, 36.587, 9],
  "Томская область": [56.485, 84.948, 9],
};

const ROUTER = "https://routing.openstreetmap.de";

export async function findRoute(from, to, mode) {
  const url = `${ROUTER}/routed-${mode}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const data = await fetch(url).then((r) => r.json()).catch(() => null);
  const best = data?.code === "Ok" && data.routes[0];
  if (!best) throw new Error(t("Маршрут ёфт нашуд. Баъдтар боз кӯшиш кунед."));
  return { geometry: best.geometry, distance: best.distance, duration: best.duration, mode, from, to };
}

function myPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t("Ҷойгиршавии шуморо муайян карда нашуд. Иҷозатро дар браузер санҷед.")));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: t("Ҷойгиршавии ман") }),
      () => reject(new Error(t("Ҷойгиршавии шуморо муайян карда нашуд. Иҷозатро дар браузер санҷед."))),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function RouteBuilder({ place, points, onRoute }) {
  const [from, setFrom] = useState("me");
  const [mode, setMode] = useState("foot");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const others = useMemo(() => points.filter((p) => p.id !== place.id).sort((a, b) => a.name.localeCompare(b.name)), [points, place.id]);

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const start = from === "me" ? await myPosition() : others.find((p) => String(p.id) === from);
      onRoute(await findRoute(start, { lat: place.lat, lon: place.lon, name: place.name }, mode));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl p-5 ring-1 ring-outline-variant">
      <span className="flex items-center gap-2 text-[17px] font-semibold">
        <Route className="h-5 w-5 text-primary" aria-hidden />
        {t("Маршрут")}
      </span>
      <Field label={t("Аз куҷо")}>
        <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="me">{t("Ҷойгиршавии ман")}</option>
          {others.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant" role="group" aria-label={t("Маршрут")}>
        {[["foot", Footprints, t("Пиёда")], ["car", Car, t("Бо мошин")]].map(([value, Icon, label]) => (
          <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className={`flex min-h-[40px] items-center justify-center gap-2 rounded-lg text-label-md transition-colors ${mode === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      <Button icon={Route} loading={busy} onClick={build}>{t("Маршрут сохтан")}</Button>
    </div>
  );
}

function useWide() {
  const query = "(min-width: 1280px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = (e) => setWide(e.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return wide;
}

const PANEL = 368;

function PlaceCard({ place, onOpen }) {
  const k = kind(place.category);
  return (
    <button type="button" onClick={() => onOpen(place.id)} className="group flex w-full items-start gap-4 rounded-xl p-3.5 text-left transition-colors hover:bg-surface-container-low">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-105">
        <k.icon className="h-[18px] w-[18px]" aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-container-lowest" style={{ backgroundColor: k.color }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-semibold leading-snug">{place.name}</span>
        <span className="line-clamp-2 text-body-sm text-on-surface-variant">{k.label()}{place.address && ` · ${place.address}`}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-on-surface-variant">
          {place.rating ? (
            <span className="inline-flex items-center gap-1">
              <Stars value={place.rating} size="h-3.5 w-3.5" /> {place.rating} ({place.reviews_count})
            </span>
          ) : (
            <span>{t("Ҳоло баҳо нест")}</span>
          )}
          {place.distance_km != null && <span className="rounded-md bg-primary-fixed px-1.5 py-0.5 font-medium text-on-primary-fixed">{t("{0} км", place.distance_km)}</span>}
          {!place.is_approved && <span className="rounded-md bg-warning-fixed px-1.5 py-0.5 font-medium text-on-warning-fixed">{t("Интизори санҷиш")}</span>}
        </span>
      </span>
    </button>
  );
}

function PlaceDetails({ placeId, onClose, points, onRoute }) {
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
          <div className="flex flex-col gap-2.5 rounded-2xl p-5 ring-1 ring-outline-variant">
            {place.address && <span className="flex items-start gap-2 text-body-md"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{place.address}</span>}
            {place.opening_hours && <span className="flex items-start gap-2 text-body-md"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{place.opening_hours}</span>}
            {place.phone && <a href={`tel:${place.phone.split(";")[0]}`} className="flex items-center gap-2 text-body-md text-primary"><Phone className="h-4 w-4" aria-hidden />{place.phone}</a>}
            {place.website && <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-body-md text-primary"><Globe className="h-4 w-4 shrink-0" aria-hidden />{place.website.replace(/^https?:\/\//, "")}</a>}
            {place.description && <p className="text-body-sm text-on-surface-variant">{place.description}</p>}
            {directions && (
              <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90">
                {t("Роҳ то ин ҷо")}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </div>

          {place.lat != null && <RouteBuilder place={place} points={points} onRoute={onRoute} />}

          <div className="flex items-center gap-2">
            <Stars value={place.rating || 0} size="h-5 w-5" />
            <span className="font-display text-[16px] font-semibold">{place.rating ? `${place.rating} · ${t("{0} шарҳ", place.reviews_count)}` : t("Ҳоло баҳо нест")}</span>
          </div>

          {user ? (
            <div className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-outline-variant">
              <span className="text-[17px] font-semibold">{place.my_review ? t("Шарҳи шумо") : t("Баҳо диҳед")}</span>
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
              <div key={r.id} className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-4">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-[15px] font-semibold">{r.author_name}{r.is_mine && ` (${t("шумо")})`}</span>
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
  const [view, setView] = useState("list");
  const wide = useWide();
  const [panel, setPanel] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [page, setPage] = useState({ results: [], count: 0, next: null });
  const [points, setPoints] = useState([]);
  const [route, setRoute] = useState(null);
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

  const listBody = loading ? (
    <div className="flex flex-col gap-2 p-1">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
  ) : page.results.length === 0 ? (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <MapPin className="h-6 w-6 text-on-surface-variant" aria-hidden />
      <span className="text-[16px] font-semibold">{t("Ҷой ёфт нашуд")}</span>
      <span className="text-body-sm text-on-surface-variant">{t("Намуд ё минтақаи дигарро интихоб кунед.")}</span>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      <Stagger key={query + (near ? "near" : "")} className="flex flex-col divide-y divide-outline-variant">
        {page.results.map((place) => (
          <StaggerItem key={place.id}>
            <PlaceCard place={place} onOpen={setOpenId} />
          </StaggerItem>
        ))}
      </Stagger>
      {page.next && <Button variant="plain" loading={more} onClick={loadMore} className="m-1.5">{t("Боз нишон додан")}</Button>}
    </div>
  );

  const regions = summary?.regions?.map((r) => r.name) || Object.keys(REGION_VIEW);
  const counts = summary?.categories || {};

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Харитаи ҷойҳои муфид")} icon={MapPinned} title={t("Ҷойҳо дар Русия")} text={t("Марказҳои муҳоҷират, нотариус, сафорат, масҷидҳо, ошхонаҳои тоҷикӣ ва дигар ҷойҳо — бо суроға ва баҳои одамон.")}>
        {user && <Button variant="accent" icon={Plus} onClick={() => setSuggesting(true)}>{t("Ҷойи нав")}</Button>}
      </PageHeader>

      <div className="card flex flex-col gap-5 p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-12">
          <label className="md:col-span-6">
            <span className="label flex items-center gap-1.5 text-on-surface-variant"><Search className="h-4 w-4" aria-hidden />{t("Ном ё кӯча")}</span>
            <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Масалан: чайхана, Ленина")} />
          </label>
          <label className="md:col-span-4">
            <span className="label flex items-center gap-1.5 text-on-surface-variant"><MapPin className="h-4 w-4" aria-hidden />{t("Минтақа")}</span>
            <select className="input" value={region} onChange={(e) => (setNear(null), update("region", e.target.value))}>
              {near && <option value="">{t("Дар наздикии ман")}</option>}
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="flex items-end md:col-span-2">
            <Button variant={near ? "primary" : "plain"} icon={LocateFixed} loading={locating} onClick={locate} className="w-full">
              {near ? t("Наздик ✓") : t("Наздики ман")}
            </Button>
          </div>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => update("category", "")} aria-pressed={!category} className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-4 text-label-md transition-colors ${!category ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
            {t("Ҳама")}
          </button>
          {PLACE_KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => update("category", category === k.value ? "" : k.value)} aria-pressed={category === k.value} className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-label-md transition-colors ${category === k.value ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: k.color }} aria-hidden />
              {k.label()}
              {counts[k.value] > 0 && <span className="text-[12px] tabular-nums opacity-60">{counts[k.value]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="inline-flex self-start rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant xl:hidden" role="group">
        {[["list", List, t("Рӯйхат")], ["map", MapIcon, t("Харита")]].map(([value, Icon, label]) => (
          <button key={value} type="button" onClick={() => setView(value)} aria-pressed={view === value} className={`flex min-h-[40px] items-center gap-2 rounded-lg px-4 text-label-md transition-colors ${view === value ? "bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-outline-variant" : "text-on-surface-variant hover:text-on-surface"}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <ErrorBox error={error} />
      <div className="flex flex-col gap-2">
        <div className="relative">
          <div className={!wide && view === "list" ? "hidden" : ""}>
            <Map3D
              points={points} colors={COLORS} region={region} regionView={REGION_VIEW[region] || REGION_VIEW["Москва"]}
              selectedId={openId} onOpen={setOpenId} route={route} onClearRoute={() => setRoute(null)}
              className="h-[560px] xl:h-[calc(100vh-112px)] xl:min-h-[620px]" inset={wide && panel ? PANEL + 12 : 0}
            />
          </div>
          {wide && panel && (
            <m.aside
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }}
              className="absolute bottom-3 left-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest/95 shadow-lg ring-1 ring-outline-variant backdrop-blur-md"
              style={{ width: PANEL }}
            >
              <header className="flex items-center gap-2 border-b border-outline-variant py-2.5 pl-4 pr-2">
                <h2 className="text-[17px] font-semibold">{near ? t("Дар наздикии шумо") : t("Ҷойҳо")}</h2>
                {!loading && <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[12px] font-medium tabular-nums text-on-surface-variant">{page.count}</span>}
                <button type="button" onClick={() => setPanel(false)} aria-label={t("Рӯйхатро пинҳон кардан")} title={t("Рӯйхатро пинҳон кардан")} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface">
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-1.5">{listBody}</div>
            </m.aside>
          )}
          {wide && !panel && (
            <button type="button" onClick={() => setPanel(true)} className="absolute left-3 top-[60px] z-10 flex h-9 items-center gap-2 rounded-lg bg-surface-container-lowest/90 px-3 text-label-md text-on-surface shadow-sm ring-1 ring-black/5 backdrop-blur-md transition-colors hover:bg-surface-container-lowest">
              <List className="h-4 w-4" aria-hidden />
              {t("Рӯйхат")}
              {!loading && <span className="text-[12px] tabular-nums text-on-surface-variant">{page.count}</span>}
            </button>
          )}
          {!wide && view === "list" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-[20px] font-semibold">{near ? t("Дар наздикии шумо") : t("Ҷойҳо")}</h2>
                {!loading && <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[12px] font-medium tabular-nums text-on-surface-variant">{page.count}</span>}
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-1.5 ring-1 ring-outline-variant">{listBody}</div>
            </div>
          )}
        </div>
        <p className="px-1 text-[12px] text-on-surface-variant">{t("Маълумот аз OpenStreetMap. Агар хато бинед, ҷойи навро пешниҳод кунед.")}</p>
      </div>

      <PlaceDetails
        placeId={openId}
        onClose={() => setOpenId(null)}
        points={points}
        onRoute={(r) => {
          setRoute(r);
          setOpenId(null);
          setView("map");
        }}
      />
      <SuggestPlace open={suggesting} onClose={() => setSuggesting(false)} regions={regions} onSaved={reloadSummary} />
    </div>
  );
}

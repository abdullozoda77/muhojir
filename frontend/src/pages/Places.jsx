import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Banknote, BedDouble, Building2, Camera, Car, Clock, ExternalLink, Flag, Footprints, Globe, HeartPulse, Languages, List, LocateFixed, Map as MapIcon, MapPin,
  Check, ImagePlus, MapPinned, Moon, PanelLeftClose, Phone, Plus, Route, Search, ShieldCheck, ShoppingBag, ShoppingBasket, Stamp, Store, Trash2, Truck, Utensils, X,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { t } from "../i18n.js";
import { ago } from "../format.js";
import Map3D from "../components/Map3D.jsx";
import { canEdit } from "../components/Layout.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import { ContactButtons, ShopLogo, fitPhoto } from "../components/Shop.jsx";
import { shopCategory } from "../constants.js";
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
const SHOP_KIND = { value: "shop", label: () => t("Мағозаҳои тоҷикӣ"), icon: ShoppingBag, color: "#e11d48" };
const kind = (value) => PLACE_KINDS.find((k) => k.value === value) || { label: () => value, icon: Store, color: "#455a64" };
const COLORS = { ...Object.fromEntries(PLACE_KINDS.map((k) => [k.value, k.color])), shop: SHOP_KIND.color };
const SHOP_PREFIX = "shop-";
const shopIdOf = (id) => (typeof id === "string" && id.startsWith(SHOP_PREFIX) ? Number(id.slice(SHOP_PREFIX.length)) : null);
const ZOOM_KM = { 7: 500, 8: 220, 9: 110, 10: 45 };

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function shopsAround(shops, center, km, words, pinned) {
  const needle = words.trim().toLowerCase();
  return shops
    .map((shop) => ({ ...shop, shopId: shop.id, id: SHOP_PREFIX + shop.id, category: "shop", shopCategory: shop.category, distance: distanceKm(center, shop) }))
    .filter((shop) => shop.shopId === pinned || (shop.distance <= km && (!needle || `${shop.name} ${shop.address}`.toLowerCase().includes(needle))))
    .sort((a, b) => a.distance - b.distance);
}

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
          {!place.is_approved && (place.reject_reason ? (
            <span className="rounded-md bg-error-container px-1.5 py-0.5 font-medium text-error">{t("Рад шуд")}</span>
          ) : (
            <span className="rounded-md bg-warning-fixed px-1.5 py-0.5 font-medium text-on-warning-fixed">{t("Интизори санҷиш")}</span>
          ))}
        </span>
      </span>
    </button>
  );
}

function ShopPinCard({ shop, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(shop.id)} className="group flex w-full items-start gap-4 rounded-xl p-3.5 text-left transition-colors hover:bg-surface-container-low">
      <span className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
        <ShopLogo shop={{ ...shop, category: shop.shopCategory }} className="h-10 w-10" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-container-lowest" style={{ backgroundColor: SHOP_KIND.color }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-semibold leading-snug">{shop.name}</span>
        <span className="line-clamp-2 text-body-sm text-on-surface-variant">{shopCategory(shop.shopCategory).label}{shop.address && ` · ${shop.address}`}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-on-surface-variant">
          <span className="rounded-md bg-primary-fixed px-1.5 py-0.5 font-medium text-on-primary-fixed">{t("{0} км", shop.distance.toLocaleString("ru-RU", { maximumFractionDigits: 1 }))}</span>
          {shop.opening_hours && <span>{shop.opening_hours}</span>}
        </span>
      </span>
    </button>
  );
}

function ShopDetails({ shopId, onClose, points, onRoute }) {
  const { data: shop } = useApi(shopId ? `/market/shops/${shopId}/` : null);
  return (
    <Drawer open={Boolean(shopId)} onClose={onClose} title={shop?.name || "…"} subtitle={shop ? `${SHOP_KIND.label()} · ${shopCategory(shop.category).label}` : SHOP_KIND.label()} icon={ShoppingBag}>
      {!shop ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-outline-variant">
            <div className="flex items-center gap-3">
              <ShopLogo shop={shop} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[17px] font-semibold">{shop.name}</span>
                {shop.rating ? (
                  <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant"><Stars value={shop.rating} size="h-3.5 w-3.5" /> {shop.rating} ({shop.reviews_count})</span>
                ) : (
                  <span className="text-body-sm text-on-surface-variant">{t("Ҳоло баҳо нест")}</span>
                )}
              </span>
            </div>
            <span className="flex items-start gap-2 text-body-md"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{[shop.city, shop.address].filter(Boolean).join(", ")}</span>
            {shop.opening_hours && <span className="flex items-start gap-2 text-body-md"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{shop.opening_hours}</span>}
            {shop.delivery && <span className="flex items-start gap-2 text-body-md"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{t("Ба хона мерасонем")}</span>}
            {shop.description && <p className="text-body-sm text-on-surface-variant">{shop.description}</p>}
            <ContactButtons shop={shop} size="sm" />
            <Link to={`/shops/${shop.id}`} className="mt-1 inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90">
              {t("Молҳо ва саҳифаи мағоза")}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {shop.lat != null && <RouteBuilder place={{ ...shop, id: SHOP_PREFIX + shop.id }} points={points} onRoute={onRoute} />}
          <p className="text-label-sm text-on-surface-variant">{t("Ҷойи мағозаро соҳибаш гузоштааст ва муҳаррир санҷидааст.")}</p>
        </div>
      )}
    </Drawer>
  );
}

function PrivatePhoto({ path, className = "h-48 w-full" }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    api(path, { raw: true })
      .then((res) => res.blob())
      .then((blob) => {
        made = URL.createObjectURL(blob);
        if (alive) setUrl(made);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [path]);
  if (!url) return <Skeleton className={className} />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt={t("Акси ҷой")} className={`${className} rounded-xl object-cover ring-1 ring-outline-variant`} />
    </a>
  );
}

function PlaceCheck({ place, onDone, onDeleted }) {
  const { user } = useAuth();
  const editor = canEdit(user);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };
  const decide = (status) => run(status, async () => {
    await api(`/places/${place.id}/moderate/`, { method: "POST", body: { status, reason: reason.trim() } });
    setReason("");
    onDone();
  });
  const remove = () => {
    if (!window.confirm(t("«{0}» нест карда шавад?", place.name))) return;
    run("delete", async () => {
      await api(`/places/${place.id}/`, { method: "DELETE" });
      onDeleted();
    });
  };

  const rejected = Boolean(place.reject_reason);
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-warning/40">
      <span className="flex items-center gap-2 text-[17px] font-semibold">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
        {rejected ? t("Ҷой рад шуд") : t("Интизори санҷиш")}
      </span>
      {rejected ? (
        <ErrorBox error={{ message: t("Сабаби рад: {0}", place.reject_reason) }} />
      ) : (
        <span className="text-body-sm text-on-surface-variant">
          {editor ? t("Аксро бо харита ва панорамаи кӯча муқоиса кунед. Пас аз тасдиқ ҷой ба ҳама намоён мешавад.") : t("Муҳаррир аксро бо харита месанҷад. Пас аз тасдиқ ҷой ба ҳама намоён мешавад ва ба шумо хабар медиҳем.")}
        </span>
      )}
      {place.has_proof && <PrivatePhoto path={`/places/${place.id}/proof/`} />}
      {editor && place.lat != null && <LocationPicker value={{ lat: place.lat, lon: place.lon }} readOnly subject="place" className="h-48" />}
      {editor && (
        <>
          <textarea className="input h-20 py-3" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder={t("Сабаби рад (барои рад кардан ҳатмӣ)")} />
          <div className="flex flex-wrap gap-2">
            <Button icon={Check} loading={busy === "approved"} onClick={() => decide("approved")}>{t("Тасдиқ кардан")}</Button>
            <Button variant="plain" icon={X} loading={busy === "rejected"} disabled={!reason.trim()} onClick={() => decide("rejected")}>{t("Рад кардан")}</Button>
          </div>
        </>
      )}
      <ErrorBox error={error} />
      {(editor || place.is_mine) && (
        <Button variant="ghost" icon={Trash2} loading={busy === "delete"} onClick={remove} className="self-start text-error">{t("Нест кардан")}</Button>
      )}
    </div>
  );
}

function PlaceDetails({ placeId, onClose, points, onRoute, onChanged }) {
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

          {!place.is_approved && (
            <PlaceCheck
              place={place}
              onDone={() => (reload(), onChanged())}
              onDeleted={() => (onClose(), onChanged())}
            />
          )}

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
  const [location, setLocation] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const hasLocation = location && location.lat != null;
  const ready = hasLocation && photo && confirmed;

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const pickPhoto = async (file) => {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await fitPhoto(file, 1600));
    } catch {
      setError(new Error(t("Ин аксро кушода натавонистем. Акси дигар интихоб кунед.")));
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      body.append("lat", String(location.lat));
      body.append("lon", String(location.lon));
      body.append("confirmed", "true");
      body.append("photo", photo, "place.webp");
      const saved = await api("/places/", { method: "POST", body });
      setDone(saved.is_approved ? "added" : "sent");
      setForm(empty);
      setLocation(null);
      setPhoto(null);
      setConfirmed(false);
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
        <EmptyState icon={ShieldCheck} title={t("Ташаккур!")} text={done === "added" ? t("Ҷой илова шуд ва дар харита намоён аст.") : t("Пешниҳоди шумо ба санҷиш рафт. Муҳаррир аксро бо харита месанҷад ва пас аз тасдиқ ҷой дар харита пайдо мешавад — ба шумо хабар медиҳем.")}>
          <Button onClick={close}>{t("Пӯшидан")}</Button>
        </EmptyState>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-primary-fixed/60 p-4 ring-1 ring-inset ring-primary/15">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-body-sm text-on-surface-variant">{t("То касе ҷойи бофта илова накунад: ҷойро дар харита қайд кунед, акси онро гузоред ва тасдиқ кунед, ки ҷой воқеан ҳаст. Аксро танҳо муҳаррир мебинад.")}</span>
          </div>
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
          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3 ring-1 ring-inset ring-outline-variant">
            <span className="text-body-md font-medium">
              {t("Ҷой дар харита")} <span className="text-error">*</span>
              {hasLocation && <span className="ml-2 text-label-sm font-normal text-tertiary">✓ {t("Қайд шуд")}</span>}
            </span>
            <span className="text-body-sm text-on-surface-variant">{t("Суроғаро ҷустуҷӯ кунед ё ба харита пахш кунед. Муҳаррир ҷойро дар харита ва панорамаи кӯча месанҷад.")}</span>
            <LocationPicker value={location} onChange={setLocation} subject="place" query={[form.city || form.region, form.address].filter(Boolean).join(", ")} />
            {error?.data?.location && <span className="text-body-sm text-error">{error.data.location[0]}</span>}
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3 ring-1 ring-inset ring-outline-variant">
            <span className="text-body-md font-medium">
              {t("Акси ҷой")} <span className="text-error">*</span>
            </span>
            <span className="text-body-sm text-on-surface-variant">{t("Даромадгоҳ ё лавҳаи ҷой, ки номаш намоён бошад.")}</span>
            <label className="flex cursor-pointer items-center gap-3">
              {preview ? (
                <img src={preview} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-outline-variant" />
              ) : (
                <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant ring-1 ring-outline-variant"><ImagePlus className="h-7 w-7" aria-hidden /></span>
              )}
              <span className="text-label-md text-primary">{photo ? t("Акси дигар") : t("Акс интихоб кунед")}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
            {error?.data?.photo && <span className="text-body-sm text-error">{error.data.photo[0]}</span>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("Телефон")}><input className="input" value={form.phone} onChange={set("phone")} /></Field>
            <Field label={t("Вақти корӣ")}><input className="input" value={form.opening_hours} onChange={set("opening_hours")} placeholder="Пн–Сб 09:00–20:00" /></Field>
          </div>
          <Field label={t("Сайт")}><input className="input" value={form.website} onChange={set("website")} placeholder="https://" /></Field>
          <Field label={t("Тавсиф")}><textarea className="input h-24 py-3" value={form.description} onChange={set("description")} maxLength={1000} /></Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset ring-outline-variant">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary,#1447a8)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span className="text-body-sm">{t("Тасдиқ мекунам, ки ин ҷой воқеан ҳаст ва маълумот дуруст аст.")}</span>
          </label>
          <ErrorBox error={error} />
          {!ready && <span className="text-body-sm text-on-surface-variant">{t("Барои фиристодан: ҷой дар харита, акс ва тасдиқ лозим аст.")}</span>}
          <Button type="submit" loading={busy} disabled={!ready} icon={ShieldCheck}>{t("Ба санҷиш фиристодан")}</Button>
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
  const [openId, setOpenId] = useState(() => (params.get("shop") ? SHOP_PREFIX + params.get("shop") : null));
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
  const { data: allShops } = useApi("/market/shops/map/");
  const onlyShops = category === SHOP_KIND.value;
  const waiting = canEdit(user) && params.get("waiting") === "true";
  const [version, setVersion] = useState(0);

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
    if (region && !waiting) q.set("region", region);
    if (params.get("search")) q.set("search", params.get("search"));
    if (waiting) q.set("waiting", "true");
    return q.toString();
  }, [category, region, params, waiting]);

  useEffect(() => {
    if (onlyShops) {
      setLoading(false);
      setError(null);
      return undefined;
    }
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
  }, [query, near, onlyShops, version]);

  const shops = useMemo(() => {
    const [lat, lon, zoom] = REGION_VIEW[region] || REGION_VIEW["Москва"];
    const center = near || { lat, lon };
    return shopsAround(allShops || [], center, near ? 30 : ZOOM_KM[zoom] || 110, params.get("search") || "", Number(params.get("shop")) || null);
  }, [allShops, region, near, params]);
  const mapPoints = useMemo(() => (onlyShops ? shops : category || waiting ? points : [...points, ...shops]), [onlyShops, category, waiting, points, shops]);
  const openShopId = shopIdOf(openId);

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

  const shopsHint = !onlyShops && !category && shops.length > 0 && (
    <button type="button" onClick={() => update("category", SHOP_KIND.value)} className="m-1.5 flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-left text-body-sm transition-colors hover:bg-surface-container-high">
      <ShoppingBag className="h-4 w-4 shrink-0" style={{ color: SHOP_KIND.color }} aria-hidden />
      <span className="flex-1">{t("{0} мағозаи тоҷикӣ дар харита", shops.length)}</span>
    </button>
  );

  const shopsBody = shops.length === 0 ? (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <ShoppingBag className="h-6 w-6 text-on-surface-variant" aria-hidden />
      <span className="text-[16px] font-semibold">{t("Дар ин минтақа ҳоло мағоза нест")}</span>
      <span className="text-body-sm text-on-surface-variant">{t("Мағоза доред? Онро илова кунед — пас аз санҷиш дар харита пайдо мешавад.")}</span>
      <Link to={user ? "/shops/my" : "/login"} state={user ? undefined : { from: "/shops/my" }} className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink hover:bg-ink/90">
        <Plus className="h-4 w-4" aria-hidden />
        {t("Мағозаи худро илова кунед")}
      </Link>
    </div>
  ) : (
    <Stagger key={region + (near ? "near" : "")} className="flex flex-col divide-y divide-outline-variant">
      {shops.map((shop) => (
        <StaggerItem key={shop.id}>
          <ShopPinCard shop={shop} onOpen={setOpenId} />
        </StaggerItem>
      ))}
    </Stagger>
  );

  const placesBody = loading ? (
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

  const listBody = onlyShops ? shopsBody : <>{shopsHint}{placesBody}</>;
  const total = onlyShops ? shops.length : page.count;

  const regions = summary?.regions?.map((r) => r.name) || Object.keys(REGION_VIEW);
  const counts = summary?.categories || {};

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t("Харитаи ҷойҳои муфид")} icon={MapPinned} title={t("Ҷойҳо дар Русия")} text={t("Марказҳои муҳоҷират, нотариус, сафорат, масҷидҳо, ошхонаҳои тоҷикӣ ва дигар ҷойҳо — бо суроға ва баҳои одамон.")}>
        <div className="flex flex-wrap gap-2">
          <Link to={user ? "/shops/my" : "/login"} state={user ? undefined : { from: "/shops/my" }} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
            <ShoppingBag className="h-4 w-4" style={{ color: SHOP_KIND.color }} aria-hidden />
            {t("Мағозаи ман дар харита")}
          </Link>
          {canEdit(user) && (
            <Button variant={waiting ? "primary" : "plain"} icon={ShieldCheck} onClick={() => update("waiting", waiting ? "" : "true")}>
              {t("Барои санҷиш")}
            </Button>
          )}
          {user && <Button variant="accent" icon={Plus} onClick={() => setSuggesting(true)}>{t("Ҷойи нав")}</Button>}
        </div>
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
          {[SHOP_KIND, ...PLACE_KINDS].map((k) => (
            <button key={k.value} type="button" onClick={() => update("category", category === k.value ? "" : k.value)} aria-pressed={category === k.value} className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-label-md transition-colors ${category === k.value ? "bg-ink text-on-ink" : "text-on-surface-variant ring-1 ring-inset ring-outline-variant hover:bg-surface-container-low hover:text-on-surface"}`}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: k.color }} aria-hidden />
              {k.label()}
              {(k === SHOP_KIND ? shops.length : counts[k.value]) > 0 && <span className="text-[12px] tabular-nums opacity-60">{k === SHOP_KIND ? shops.length : counts[k.value]}</span>}
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
              points={mapPoints} colors={COLORS} region={region} regionView={REGION_VIEW[region] || REGION_VIEW["Москва"]}
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
                <h2 className="text-[17px] font-semibold">{onlyShops ? SHOP_KIND.label() : near ? t("Дар наздикии шумо") : t("Ҷойҳо")}</h2>
                {!loading && <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[12px] font-medium tabular-nums text-on-surface-variant">{total}</span>}
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
              {!loading && <span className="text-[12px] tabular-nums text-on-surface-variant">{total}</span>}
            </button>
          )}
          {!wide && view === "list" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-[20px] font-semibold">{onlyShops ? SHOP_KIND.label() : near ? t("Дар наздикии шумо") : t("Ҷойҳо")}</h2>
                {!loading && <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[12px] font-medium tabular-nums text-on-surface-variant">{total}</span>}
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-1.5 ring-1 ring-outline-variant">{listBody}</div>
            </div>
          )}
        </div>
        <p className="px-1 text-[12px] text-on-surface-variant">{t("Маълумот аз OpenStreetMap. Агар хато бинед, ҷойи навро пешниҳод кунед.")}</p>
      </div>

      <PlaceDetails
        placeId={openShopId ? null : openId}
        onClose={() => setOpenId(null)}
        onChanged={() => (setVersion((v) => v + 1), reloadSummary())}
        points={mapPoints}
        onRoute={(r) => {
          setRoute(r);
          setOpenId(null);
          setView("map");
        }}
      />
      <ShopDetails
        shopId={openShopId}
        onClose={() => (setOpenId(null), update("shop", ""))}
        points={mapPoints}
        onRoute={(r) => {
          setRoute(r);
          setOpenId(null);
          setView("map");
        }}
      />
      <SuggestPlace open={suggesting} onClose={() => setSuggesting(false)} regions={regions} onSaved={() => (setVersion((v) => v + 1), reloadSummary())} />
    </div>
  );
}

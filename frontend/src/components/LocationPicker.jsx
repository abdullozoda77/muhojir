import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, ExternalLink, Loader2, MapPin, Satellite, Search, TriangleAlert } from "lucide-react";
import { api } from "../api.js";
import { t } from "../i18n.js";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MOSCOW = [37.6176, 55.7558];
const ROUGH_METERS = 100;
const USELESS_METERS = 1000;
const GOOD_METERS = 30;
const MAX_WAIT = 20000;
const SETTLE = 6000;

export function distanceText(meters) {
  return meters < 1000 ? `${Math.round(meters)} м` : `${Math.round(meters / 1000)} км`;
}

export function panoramaUrl(lat, lon) {
  return `https://yandex.ru/maps/?ll=${lon},${lat}&z=18&l=stv%2Csta&panorama%5Bpoint%5D=${lon},${lat}`;
}

export function satelliteUrl(lat, lon) {
  return `https://yandex.ru/maps/?ll=${lon},${lat}&z=18&l=sat%2Cskl&pt=${lon},${lat},pm2rdm`;
}

const point = (lat, lon) => ({ lat: +lat.toFixed(6), lon: +lon.toFixed(6) });

function geoProblem(error) {
  if (!window.isSecureContext) return t("Ҷойгиршавӣ танҳо дар суроғаи бехатар (https://king.tj) кор мекунад. Ҷойро дар харита пахш кунед.");
  if (error?.code === 1) return t("Шумо иҷозати ҷойгиршавиро надодед. Дар танзимоти браузер ё телефон ба ин сайт иҷозат диҳед ва боз пахш кунед, ё ҷойро дар харита пахш кунед.");
  if (error?.code === 3) return t("Ҷойгиршавӣ дер ёфт нашуд. Ба кӯча ё назди тиреза бароед ва боз кӯшиш кунед, ё ҷойро дар харита пахш кунед.");
  return t("Ҷойи шумо ёфт нашуд. GPS-ро дар телефон фаъол кунед ё ҷойро дар харита пахш кунед.");
}

const WORDS = {
  shop: () => ({
    search: t("Суроғаи мағоза"),
    unavailable: t("Ҷустуҷӯи суроға ҳоло кор намекунад. Мағозаро дар харита пахш кунед."),
    notFound: t("Чунин суроға ёфт нашуд. Шаҳр, кӯча ва рақами хонаро санҷед ё мағозаро дар харита пахш кунед."),
    here: t("Ман ҳозир дар мағоза ҳастам — ҷойи маро гиред"),
    click: t("Ё ҷойи мағозаро дар харита пахш кунед. Нишонаро кашида ислоҳ кардан мумкин."),
    rough: (m) => t("Ҷой тахминӣ аст (±{0}). Нишонаи сурхро ба ҷойи дақиқи мағоза кашед ё дар харита пахш кунед.", m),
    noGps: (m) => t("Ин дастгоҳ GPS надорад, бинобар ин браузер ҷойро танҳо аз рӯи интернет тахмин кард (±{0}) — барои мағоза ин дақиқ нест. Сайтро дар телефон дар худи мағоза кушоед ва тугмаро пахш кунед, ё ҷойи мағозаро дар харита ёфта пахш кунед.", m),
  }),
  place: () => ({
    search: t("Суроғаи ҷой"),
    unavailable: t("Ҷустуҷӯи суроға ҳоло кор намекунад. Ҷойро дар харита пахш кунед."),
    notFound: t("Чунин суроға ёфт нашуд. Шаҳр, кӯча ва рақами хонаро санҷед ё ҷойро дар харита пахш кунед."),
    here: t("Ман ҳозир дар ҳамин ҷо ҳастам — ҷойи маро гиред"),
    click: t("Ё ҷойро дар харита пахш кунед. Нишонаро кашида ислоҳ кардан мумкин."),
    rough: (m) => t("Ҷой тахминӣ аст (±{0}). Нишонаи сурхро ба ҷойи дақиқ кашед ё дар харита пахш кунед.", m),
    noGps: (m) => t("Ин дастгоҳ GPS надорад, бинобар ин браузер ҷойро танҳо аз рӯи интернет тахмин кард (±{0}) — ин дақиқ нест. Суроғаро ҷустуҷӯ кунед ё ҷойро дар харита ёфта пахш кунед.", m),
  }),
};

const words = (subject) => (WORDS[subject] || WORDS.shop)();

function AddressSearch({ query, onFound, subject }) {
  const [text, setText] = useState(query || "");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    setText((current) => current || query || "");
  }, [query]);

  const find = async () => {
    const q = text.trim();
    if (q.length < 3) {
      setProblem(t("Суроғаро нависед: шаҳр, кӯча ва хона."));
      return;
    }
    setBusy(true);
    setProblem("");
    setResults(null);
    try {
      const found = await api(`/market/geocode/?q=${encodeURIComponent(q)}`);
      setResults(found);
      if (found.length === 1) {
        onFound(found[0]);
        setResults(null);
      }
    } catch (err) {
      setProblem(err.status === 503 ? words(subject).unavailable : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl bg-surface-container-lowest px-3 ring-1 ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary/40">
          <Search className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
          <input
            type="search"
            className="w-full border-0 bg-transparent p-0 text-body-md focus:ring-0"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                find();
              }
            }}
            placeholder={t("Масалан: Москва, Люблинская 10")}
            aria-label={words(subject).search}
          />
        </label>
        <button type="button" onClick={find} disabled={busy} className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-label-md ring-1 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          {t("Ёфтан")}
        </button>
      </div>
      {problem && <span className="text-body-sm text-error">{problem}</span>}
      {results && (results.length === 0 ? (
        <span className="text-body-sm text-on-surface-variant">{words(subject).notFound}</span>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-xl ring-1 ring-outline-variant">
          <span className="bg-surface-container-low px-3 py-2 text-label-sm text-on-surface-variant">{t("Суроғаи дурустро интихоб кунед:")}</span>
          {results.map((r) => (
            <button key={`${r.lat},${r.lon}`} type="button" title={r.full_name} onClick={() => { onFound(r); setResults(null); }} className="flex items-start gap-2 border-t border-outline-variant px-3 py-2.5 text-left text-body-sm transition-colors hover:bg-surface-container-low">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {r.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function LocationPicker({ value, onChange, readOnly = false, query = "", className = "h-72", subject = "shop" }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const change = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const [address, setAddress] = useState("");
  const watch = useRef(null);
  const has = value && value.lat != null && value.lon != null;
  change.current = onChange;

  const pick = (p, meters = null, name = "") => {
    setAccuracy(meters);
    setAddress(name);
    setProblem("");
    change.current?.(p);
  };

  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: has ? [value.lon, value.lat] : MOSCOW,
      zoom: has ? 17 : 9,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.FullscreenControl(), "top-right");
    if (!readOnly) m.on("click", (e) => pick(point(e.lngLat.lat, e.lngLat.lng)));
    map.current = m;
    return () => {
      marker.current = null;
      map.current = null;
      m.remove();
    };
  }, [readOnly]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!has) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: "#d32f2f", draggable: !readOnly }).setLngLat([value.lon, value.lat]).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current.getLngLat();
        pick(point(p.lat, p.lng));
      });
    } else {
      marker.current.setLngLat([value.lon, value.lat]);
    }
    const target = { center: [value.lon, value.lat], zoom: Math.max(m.getZoom(), 17) };
    if (m.getZoom() < 14) m.jumpTo(target);
    else m.easeTo(target);
  }, [has, value?.lat, value?.lon, readOnly]);

  useEffect(() => () => watch.current?.stop(), []);

  const applyFix = (pos) => {
    const meters = Math.round(pos.coords.accuracy);
    if (meters <= USELESS_METERS) {
      pick(point(pos.coords.latitude, pos.coords.longitude), meters);
      return;
    }
    const zoom = Math.max(5, Math.min(14, 16 - Math.log2(meters / 100)));
    if (!has) map.current?.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom });
    setProblem(words(subject).noGps(distanceText(meters)));
  };

  const locate = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setProblem(geoProblem(null));
      return;
    }
    watch.current?.stop();
    setLocating(true);
    setProblem("");
    let best = null;
    let lastError = null;
    let settle = null;
    const stop = () => {
      navigator.geolocation.clearWatch(id);
      clearTimeout(limit);
      clearTimeout(settle);
      watch.current = null;
    };
    const finish = (error) => {
      stop();
      setLocating(false);
      if (best) applyFix(best);
      else setProblem(geoProblem(error || lastError || { code: 3 }));
    };
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= GOOD_METERS) return finish();
        clearTimeout(settle);
        settle = setTimeout(() => finish(), SETTLE);
      },
      (error) => {
        lastError = error;
        if (error.code === 1) finish(error);
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT, maximumAge: 0 },
    );
    const limit = setTimeout(() => finish(), MAX_WAIT);
    watch.current = { stop };
  };

  const rough = accuracy != null && accuracy > ROUGH_METERS;

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <button type="button" onClick={locate} disabled={locating} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90 disabled:opacity-60">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
          {locating ? t("Ҷойи шуморо меҷӯем…") : words(subject).here}
        </button>
      )}
      {!readOnly && <AddressSearch query={query} subject={subject} onFound={(r) => pick(point(r.lat, r.lon), null, r.name)} />}
      <div ref={box} className={`${className} w-full overflow-hidden rounded-xl ring-1 ring-outline-variant`} />
      {problem && (
        <span role="alert" className="flex items-start gap-1.5 text-body-sm text-error">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {problem}
        </span>
      )}
      {has && address && (
        <span className="text-body-sm text-tertiary">{t("Аз рӯи суроға ёфт шуд: {0}. Агар хона дигар бошад, нишонаро кашида ислоҳ кунед.", address)}</span>
      )}
      {has && accuracy != null && (
        <span className={`flex items-start gap-1.5 text-body-sm ${rough ? "text-warning" : "text-tertiary"}`}>
          {rough && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          {rough
            ? words(subject).rough(distanceText(accuracy))
            : t("Ҷой бо GPS ёфт шуд (±{0}). Агар лозим бошад, нишонаро кашида ислоҳ кунед.", distanceText(accuracy))}
        </span>
      )}
      {has ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
          <span className="inline-flex items-center gap-1.5 tabular-nums text-on-surface-variant">
            <MapPin className="h-4 w-4 text-error" aria-hidden />
            {value.lat.toFixed(5)}, {value.lon.toFixed(5)}
          </span>
          <a href={satelliteUrl(value.lat, value.lon)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <Satellite className="h-3.5 w-3.5" aria-hidden />
            {t("Аз моҳвора дар Яндекс")}
          </a>
          <a href={panoramaUrl(value.lat, value.lon)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            {t("Панорамаи кӯча дар Яндекс")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      ) : (
        !readOnly && <span className="text-body-sm text-on-surface-variant">{words(subject).click}</span>
      )}
    </div>
  );
}

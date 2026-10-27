import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, ExternalLink, Loader2, MapPin, Satellite, TriangleAlert } from "lucide-react";
import { t } from "../i18n.js";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MOSCOW = [37.6176, 55.7558];
const ROUGH_METERS = 100;

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

export default function LocationPicker({ value, onChange, readOnly = false, className = "h-72" }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const change = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const has = value && value.lat != null && value.lon != null;
  change.current = onChange;

  const pick = (p, meters = null) => {
    setAccuracy(meters);
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

  const locate = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setProblem(geoProblem(null));
      return;
    }
    setLocating(true);
    setProblem("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick(point(pos.coords.latitude, pos.coords.longitude), Math.round(pos.coords.accuracy));
      },
      (error) => {
        setLocating(false);
        setProblem(geoProblem(error));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const rough = accuracy != null && accuracy > ROUGH_METERS;

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <button type="button" onClick={locate} disabled={locating} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90 disabled:opacity-60">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
          {locating ? t("Ҷойи шуморо меҷӯем…") : t("Ман ҳозир дар мағоза ҳастам — ҷойи маро гиред")}
        </button>
      )}
      <div ref={box} className={`${className} w-full overflow-hidden rounded-xl ring-1 ring-outline-variant`} />
      {problem && (
        <span role="alert" className="flex items-start gap-1.5 text-body-sm text-error">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {problem}
        </span>
      )}
      {has && accuracy != null && (
        <span className={`flex items-start gap-1.5 text-body-sm ${rough ? "text-warning" : "text-tertiary"}`}>
          {rough && <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          {rough
            ? t("Ҷой тахминӣ аст (±{0} м). Нишонаи сурхро ба ҷойи дақиқи мағоза кашед ё дар харита пахш кунед.", accuracy)
            : t("Ҷой бо GPS ёфт шуд (±{0} м). Агар лозим бошад, нишонаро кашида ислоҳ кунед.", accuracy)}
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
        !readOnly && <span className="text-body-sm text-on-surface-variant">{t("Ё ҷойи мағозаро дар харита пахш кунед. Нишонаро кашида ислоҳ кардан мумкин.")}</span>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, ExternalLink, Loader2, MapPin } from "lucide-react";
import { t } from "../i18n.js";
import { useIsDark } from "../theme.js";

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const MOSCOW = [37.6176, 55.7558];

export function panoramaUrl(lat, lon) {
  return `https://yandex.ru/maps/?ll=${lon},${lat}&z=18&l=stv%2Csta&panorama%5Bpoint%5D=${lon},${lat}`;
}

export function mapUrl(lat, lon) {
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`;
}

export default function LocationPicker({ value, onChange, readOnly = false, className = "h-64" }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const change = useRef(onChange);
  const dark = useIsDark();
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState("");
  const has = value && value.lat != null && value.lon != null;
  change.current = onChange;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLES[dark ? "dark" : "light"],
      center: has ? [value.lon, value.lat] : MOSCOW,
      zoom: has ? 16 : 9,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (!readOnly) m.on("click", (e) => change.current?.({ lat: +e.lngLat.lat.toFixed(6), lon: +e.lngLat.lng.toFixed(6) }));
    map.current = m;
    return () => {
      marker.current = null;
      m.remove();
    };
  }, [dark, readOnly]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!has) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: "#2554d6", draggable: !readOnly }).setLngLat([value.lon, value.lat]).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current.getLngLat();
        change.current?.({ lat: +p.lat.toFixed(6), lon: +p.lng.toFixed(6) });
      });
    } else {
      marker.current.setLngLat([value.lon, value.lat]);
    }
    m.easeTo({ center: [value.lon, value.lat], zoom: Math.max(m.getZoom(), 16) });
  }, [has, value?.lat, value?.lon, readOnly, dark]);

  const locate = () => {
    if (!navigator.geolocation) {
      setProblem(t("Браузер ҷойи шуморо муайян карда наметавонад. Ҷойро дар харита пахш кунед."));
      return;
    }
    setLocating(true);
    setProblem("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        change.current?.({ lat: +pos.coords.latitude.toFixed(6), lon: +pos.coords.longitude.toFixed(6) });
      },
      () => {
        setLocating(false);
        setProblem(t("Ҷойи шумо ёфт нашуд. Иҷозати ҷойгиршавиро диҳед ё ҷойро дар харита пахш кунед."));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <button type="button" onClick={locate} disabled={locating} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-ink px-4 text-label-md text-on-ink transition-colors hover:bg-ink/90 disabled:opacity-60">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
          {t("Ман ҳозир дар мағоза ҳастам — ҷойи маро гиред")}
        </button>
      )}
      <div ref={box} className={`${className} w-full overflow-hidden rounded-xl ring-1 ring-outline-variant`} />
      {problem && <span className="text-body-sm text-error">{problem}</span>}
      {has ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
          <span className="inline-flex items-center gap-1.5 tabular-nums text-on-surface-variant">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            {value.lat.toFixed(5)}, {value.lon.toFixed(5)}
          </span>
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

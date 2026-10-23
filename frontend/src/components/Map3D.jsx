import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Navigation, RotateCw } from "lucide-react";
import { t } from "../i18n.js";

// The 3D map of the places page: OpenFreeMap vector tiles in MapLibre GL ("liberty": bright colors, buildings in
// 3D, readable in the light and the dark theme of the site). It opens on the region, tilted; places glow in their
// category's color and gather into clusters with numbers.

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const FONT = ["Noto Sans Bold"];

function geojson(points, colors) {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: { id: p.id, name: p.name, category: p.category, color: colors[p.category] || "#455a64" },
    })),
  };
}

// Our layers on top of the map style.
function addLayers(map) {
  // 3D buildings from a closer zoom than the style's, a little warmer, so streets read like a model of the city.
  if (map.getLayer("building-3d")) {
    map.setLayerZoomRange("building-3d", 13, 24);
    map.setPaintProperty("building-3d", "fill-extrusion-color", ["interpolate", ["linear"], ["get", "render_height"], 0, "#e8e1d6", 30, "#d9d0c2", 120, "#c7bcab"]);
    map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.9);
  }
  // A soft blue sky above the horizon when the map is tilted.
  map.setSky({ "sky-color": "#6fa8ff", "horizon-color": "#dbe9ff", "fog-color": "#f2f6ff", "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.6 });

  map.addSource("places", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });
  map.addSource("selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  // Clusters: a soft halo and a circle that grows with the number of places.
  map.addLayer({
    id: "cluster-halo", type: "circle", source: "places", filter: ["has", "point_count"],
    paint: {
      "circle-color": "#1447a8", "circle-opacity": 0.22, "circle-blur": 0.6,
      "circle-radius": ["step", ["get", "point_count"], 30, 20, 38, 100, 48],
    },
  });
  map.addLayer({
    id: "clusters", type: "circle", source: "places", filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], "#2f6fe0", 20, "#1447a8", 100, "#0d2f73"],
      "circle-radius": ["step", ["get", "point_count"], 18, 20, 24, 100, 30],
      "circle-stroke-width": 3, "circle-stroke-color": "rgba(255,255,255,0.9)",
    },
  });
  map.addLayer({
    id: "cluster-count", type: "symbol", source: "places", filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 14, "text-allow-overlap": true },
    paint: { "text-color": "#ffffff" },
  });

  // Single places: a glow in the category color, the dot, and the name from close up.
  map.addLayer({
    id: "place-glow", type: "circle", source: "places", filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 12, 16, 22], "circle-opacity": 0.35, "circle-blur": 0.8 },
  });
  map.addLayer({
    id: "places", type: "circle", source: "places", filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 10],
      "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff", "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "place-names", type: "symbol", source: "places", filter: ["!", ["has", "point_count"]], minzoom: 14,
    layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 12, "text-offset": [0, 1.4], "text-anchor": "top", "text-max-width": 10 },
    paint: { "text-color": "#0d2f73", "text-halo-color": "#ffffff", "text-halo-width": 1.8 },
  });

  // The chosen place: a ring that pulses (animated below).
  map.addLayer({
    id: "selected-ring", type: "circle", source: "selected",
    paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 14, "circle-stroke-width": 3, "circle-stroke-color": ["get", "color"], "circle-stroke-opacity": 0.9 },
  });
}

export default function Map3D({ points, colors, region, regionView, selectedId, onOpen }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const ready = useRef(false);
  const data = useRef({ points, selectedId });
  const [pitched, setPitched] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const spin = useRef(false);
  data.current = { points, selectedId, colors };

  // Create the map once, right over the region and tilted.
  useEffect(() => {
    const [lat, lon, zoom] = regionView;
    const map = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [lon, lat],
      zoom,
      pitch: 55,
      bearing: -15,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (import.meta.env.DEV) window.__placesMap = map; // for checking the map in the browser console while developing
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: "place-popup" });

    // As soon as the style is ready (not waiting for every tile), so the places show up at once.
    map.once("style.load", () => {
      addLayers(map);
      ready.current = true;
      refresh();
      fit(data.current.points);
    });

    map.on("click", "clusters", async (e) => {
      const feature = e.features[0];
      const zoom = await map.getSource("places").getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.5, pitch: 55, duration: 900 });
    });
    map.on("click", "places", (e) => onOpen(e.features[0].properties.id));
    for (const layer of ["clusters", "places"]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    }
    map.on("mousemove", "places", (e) => {
      const f = e.features[0];
      popup.setLngLat(f.geometry.coordinates).setText(f.properties.name).addTo(map);
    });
    // Stop turning when the person takes the map in hand.
    map.on("dragstart", () => setSpinning(false));

    // The pulsing ring of the chosen place.
    let frame;
    const pulse = (time) => {
      if (data.current.selectedId && map.getLayer("selected-ring")) {  // only while a place is open
        const s = (Math.sin(time / 300) + 1) / 2;
        map.setPaintProperty("selected-ring", "circle-radius", 12 + s * 10);
        map.setPaintProperty("selected-ring", "circle-stroke-opacity", 1 - s * 0.7);
      }
      frame = requestAnimationFrame(pulse);
    };
    frame = requestAnimationFrame(pulse);

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { points: pts, selectedId: sel, colors: cols } = data.current;
    map.getSource("places")?.setData(geojson(pts, cols));
    const chosen = pts.find((p) => p.id === sel);
    map.getSource("selected")?.setData(geojson(chosen ? [chosen] : [], cols));
  }

  // Shows all points: the camera moves so that every place is on the screen, keeping the 3D tilt.
  function fit(pts) {
    const map = mapRef.current;
    if (!map || !ready.current || !pts.length) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lon, pts[0].lat], zoom: 16, pitch: 60, duration: 1500 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((p) => bounds.extend([p.lon, p.lat]));
    map.fitBounds(bounds, { padding: { top: 70, bottom: 40, left: 40, right: 40 }, maxZoom: 14.5, pitch: pitched ? 50 : 0, duration: 1500 });
  }

  // New points (filters changed): show them all.
  useEffect(() => {
    refresh();
    fit(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // A place was opened (from the list or the map): fly to it, close and tilted, turning a little.
  useEffect(() => {
    refresh();
    const map = mapRef.current;
    const place = points.find((p) => p.id === selectedId);
    if (!map || !place) return;
    map.flyTo({ center: [place.lon, place.lat], zoom: 17, pitch: 65, bearing: map.getBearing() + 35, duration: 2200, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // The region changed and there is nothing to show yet: fly there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current || points.length) return;
    const [lat, lon, zoom] = regionView;
    map.flyTo({ center: [lon, lat], zoom, pitch: pitched ? 55 : 0, duration: 2000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // Slow turning around the center ("tour").
  useEffect(() => {
    spin.current = spinning;
    const map = mapRef.current;
    if (!map || !spinning) return;
    let frame;
    let last = performance.now();
    const turn = (now) => {
      if (!spin.current) return;
      map.setBearing(map.getBearing() + (now - last) * 0.006);
      last = now;
      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  const toggle3d = () => {
    const map = mapRef.current;
    const next = !pitched;
    setPitched(next);
    map?.easeTo({ pitch: next ? 60 : 0, bearing: next ? -20 : 0, duration: 1000 });
  };
  // Back to see all the found places.
  const home = () => {
    setSpinning(false);
    if (points.length) fit(points);
    else {
      const [lat, lon, zoom] = regionView;
      mapRef.current?.flyTo({ center: [lon, lat], zoom, pitch: 55, bearing: -15, duration: 1500 });
    }
  };

  const button = "flex h-10 items-center gap-1.5 rounded-xl px-3 text-label-md shadow-md backdrop-blur-md transition-colors";
  const idle = "bg-surface-container-lowest/85 text-on-surface hover:bg-surface-container-lowest";
  const on = "bg-primary text-on-primary";
  return (
    <div className="relative h-[520px] overflow-hidden rounded-3xl shadow-lg ring-1 ring-outline-variant/30 xl:h-[720px]">
      <div ref={box} className="h-full w-full" />
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <button type="button" onClick={toggle3d} aria-pressed={pitched} className={`${button} ${pitched ? on : idle}`}>
          <Box className="h-4 w-4" aria-hidden />
          {pitched ? "3D" : "2D"}
        </button>
        <button type="button" onClick={() => setSpinning((s) => !s)} aria-pressed={spinning} className={`${button} ${spinning ? on : idle}`}>
          <RotateCw className={`h-4 w-4 ${spinning ? "animate-spin [animation-duration:3s]" : ""}`} aria-hidden />
          {t("Гардиш")}
        </button>
        <button type="button" onClick={home} className={`${button} ${idle}`} aria-label={t("Ҳамаи ҷойҳо")}>
          <Navigation className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("Ҳамаи ҷойҳо")}</span>
        </button>
      </div>
    </div>
  );
}

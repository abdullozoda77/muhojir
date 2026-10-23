import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Car, Footprints, Navigation, RotateCw, X } from "lucide-react";
import { t } from "../i18n.js";
import { useIsDark } from "../theme.js";

// The 3D map of the places page: OpenFreeMap vector tiles in MapLibre GL. Quiet base maps that follow the site's
// theme ("positron" by day, "dark" at night) with our own 3D buildings; places in their category's color, gathered
// into numbered clusters; and a route between two points when one is built.

const FONT = ["Noto Sans Bold"];

// Everything the map draws itself, for each theme.
const THEMES = {
  light: {
    style: "https://tiles.openfreemap.org/styles/positron",
    buildings: ["#eceef3", "#dfe3eb", "#cfd5e1"],
    sky: { "sky-color": "#c9d8f5", "horizon-color": "#eef2fa", "fog-color": "#f6f8fc" },
    cluster: "#102454", clusterText: "#ffffff", clusterRing: "#ffffff",
    dotRing: "#ffffff", name: "#102454", nameHalo: "#ffffff",
    route: "#2554d6", routeCasing: "#ffffff",
  },
  dark: {
    style: "https://tiles.openfreemap.org/styles/dark",
    buildings: ["#1a2440", "#202c4c", "#283658"],
    sky: { "sky-color": "#0a1228", "horizon-color": "#16213f", "fog-color": "#0a1228" },
    cluster: "#eef2fa", clusterText: "#0a1228", clusterRing: "#0a1228",
    dotRing: "#0a1228", name: "#e6ecf8", nameHalo: "#0a1228",
    route: "#84a4ff", routeCasing: "#0a1228",
  },
};

const empty = { type: "FeatureCollection", features: [] };

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

// The route as map data: the line, and its two ends ("from" and "to").
function routeData(route) {
  if (!route) return { line: empty, ends: empty };
  return {
    line: { type: "Feature", geometry: route.geometry, properties: {} },
    ends: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [route.from.lon, route.from.lat] }, properties: { end: "from" } },
        { type: "Feature", geometry: { type: "Point", coordinates: [route.to.lon, route.to.lat] }, properties: { end: "to" } },
      ],
    },
  };
}

// Our layers on top of the base map (added again whenever the theme, and so the base map, changes).
function addLayers(map, th) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;

  // 3D buildings from close up, in quiet tones of the theme, under the street names.
  map.addLayer({
    id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 13,
    paint: {
      "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0], 0, th.buildings[0], 30, th.buildings[1], 120, th.buildings[2]],
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 0.9],
    },
  }, firstLabel);
  map.setSky({ ...th.sky, "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.6 });

  map.addSource("places", { type: "geojson", data: empty, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });
  map.addSource("selected", { type: "geojson", data: empty });
  map.addSource("route", { type: "geojson", data: empty });
  map.addSource("route-ends", { type: "geojson", data: empty });

  // The route under the places: a light casing and the line in the accent color.
  map.addLayer({
    id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": th.routeCasing, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 12], "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": th.route, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 16, 7] },
  });

  // Clusters: one quiet color; the circle grows with the number and a faint ring sits around it.
  map.addLayer({
    id: "cluster-halo", type: "circle", source: "places", filter: ["has", "point_count"],
    paint: {
      "circle-color": th.cluster, "circle-opacity": 0.12,
      "circle-radius": ["step", ["get", "point_count"], 22, 20, 28, 100, 35],
    },
  });
  map.addLayer({
    id: "clusters", type: "circle", source: "places", filter: ["has", "point_count"],
    paint: {
      "circle-color": th.cluster,
      "circle-radius": ["step", ["get", "point_count"], 15, 20, 19, 100, 24],
      "circle-stroke-width": 2, "circle-stroke-color": th.clusterRing,
    },
  });
  map.addLayer({
    id: "cluster-count", type: "symbol", source: "places", filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-allow-overlap": true,
      "text-size": ["step", ["get", "point_count"], 12, 100, 13],
    },
    paint: { "text-color": th.clusterText },
  });

  // Single places: a dot in the category color with a thin ring, and the name from close up.
  map.addLayer({
    id: "places", type: "circle", source: "places", filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 16, 9],
      "circle-stroke-width": 2, "circle-stroke-color": th.dotRing, "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "place-names", type: "symbol", source: "places", filter: ["!", ["has", "point_count"]], minzoom: 14,
    layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 12, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 10 },
    paint: { "text-color": th.name, "text-halo-color": th.nameHalo, "text-halo-width": 1.6 },
  });

  // The two ends of the route: a hollow start and a filled finish.
  map.addLayer({
    id: "route-ends", type: "circle", source: "route-ends",
    paint: {
      "circle-radius": 8, "circle-stroke-width": 3, "circle-stroke-color": th.route,
      "circle-color": ["match", ["get", "end"], "from", th.routeCasing, th.route],
    },
  });

  // The chosen place: a ring that pulses (animated below).
  map.addLayer({
    id: "selected-ring", type: "circle", source: "selected",
    paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 14, "circle-stroke-width": 3, "circle-stroke-color": ["get", "color"], "circle-stroke-opacity": 0.9 },
  });
}

// "3,4 км · 46 дақ" for the route card.
function routeSummary(route) {
  const km = route.distance / 1000;
  const distance = km < 1 ? `${Math.round(route.distance)} м` : t("{0} км", km.toLocaleString("ru-RU", { maximumFractionDigits: 1 }));
  const minutes = Math.max(1, Math.round(route.duration / 60));
  const time = minutes < 60 ? t("{0} дақ.", minutes) : t("{0} соат {1} дақ.", Math.floor(minutes / 60), minutes % 60);
  return `${distance} · ${time}`;
}

// route: { geometry, distance (m), duration (s), mode: "foot" | "car", from: {lat, lon, name}, to: {...} } or null.
// className: the map's size. inset: how many pixels on the left are covered (e.g. by a list over the map), so the
// buttons move right of it and places are framed in the part that is still seen.
export default function Map3D({ points, colors, region, regionView, selectedId, onOpen, route, onClearRoute, className = "h-[520px] xl:h-[720px]", inset = 0 }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const ready = useRef(false);
  const dark = useIsDark();
  const data = useRef({});
  const [pitched, setPitched] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const spin = useRef(false);
  data.current = { points, selectedId, colors, route, dark, inset };

  // Our layers on a freshly loaded base map, then our data on them.
  const onStyle = (map) => {
    addLayers(map, THEMES[data.current.dark ? "dark" : "light"]);
    ready.current = true;
    refresh();
  };

  // Create the map once, right over the region and tilted.
  useEffect(() => {
    const [lat, lon, zoom] = regionView;
    const map = new maplibregl.Map({
      container: box.current,
      style: THEMES[dark ? "dark" : "light"].style,
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
      onStyle(map);
      if (data.current.route) fitRoute(data.current.route);
      else fit(data.current.points);
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

  // The site's theme changed: swap the base map and draw our layers again on it.
  const firstTheme = useRef(dark);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || firstTheme.current === dark) return;
    firstTheme.current = null; // from now on every change counts
    ready.current = false;
    map.setStyle(THEMES[dark ? "dark" : "light"].style, { diff: false });
    map.once("style.load", () => onStyle(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  function refresh() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const { points: pts, selectedId: sel, colors: cols, route: r } = data.current;
    map.getSource("places")?.setData(geojson(pts, cols));
    const chosen = pts.find((p) => p.id === sel);
    map.getSource("selected")?.setData(geojson(chosen ? [chosen] : [], cols));
    const { line, ends } = routeData(r);
    map.getSource("route")?.setData(line);
    map.getSource("route-ends")?.setData(ends);
  }

  // Shows all points: the camera moves so that every place is on the screen, keeping the 3D tilt.
  function fit(pts) {
    const map = mapRef.current;
    if (!map || !ready.current || !pts.length) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lon, pts[0].lat], zoom: 16, pitch: 60, offset: [data.current.inset / 2, 0], duration: 1500 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((p) => bounds.extend([p.lon, p.lat]));
    map.fitBounds(bounds, { padding: { top: 70, bottom: 40, left: 40 + data.current.inset, right: 40 }, maxZoom: 14.5, pitch: pitched ? 50 : 0, duration: 1500 });
  }

  // Shows the whole route, a little tilted, with room for the route card at the bottom.
  function fitRoute(r) {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const bounds = new maplibregl.LngLatBounds();
    r.geometry.coordinates.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, { padding: { top: 70, bottom: 120, left: 50 + data.current.inset, right: 60 }, maxZoom: 16, pitch: pitched ? 40 : 0, bearing: 0, duration: 1600 });
  }

  // New points (filters changed): show them all.
  useEffect(() => {
    refresh();
    if (!data.current.route) fit(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // A route was built or cleared.
  useEffect(() => {
    refresh();
    if (route) {
      setSpinning(false);
      fitRoute(route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // The covered part changed (the list was folded or opened): frame the places again in what is seen.
  const firstInset = useRef(true);
  useEffect(() => {
    if (firstInset.current) {
      firstInset.current = false;
      return;
    }
    if (route) fitRoute(route);
    else if (!selectedId) fit(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inset]);

  // A place was opened (from the list or the map): fly to it, close and tilted, turning a little.
  useEffect(() => {
    refresh();
    const map = mapRef.current;
    const place = points.find((p) => p.id === selectedId);
    if (!map || !place) return;
    map.flyTo({ center: [place.lon, place.lat], zoom: 17, pitch: 65, bearing: map.getBearing() + 35, offset: [inset / 2, 0], duration: 2200, essential: true });
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
  // Back to see all the found places (or the whole route).
  const home = () => {
    setSpinning(false);
    if (route) fitRoute(route);
    else if (points.length) fit(points);
    else {
      const [lat, lon, zoom] = regionView;
      mapRef.current?.flyTo({ center: [lon, lat], zoom, pitch: 55, bearing: -15, duration: 1500 });
    }
  };

  const button = "flex h-9 items-center gap-1.5 rounded-lg px-3 text-label-md shadow-sm ring-1 ring-black/5 backdrop-blur-md transition-colors";
  const idle = "bg-surface-container-lowest/90 text-on-surface hover:bg-surface-container-lowest";
  const on = "bg-ink text-on-ink";
  const ModeIcon = route?.mode === "car" ? Car : Footprints;
  return (
    <div className={`relative overflow-hidden rounded-2xl ring-1 ring-outline-variant ${className}`}>
      <div ref={box} className="h-full w-full" />
      <div className="absolute top-3 flex flex-wrap gap-2 transition-[left] duration-300" style={{ left: 12 + inset }}>
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

      {/* The built route: how long and how far, from where to where, and a button to remove it. */}
      {route && (
        <div className="absolute inset-x-3 bottom-9 flex items-center gap-3 rounded-xl bg-surface-container-lowest/95 p-3 shadow-lg ring-1 ring-outline-variant backdrop-blur-md sm:right-auto sm:max-w-sm" style={inset ? { left: 12 + inset } : undefined}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-on-surface ring-1 ring-outline-variant">
            <ModeIcon className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold tabular-nums">{routeSummary(route)}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{route.from.name} → {route.to.name}</span>
          </span>
          <button type="button" onClick={onClearRoute} aria-label={t("Маршрутро пок кардан")} title={t("Маршрутро пок кардан")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

import Blossomfall from "./Blossomfall.jsx";
import Leaffall from "./Leaffall.jsx";
import Snowfall from "./Snowfall.jsx";
import Summerglow from "./Summerglow.jsx";

const SEASONS = ["spring", "navruz", "summer", "autumn", "winter", "none"];

function devSeason() {
  if (!import.meta.env.DEV) return null;
  try {
    const asked = new URLSearchParams(window.location.search).get("season");
    if (asked !== null) {
      if (SEASONS.includes(asked)) localStorage.setItem("dev-season", asked);
      else localStorage.removeItem("dev-season");
    }
    return localStorage.getItem("dev-season");
  } catch {
    return null;
  }
}

export function isNavruz(day = new Date()) {
  const forced = devSeason();
  if (forced) return forced === "navruz";
  return day.getMonth() === 2 && day.getDate() >= 20 && day.getDate() <= 25;
}

export function season(day = new Date()) {
  const forced = devSeason();
  if (forced) return forced === "none" ? null : forced === "navruz" ? "spring" : forced;
  const month = day.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

export default function SeasonFall({ className = "", density = 1 }) {
  const now = season();
  if (now === "spring") return <Blossomfall className={className} density={density * (isNavruz() ? 1.7 : 1)} />;
  if (now === "summer") return <Summerglow className={className} density={density} />;
  if (now === "autumn") return <Leaffall className={className} density={density} />;
  if (now === "winter") return <Snowfall className={className} density={density} />;
  return null;
}

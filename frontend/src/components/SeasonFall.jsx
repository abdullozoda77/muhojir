import Leaffall from "./Leaffall.jsx";
import Snowfall from "./Snowfall.jsx";

const SEASONS = ["autumn", "winter", "none"];

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

export function season(day = new Date()) {
  const forced = devSeason();
  if (forced) return forced === "none" ? null : forced;
  const month = day.getMonth();
  if (month >= 8 && month <= 10) return "autumn";
  if (month === 11 || month <= 1) return "winter";
  return null;
}

export default function SeasonFall({ className = "", density = 1 }) {
  const now = season();
  if (now === "autumn") return <Leaffall className={className} density={density} />;
  if (now === "winter") return <Snowfall className={className} density={density} />;
  return null;
}

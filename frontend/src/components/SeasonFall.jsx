import Leaffall from "./Leaffall.jsx";
import Snowfall from "./Snowfall.jsx";

export function season(day = new Date()) {
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

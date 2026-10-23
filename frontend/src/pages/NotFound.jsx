import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { t } from "../i18n.js";
import { EmptyState } from "../components/ui.jsx";

export default function NotFound() {
  return (
    <EmptyState icon={Compass} title={t("Саҳифа ёфт нашуд")} text={t("Шояд суроға нодуруст аст ё саҳифа нест карда шудааст.")}>
      <Link to="/" className="inline-flex min-h-[48px] items-center rounded-xl bg-primary px-6 text-label-lg text-on-primary">{t("Ба саҳифаи асосӣ")}</Link>
    </EmptyState>
  );
}

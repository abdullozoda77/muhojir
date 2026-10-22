import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { t } from "../i18n.js";
import { EmptyState } from "../components/ui.jsx";

export default function NotFound() {
  return (
    <EmptyState icon={Compass} title={t("Саҳифа ёфт нашуд")} text={t("Шояд суроға нодуруст аст ё саҳифа нест карда шудааст.")}>
      <Link to="/" className="inline-flex min-h-[48px] items-center rounded-full bg-navy px-6 text-label-lg text-white shadow-[0_10px_22px_-10px_rgb(16_38_92/0.8)] transition-all hover:-translate-y-px hover:brightness-125 dark:bg-primary dark:text-on-primary">{t("Ба саҳифаи асосӣ")}</Link>
    </EmptyState>
  );
}

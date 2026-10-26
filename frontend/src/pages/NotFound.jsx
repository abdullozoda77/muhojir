import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { t } from "../i18n.js";
import { Intro, IntroItem } from "../components/motion.jsx";

export default function NotFound() {
  return (
    <Intro className="flex flex-col items-center gap-4 py-20 text-center md:py-28">
      <IntroItem as="span" className="text-[96px] font-semibold leading-none tracking-[-0.06em] text-outline-variant md:text-[140px]">404</IntroItem>
      <IntroItem as="h1" className="text-[26px] font-semibold tracking-tight md:text-[32px]">{t("Саҳифа ёфт нашуд")}</IntroItem>
      <IntroItem as="p" className="max-w-md text-body-lg text-on-surface-variant">{t("Шояд суроға нодуруст аст ё саҳифа нест карда шудааст.")}</IntroItem>
      <IntroItem>
        <Link to="/" className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-label-md text-on-ink transition-colors hover:bg-ink/90">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Ба саҳифаи асосӣ")}
        </Link>
      </IntroItem>
    </Intro>
  );
}

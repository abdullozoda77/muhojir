import { Download, Share, Smartphone } from "lucide-react";
import { t } from "../i18n.js";
import { isIOS, useInstall } from "../pwa.js";
import { Button } from "./ui.jsx";

// "The site on your phone": install it on the home screen, like an app.
export default function PhoneApp() {
  const { installed, canInstall, install } = useInstall();

  return (
    <section className="card flex flex-col gap-4 p-6 md:p-8">
      <h2 className="flex items-center gap-3 text-[20px] font-display font-extrabold text-navy dark:text-on-surface">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-fixed text-on-primary-fixed">
          <Smartphone className="h-5 w-5" aria-hidden />
        </span>
        {t("Барнома дар телефон")}
      </h2>

      {installed ? (
        <p className="rounded-[18px] bg-tertiary-fixed p-4 text-label-md text-on-tertiary-fixed">{t("Muhojir дар телефони шумо насб шудааст.")}</p>
      ) : canInstall ? (
        <div className="flex flex-col gap-3">
          <p className="text-body-md text-on-surface-variant">{t("Сайтро мисли барнома насб кунед: аз экрани асосӣ кушода мешавад ва ҳуҷҷатҳоятон бе интернет ҳам намоёнанд.")}</p>
          <Button icon={Download} onClick={install} className="self-start">{t("Ба телефон насб кардан")}</Button>
        </div>
      ) : isIOS() ? (
        <ol className="flex flex-col gap-2 text-body-md">
          <li className="flex items-center gap-2">1. {t("Дар Safari тугмаи «Мубодила»-ро пахш кунед")} <Share className="h-4 w-4 text-primary" aria-hidden /></li>
          <li>2. {t("«На экран „Домой“»-ро интихоб кунед.")}</li>
          <li>3. {t("«Добавить»-ро пахш кунед — Muhojir дар экрани асосӣ пайдо мешавад.")}</li>
        </ol>
      ) : (
        <p className="text-body-md text-on-surface-variant">{t("Дар менюи браузер «Насб кардан» ё «Ба экрани асосӣ илова кардан»-ро интихоб кунед.")}</p>
      )}
    </section>
  );
}

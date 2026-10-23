import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { t, useLang } from "../i18n.js";
import { isIOS, useInstall } from "../pwa.js";
import { Drawer } from "./ui.jsx";

// "Install as an app" everywhere on the site: a banner on phones, a button in the menus.
// Android/desktop Chrome install with one tap; on iPhone Apple allows only Share -> "Add to Home Screen", so we show how.
const InstallContext = createContext(null);

const DISMISS_KEY = "installBannerHidden";
const HIDE_FOR_DAYS = 14;

function bannerDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < HIDE_FOR_DAYS * 86400000;
  } catch {
    return false;
  }
}

export function InstallProvider({ children }) {
  useLang(); // it sits outside App, so it follows a language change itself
  const { installed, canInstall, install } = useInstall();
  const [guide, setGuide] = useState(false);
  const available = !installed && (canInstall || isIOS());
  const start = () => (canInstall ? install() : setGuide(true));

  return (
    <InstallContext.Provider value={{ available, start }}>
      {children}
      <Drawer open={guide} onClose={() => setGuide(false)} title={t("Ба телефон насб кардан")} subtitle={t("Дар iPhone се қадам")} icon={Download}>
        <ol className="flex flex-col gap-3">
          {[
            { icon: Share, text: t("Дар Safari тугмаи «Мубодила»-ро пахш кунед") },
            { icon: PlusSquare, text: t("«На экран „Домой“»-ро интихоб кунед.") },
            { icon: Download, text: t("«Добавить»-ро пахш кунед — Muhojir дар экрани асосӣ пайдо мешавад.") },
          ].map(({ icon: Icon, text }, i) => (
            <li key={i} className="card flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed font-semibold text-primary">{i + 1}</span>
              <span className="flex-1 text-body-md">{text}</span>
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            </li>
          ))}
        </ol>
      </Drawer>
    </InstallContext.Provider>
  );
}

export const useInstallApp = () => useContext(InstallContext);

// A wide button for the phone menu.
export function InstallMenuButton({ onDone }) {
  const { available, start } = useInstallApp();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onDone?.();
        start();
      }}
      className="mt-4 flex min-h-[56px] w-full items-center gap-3 rounded-xl bg-gradient-to-br from-[#172f73] to-[#1d4ed8] px-4 text-left text-white shadow-lg shadow-primary/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white p-0.5"><img src="/logo.png" alt="" className="h-full w-full rounded-full" /></span>
      <span className="flex-1">
        <span className="block text-label-lg">{t("Ҳамчун барнома насб кардан")}</span>
        <span className="text-body-sm text-white/75">{t("Аз экрани асосӣ, бе браузер")}</span>
      </span>
      <Download className="h-5 w-5 shrink-0" aria-hidden />
    </button>
  );
}

// A small button for the header on big screens.
export function InstallHeaderButton() {
  const { available, start } = useInstallApp();
  if (!available) return null;
  return (
    <button type="button" onClick={start} className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-label-md text-primary ring-1 ring-inset ring-primary/25 transition-colors hover:bg-primary-fixed xl:inline-flex">
      <Download className="h-4 w-4" aria-hidden />
      {t("Насб кардан")}
    </button>
  );
}

// On phones: a card that slides in under the header a few seconds after the site opens.
export function InstallBanner() {
  const { available, start } = useInstallApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!available || bannerDismissed()) return;
    const id = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(id);
  }, [available]);

  const hide = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode: it will show again next time
    }
  };

  return (
    <AnimatePresence>
      {show && available && (
        <m.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-3 top-[70px] z-[55] flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-[#172f73] to-[#1d4ed8] p-3.5 text-white shadow-[0_18px_40px_-16px_rgba(23,47,115,0.8)] ring-1 ring-white/10 lg:hidden"
          role="dialog"
          aria-label={t("Ҳамчун барнома насб кардан")}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white p-0.5"><img src="/logo.png" alt="" className="h-full w-full rounded-full" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg leading-snug">{t("Барномаи Muhojir")}</span>
              <span className="block text-body-sm leading-snug text-white/75">{t("Аз экрани асосӣ, бе браузер")}</span>
            </span>
            <button type="button" onClick={hide} aria-label={t("Пӯшидан")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              hide();
              start();
            }}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white text-label-lg text-[#172f73]"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("Ҳамчун барнома насб кардан")}
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}

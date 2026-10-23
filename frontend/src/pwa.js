import { useEffect, useState } from "react";

// The site as a phone app: the service worker (public/sw.js) and "install on the phone".

// Only in the built site: in development the service worker would keep old files while the code changes.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// After logout (or a login as someone else) the saved copies of the user's own data are forgotten.
export function clearUserData() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-user-data" });
}

// Chrome on Android offers installing through this event; it comes once, so it is caught early and kept.
let installEvent = null;
const installListeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event;
    installListeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    installListeners.forEach((fn) => fn());
  });
}

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// {installed, canInstall, install()}: canInstall is true where the browser can install it with one button.
export function useInstall() {
  const [, redraw] = useState(0);
  useEffect(() => {
    const fn = () => redraw((n) => n + 1);
    installListeners.add(fn);
    return () => installListeners.delete(fn);
  }, []);
  return {
    installed: isStandalone(),
    canInstall: Boolean(installEvent),
    install: async () => {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice.catch(() => null);
      installEvent = null;
      installListeners.forEach((fn) => fn());
    },
  };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

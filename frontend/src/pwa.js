import { useEffect, useState } from "react";

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

const CHECK_EVERY = 10 * 60 * 1000;
const loadedBuild = () => document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute("src") || null;

async function newBuildOnServer() {
  const current = loadedBuild();
  if (!current || !navigator.onLine) return false;
  try {
    const response = await fetch(`/index.html?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return false;
    const latest = (await response.text()).match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    return Boolean(latest && latest !== current);
  } catch {
    return false;
  }
}

export function useAppUpdate() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let hiddenAt = 0;
    const check = async (resumed) => {
      navigator.serviceWorker?.getRegistration().then((reg) => reg?.update()).catch(() => {});
      if (!(await newBuildOnServer())) return;
      if (resumed) window.location.reload();
      else setReady(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt) check(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => document.visibilityState === "visible" && check(false), CHECK_EVERY);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, []);
  return { ready, apply: () => window.location.reload() };
}

export function clearUserData() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-user-data" });
  navigator.serviceWorker?.getRegistration()
    .then((reg) => reg?.pushManager?.getSubscription())
    .then((sub) => sub?.unsubscribe())
    .catch(() => {});
}

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

const pushSupported = () =>
  import.meta.env.PROD && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64) {
  const text = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export function usePush(api) {
  const [state, setState] = useState({ supported: pushSupported(), enabled: false, denied: false, busy: true });

  useEffect(() => {
    if (!pushSupported()) {
      setState((s) => ({ ...s, busy: false }));
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState((s) => ({ ...s, enabled: Boolean(sub), denied: Notification.permission === "denied", busy: false })))
      .catch(() => setState((s) => ({ ...s, busy: false })));
  }, []);

  const enable = async () => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((s) => ({ ...s, denied: permission === "denied", busy: false }));
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api("/push/");
      let sub = await reg.pushManager.getSubscription();
      if (sub && keyBytes(key).join() !== new Uint8Array(sub.options.applicationServerKey || []).join()) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
      await api("/push/subscribe/", { method: "POST", body: sub.toJSON() });
      setState((s) => ({ ...s, enabled: true, denied: false, busy: false }));
      return true;
    } catch {
      setState((s) => ({ ...s, busy: false }));
      return false;
    }
  };

  const disable = async () => {
    setState((s) => ({ ...s, busy: true }));
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await api("/push/unsubscribe/", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      setState((s) => ({ ...s, enabled: false, busy: false }));
    }
  };

  const test = () => api("/push/test/", { method: "POST" });

  return { ...state, enable, disable, test };
}

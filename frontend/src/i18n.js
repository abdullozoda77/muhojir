import { useSyncExternalStore } from "react";
import ru from "./translations.js";

const saved = (() => {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
})();

export let lang = saved === "ru" ? "ru" : "tg";
document.documentElement.lang = lang;

const listeners = new Set();

export function t(text, ...args) {
  const out = (lang === "ru" && ru[text]) || text;
  return args.reduce((s, a, i) => s.replaceAll(`{${i}}`, a), out);
}

export function setLang(next) {
  if (next === lang) return;
  try {
    localStorage.setItem("lang", next);
  } catch {
  }
  lang = next;
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

export function useLang() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => lang,
  );
}

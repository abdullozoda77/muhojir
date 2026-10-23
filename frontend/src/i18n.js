import { useSyncExternalStore } from "react";
import ru from "./translations.js";

// The site is written in Tajik. t("Тоҷикӣ матн") returns the Russian translation when Russian is chosen,
// and the Tajik text itself otherwise (also when a translation is missing). {0}, {1} are filled in from args.
// Changing the language does not reload the page: App re-renders everything with useLang(), so text must be
// translated while rendering — not once when a file loads (lists of labels use getters, see constants.js).
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
    // private mode: the choice lasts only for this page
  }
  lang = next;
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

// The current language; the component re-renders when it changes.
export function useLang() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => lang,
  );
}

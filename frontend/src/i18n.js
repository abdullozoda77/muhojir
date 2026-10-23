import ru from "./translations.js";

// The site is written in Tajik. t("Тоҷикӣ матн") returns the Russian translation when Russian is chosen,
// and the Tajik text itself otherwise (also when a translation is missing). {0}, {1} are filled in from args.
const saved = (() => {
  try {
    return localStorage.getItem("lang");
  } catch {
    return null;
  }
})();

export const lang = saved === "ru" ? "ru" : "tg";

export function t(text, ...args) {
  const out = (lang === "ru" && ru[text]) || text;
  return args.reduce((s, a, i) => s.replaceAll(`{${i}}`, a), out);
}

export function setLang(next) {
  try {
    localStorage.setItem("lang", next);
  } catch {
    // private mode: the choice lasts only for this page
  }
  window.location.reload();
}

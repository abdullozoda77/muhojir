import { useEffect, useState } from "react";

// Light / dark theme. index.html already set html.dark before the first paint; this keeps it in sync.
const isDark = () => document.documentElement.classList.contains("dark");

// Only reads the theme and follows it when it changes anywhere (e.g. the map, which draws its own colors).
export function useIsDark() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

// Puts a theme on the page; remember: true also saves it as the user's own choice.
function applyTheme(dark, remember) {
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#09122a" : "#f6f2ea");
  if (!remember) return;
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // private mode: the choice lasts only for this page
  }
}

// Every switch on the site (header, phone menu, profile) shares the one theme on <html>, so they never disagree.
export function useTheme() {
  const dark = useIsDark();

  // Until the user chooses, follow the phone's setting when it changes (e.g. night mode at sunset).
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = (e) => {
      try {
        if (!localStorage.getItem("theme")) applyTheme(e.matches, false);
      } catch {
        applyTheme(e.matches, false);
      }
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  return { dark, toggle: () => applyTheme(!dark, true), setDark: (next) => applyTheme(next, true) };
}

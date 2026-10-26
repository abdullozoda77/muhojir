import { useEffect, useState } from "react";

const isDark = () => document.documentElement.classList.contains("dark");

export function useIsDark() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function applyTheme(dark, remember) {
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#09122a" : "#f6f2ea");
  if (!remember) return;
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
  }
}

export function useTheme() {
  const dark = useIsDark();

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

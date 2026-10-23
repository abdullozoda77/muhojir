import { useEffect, useState } from "react";

// Light / dark theme. index.html already set html.dark before the first paint; this keeps it in sync.
const isDark = () => document.documentElement.classList.contains("dark");

export function useTheme() {
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#09122a" : "#0b1b42");
  }, [dark]);

  // Until the user chooses, follow the phone's setting when it changes (e.g. night mode at sunset).
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = (e) => {
      try {
        if (!localStorage.getItem("theme")) setDark(e.matches);
      } catch {
        setDark(e.matches);
      }
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  const toggle = () => {
    setDark((d) => {
      try {
        localStorage.setItem("theme", d ? "light" : "dark");
      } catch {
        // private mode: the choice lasts only for this page
      }
      return !d;
    });
  };
  return { dark, toggle };
}

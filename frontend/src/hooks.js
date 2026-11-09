import { useCallback, useEffect, useState } from "react";
import { api, apiAll } from "./api.js";
import { useLang } from "./i18n.js";

export function useApi(path) {
  const lang = useLang();
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => {
      alive = false;
    };
  }, [path, tick, lang]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

export function useDocuments() {
  const lang = useLang();
  const [state, setState] = useState({ docs: [], types: [], regions: [], loading: true, error: null });
  const load = useCallback(async () => {
    try {
      const [docs, types, regions] = await Promise.all([
        apiAll("/documents/my-documents/"),
        apiAll("/documents/document-types/"),
        apiAll("/documents/regions/"),
      ]);
      setState({ docs, types, regions, loading: false, error: null });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [lang]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

let locks = 0;
let savedY = 0;

export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (locks++ === 0) {
      savedY = window.scrollY;
      const body = document.body.style;
      Object.assign(body, { position: "fixed", top: `-${savedY}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
      document.documentElement.style.overscrollBehavior = "none";
    }
    return () => {
      if (--locks === 0) {
        const body = document.body.style;
        Object.assign(body, { position: "", top: "", left: "", right: "", width: "", overflow: "" });
        document.documentElement.style.overscrollBehavior = "";
        window.scrollTo(0, savedY);
      }
    };
  }, [active]);
}

export function pageZoom() {
  return parseFloat(document.documentElement.style.zoom) || 1;
}

import { useCallback, useEffect, useState } from "react";
import { api, apiAll } from "./api.js";

// const { data, error, loading, reload } = useApi("/jobs/jobs/"). Pass null as the path to skip loading.
export function useApi(path) {
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
  }, [path, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

// Loads everything the documents screens need: the user's documents, document types and regions.
export function useDocuments() {
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
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

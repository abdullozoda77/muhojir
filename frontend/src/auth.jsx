import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setLogoutHandler, tokens } from "./api.js";
import { clearUserData } from "./pwa.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access));

  const logout = useCallback(async () => {
    clearUserData();
    const refresh = tokens.refresh;
    tokens.clear();
    setUser(null);
    if (refresh) {
      fetch("/api/auth/logout/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh }) }).catch(() => {});
    }
  }, []);

  const reload = useCallback(async () => {
    if (!tokens.access) return setUser(null);
    try {
      setUser(await api("/auth/profile/"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setLogoutHandler(() => setUser(null));
    reload().finally(() => setLoading(false));
  }, [reload]);

  const login = useCallback((data) => {
    clearUserData();
    tokens.save(data);
    setUser(data.user);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, login, logout, reload }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

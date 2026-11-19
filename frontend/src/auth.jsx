import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setLogoutHandler, tokens } from "./api.js";
import { clearUserData } from "./pwa.js";

const AuthContext = createContext(null);
const SAVED_USER = "user-cache";

function savedUser(value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(SAVED_USER));
    if (value === null) localStorage.removeItem(SAVED_USER);
    else localStorage.setItem(SAVED_USER, JSON.stringify(value));
  } catch {
    return null;
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access));

  const logout = useCallback(async () => {
    clearUserData();
    savedUser(null);
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
      const profile = await api("/auth/profile/");
      savedUser(profile);
      setUser(profile);
    } catch (error) {
      setUser(error.status === 0 && tokens.access ? savedUser() : null);
    }
  }, []);

  useEffect(() => {
    setLogoutHandler(() => {
      savedUser(null);
      setUser(null);
    });
    reload().finally(() => setLoading(false));
  }, [reload]);

  const login = useCallback((data) => {
    clearUserData();
    savedUser(data.user || null);
    tokens.save(data);
    setUser(data.user);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, login, logout, reload }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

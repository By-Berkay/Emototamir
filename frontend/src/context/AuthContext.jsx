import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      setTenant(data.tenant);
      applyTheme(data.tenant);
    } catch {
      setUser(false); setTenant(null);
    }
  };

  useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("token", data.token);
    setUser(data.user);
    setTenant(data.tenant);
    applyTheme(data.tenant);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("token");
    setUser(false); setTenant(null);
    applyTheme(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, setUser, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

function applyTheme(tenant) {
  const root = document.documentElement;
  const primary = tenant?.primary_color || "#F97316";
  const secondary = tenant?.secondary_color || "#0F172A";
  const font = tenant?.font_family || "IBM Plex Sans";
  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-secondary", secondary);
  root.style.setProperty("--brand-font", `'${font}', ui-sans-serif, system-ui, sans-serif`);
  document.body.style.fontFamily = `'${font}', ui-sans-serif, system-ui, sans-serif`;
  // Dynamically load Google Font if not IBM Plex Sans
  if (font && font !== "IBM Plex Sans") {
    const id = `font-${font.replace(/\s+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id; link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }
}

export const useAuth = () => useContext(AuthContext);

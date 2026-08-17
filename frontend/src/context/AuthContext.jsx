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

function shade(hex, pct) {
  // pct positive → lighter, negative → darker
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

export function applyTheme(tenant) {
  const root = document.documentElement;
  const primary = tenant?.primary_color || "#F97316";
  const secondary = tenant?.secondary_color || "#0F172A";
  const font = tenant?.font_family || "IBM Plex Sans";
  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-primary-hover", shade(primary, -0.12));
  root.style.setProperty("--brand-primary-strong", shade(primary, -0.28));
  root.style.setProperty("--brand-primary-soft", shade(primary, 0.85));
  root.style.setProperty("--brand-secondary", secondary);
  root.style.setProperty("--brand-font", `'${font}', ui-sans-serif, system-ui, sans-serif`);
  document.body.style.fontFamily = `'${font}', ui-sans-serif, system-ui, sans-serif`;
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

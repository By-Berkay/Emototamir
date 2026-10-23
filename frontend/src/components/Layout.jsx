import React, { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Bike, Wrench, ClipboardList,
  Wallet, Receipt, BarChart3, Settings, LogOut, Menu, Search, X, BellRing, Building2, History, FileText, Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const NAV_TENANT = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/customers", label: "Müşteriler", icon: Users },
  { to: "/motorcycles", label: "Motosikletler", icon: Bike },
  { to: "/service-orders", label: "Servis Kayıtları", icon: Wrench },
  { to: "/service-orders/new", label: "Yeni İş Emri", icon: ClipboardList },
  { to: "/quotes", label: "Fiyat Teklifleri", icon: FileText },
  { to: "/current-accounts", label: "Cari Hesaplar", icon: Wallet },
  { to: "/payments", label: "Tahsilatlar", icon: Receipt },
  { to: "/reminders", label: "Bakım Hatırlatma", icon: BellRing },
  { to: "/reports", label: "Raporlar", icon: BarChart3 },
  { to: "/trash", label: "Çöp Kutusu", icon: Trash2, adminOnly: true },
  { to: "/settings", label: "Ayarlar", icon: Settings },
];

const NAV_SUPER = [
  { to: "/admin/tenants", label: "Firma Yönetimi", icon: Building2, end: true },
  { to: "/admin/audit-logs", label: "Denetim Kayıtları", icon: History },
];

export default function Layout() {
  const { user, tenant, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const NAV = user?.role === "super_admin" ? NAV_SUPER : NAV_TENANT;

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/service-orders?q=${encodeURIComponent(q.trim())}`);
  };

  // Süper Admin firma verisine erişemez (backend 403 döner); firma sayfalarına girerse firma yönetimine yönlendir
  if (user?.role === "super_admin" && !pathname.startsWith("/admin") && pathname !== "/settings") {
    return <Navigate to="/admin/tenants" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky lg:top-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 transition-transform duration-200 shrink-0`}
        data-testid="sidebar"
      >
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <div className="h-9 w-9 rounded-md flex items-center justify-center mr-3" style={{ backgroundColor: "var(--brand-primary, #F97316)" }}>
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-bold text-white text-base leading-tight truncate">{tenant?.name || "E-MOTO TAMİR"}</div>
            <div className="text-xs text-slate-400">{user?.role === "super_admin" ? "Süper Admin" : "Yönetim Sistemi"}</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} data-testid="close-sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {NAV.filter(n => !n.adminOnly || user?.role === "admin" || user?.role === "super_admin").map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-5 py-2.5 text-sm border-l-4 border-transparent hover:bg-slate-800 hover:text-white transition-colors duration-150 ${
                  isActive ? "bg-slate-800 text-white font-medium" : ""
                }`
              }
              style={({ isActive }) => (isActive ? { borderLeftColor: "var(--brand-primary, #F97316)" } : {})}
              data-testid={`nav-${n.to.replace(/\//g, "_") || "root"}`}
            >
              <n.icon className="h-4 w-4 mr-3" />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="text-xs text-slate-400 mb-1">Giriş Yapan</div>
          <div className="text-sm text-white truncate">{user?.name}</div>
          <div className="text-xs text-slate-400 mb-3 truncate">{user?.email}</div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            onClick={logout}
            data-testid="btn-logout"
          >
            <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <button className="lg:hidden mr-2" onClick={() => setOpen(true)} data-testid="open-sidebar">
            <Menu className="h-5 w-5" />
          </button>
          <form onSubmit={onSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Plaka, müşteri, servis no ile ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-10 bg-slate-50 border-slate-200 font-body"
                data-testid="global-search"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-800">{user?.name}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">{user?.role}</span>
            </div>
            <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
              {(user?.name || "?").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)}></div>
      )}
    </div>
  );
}

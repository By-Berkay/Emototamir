import React, { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Bike, Wrench, ClipboardList, ClipboardCheck, Wallet, Receipt,
  BarChart3, Settings, LogOut, Menu, Search, X, BellRing, Building2, History, FileText,
  Trash2, KeyRound, Plus, UserRound, ArrowLeftRight, Banknote,
} from "lucide-react";
import { Input } from "./ui/input";
import { usePrivacy } from "../context/PrivacyContext";
import { Lock, LockOpen } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import AuthedImage from "./AuthedImage";

const ROLE_LABELS = {
  super_admin: "Süper Admin",
  admin: "Firma Yöneticisi",
  service_advisor: "Servis Danışmanı",
  technician: "Teknisyen",
  accountant: "Muhasebe",
};

// Sol menü grupları. "match" verilen öğelerde aktiflik özel kuralla belirlenir
// (örn. "/service-orders" listesi, "/service-orders/new" ile çakışmasın diye).
const NAV_TENANT = [
  {
    title: "Genel",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/customers", label: "Müşteriler", icon: Users },
      { to: "/motorcycles", label: "Motosikletler", icon: Bike },
    ],
  },
  {
    title: "İş akışı",
    items: [
      {
        to: "/service-orders", label: "Servis Kayıtları", icon: Wrench,
        match: (p) => p.startsWith("/service-orders") && !p.startsWith("/service-orders/new"),
      },
      { to: "/service-orders/new", label: "Yeni İş Emri", icon: ClipboardList, end: true },
      { to: "/inspections", label: "Ekspertiz", icon: ClipboardCheck },
      { to: "/quotes", label: "Fiyat Teklifleri", icon: FileText },
      { to: "/reminders", label: "Bakım Hatırlatma", icon: BellRing },
    ],
  },
  {
    title: "Finans",
    items: [
      { to: "/finance", label: "Gelir & Gider", icon: ArrowLeftRight, financeOnly: true },
      { to: "/finance/staff", label: "Personel & Maaş", icon: Banknote, financeOnly: true },
      { to: "/current-accounts", label: "Cari Hesaplar", icon: Wallet },
      { to: "/payments", label: "Tahsilatlar", icon: Receipt },
      { to: "/reports", label: "Raporlar", icon: BarChart3 },
    ],
  },
  {
    title: "Sistem",
    items: [
      { to: "/trash", label: "Çöp Kutusu", icon: Trash2, adminOnly: true },
      { to: "/profil", label: "Profilim", icon: UserRound },
      { to: "/settings", label: "Ayarlar", icon: Settings },
      { to: "/account/password", label: "Şifre Değiştir", icon: KeyRound },
    ],
  },
];

const NAV_SUPER = [
  {
    title: "Yönetim",
    items: [
      { to: "/admin/tenants", label: "Firma Yönetimi", icon: Building2, end: true },
      { to: "/admin/report", label: "3D Rapor", icon: BarChart3 },
      { to: "/admin/pricing", label: "Fiyat Listesi", icon: Receipt },
      { to: "/admin/landing", label: "Vitrin İçeriği", icon: BarChart3 },
      { to: "/admin/audit-logs", label: "Denetim Kayıtları", icon: History },
      { to: "/profil", label: "Profilim", icon: UserRound },
      { to: "/account/password", label: "Şifre Değiştir", icon: KeyRound },
    ],
  },
];

// Süper Admin firma verisine erişemez (backend 403 döner); yalnızca bu sayfalara girebilir
const SUPER_ADMIN_ALLOWED = ["/settings", "/account/password", "/profil"];

function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function Layout() {
  const { user, tenant, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const groups = user?.role === "super_admin" ? NAV_SUPER : NAV_TENANT;
  const isSuper = user?.role === "super_admin";

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/service-orders?q=${encodeURIComponent(q.trim())}`);
  };

  if (isSuper && !pathname.startsWith("/admin") && !SUPER_ADMIN_ALLOWED.includes(pathname)) {
    return <Navigate to="/admin/tenants" replace />;
  }

  const visible = (item) => {
    if (item.financeOnly) return ["admin", "accountant"].includes(user?.role);
    return !item.adminOnly || user?.role === "admin" || isSuper;
  };

  return (
    <div className="emt-aurora flex min-h-screen">
      {/* Kenar çubuğu */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-300 shadow-2xl shadow-black/30 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.45)]"
            aria-hidden="true"
          >
            <Wrench className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-heading truncate text-[15px] font-bold leading-tight text-white">
              {tenant?.name || "E-Moto Tamir"}
            </div>
            <div className="truncate text-xs text-slate-400">{isSuper ? "Platform yönetimi" : "Servis yönetimi"}</div>
          </div>
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Menüyü kapat"
            data-testid="close-sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => {
            const items = group.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={group.title} className="mb-5">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {items.map((n) => (
                    <li key={n.to}>
                      <NavLink
                        to={n.to}
                        end={n.end}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) => {
                          const active = n.match ? n.match(pathname) : isActive;
                          return `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-[background-color,color] duration-150 ${
                            active
                              ? "bg-gradient-to-r from-brand-500/20 to-transparent font-medium text-white ring-1 ring-brand-500/20"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                          }`;
                        }}
                        data-testid={`nav-${n.to.replace(/\//g, "_") || "root"}`}
                      >
                        {({ isActive }) => {
                          const active = n.match ? n.match(pathname) : isActive;
                          return (
                            <>
                              {active && (
                                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-500" aria-hidden="true" />
                              )}
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${active ? "bg-brand-500 text-white shadow-[0_0_14px_rgba(249,115,22,0.5)]" : "bg-white/5 text-slate-400 group-hover:text-white"}`}>
                                <n.icon className="h-4 w-4" />
                              </span>
                              <span className="truncate">{n.label}</span>
                            </>
                          );
                        }}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="m-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-xs font-semibold text-white">
              {user?.avatar_path ? <AuthedImage path={user.avatar_path} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <Link to="/profil" className="block truncate text-sm font-medium text-white hover:underline">{user?.name}</Link>
              <div className="truncate text-xs text-slate-400">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors duration-150 hover:bg-white/5 hover:text-white"
            data-testid="btn-logout"
          >
            <LogOut className="h-4 w-4" /> Çıkış yap
          </button>
        </div>
      </aside>

      {/* Ana alan */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:px-8">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menüyü aç"
            data-testid="open-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          {!isSuper ? (
          <form onSubmit={onSearch} className="max-w-xl flex-1" role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Plaka, şasi, müşteri veya servis no ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 border-transparent bg-slate-100/80 pl-9 hover:border-transparent focus-visible:bg-white"
                data-testid="global-search"
                aria-label="Genel arama"
              />
            </div>
          </form>
          ) : (
            <div className="flex-1" />
          )}
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {user?.role === "admin" && <AdminLockButton />}
            {!isSuper && (
              <Link
                to="/service-orders/new"
                className="hidden items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-brand-600 sm:inline-flex"
                data-testid="btn-header-new-order"
              >
                <Plus className="h-4 w-4" /> Yeni iş emri
              </Link>
            )}
            <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-medium text-slate-800">{user?.name}</span>
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  {ROLE_LABELS[user?.role] || user?.role}
                </span>
              </div>
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white">
                {user?.avatar_path ? <AuthedImage path={user.avatar_path} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div key={pathname} className="mx-auto w-full max-w-[1400px] animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** Başlıktaki yönetici ikonu: kilitliyken PIN ile açar, açıkken tekrar gizler. */
function AdminLockButton() {
  const { unlocked, lock, openPin } = usePrivacy();
  const Icon = unlocked ? LockOpen : Lock;
  return (
    <button
      type="button"
      onClick={() => (unlocked ? lock() : openPin())}
      title={unlocked ? "Tutarları gizle" : "Yönetici görünümü (PIN)"}
      aria-label={unlocked ? "Tutarları gizle" : "Yönetici görünümünü aç"}
      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
        unlocked ? "border-brand-200 bg-brand-50 text-brand-600" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
      }`}
      data-testid="btn-admin-lock"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

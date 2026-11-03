import React, { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Bike, Wrench, ClipboardList, ClipboardCheck, Wallet, Receipt,
  BarChart3, Settings, LogOut, Menu, Search, X, BellRing, Building2, History, FileText,
  Trash2, KeyRound, Plus, UserRound, ArrowLeftRight, Banknote, ImagePlus, Sparkles,
} from "lucide-react";
import { Input } from "./ui/input";
import { usePrivacy } from "../context/PrivacyContext";
import { Lock, LockOpen } from "lucide-react";
import AuthedImage from "./AuthedImage";
import { moduleAllowed } from "../lib/modules";
import { useSiteAsset } from "../lib/siteAssets";

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
    ],
  },
];

const NAV_SUPER = [
  {
    title: "Yönetim",
    items: [
      { to: "/admin/tenants", label: "Firma Yönetimi", icon: Building2, end: true },
      { to: "/admin/report", label: "3D Rapor", icon: BarChart3 },
      { to: "/admin/landing", label: "Vitrin & Planlar", icon: BarChart3 },
      { to: "/admin/gorseller", label: "Görsel Yönetimi", icon: ImagePlus },
      { to: "/admin/audit-logs", label: "Denetim Kayıtları", icon: History },
      { to: "/profil", label: "Profilim", icon: UserRound },
    ],
  },
];

// Süper Admin firma verisine erişemez (backend 403 döner); yalnızca bu sayfalara girebilir
const SUPER_ADMIN_ALLOWED = ["/settings", "/profil"];

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
  const brandLogo = useSiteAsset("logo", "/visuals/emoto-logo.png");
  const promoImage = useSiteAsset("promo_rider", null);

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/service-orders?q=${encodeURIComponent(q.trim())}`);
  };

  if (isSuper && !pathname.startsWith("/admin") && !SUPER_ADMIN_ALLOWED.includes(pathname)) {
    return <Navigate to="/admin/tenants" replace />;
  }
  // Paketinde olmayan modüle doğrudan adresle girilirse panele yönlendir
  if (!isSuper && !moduleAllowed(tenant, pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  const visible = (item) => {
    if (!isSuper && !moduleAllowed(tenant, item.to)) return false;
    if (item.financeOnly) return ["admin", "accountant"].includes(user?.role);
    return !item.adminOnly || user?.role === "admin" || isSuper;
  };

  return (
    <div className="emt-aurora emt-app flex min-h-screen">
      {/* Kenar çubuğu */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-slate-950/95 text-slate-300 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="border-b border-white/10 px-4 py-4" data-testid="sidebar-brand">
          <div className="flex justify-center">
            {tenant?.logo_path ? (
              <AuthedImage path={tenant.logo_path} alt={tenant?.name || "Logo"} className="h-20 w-auto max-w-full object-contain p-1" />
            ) : (
              <img src={brandLogo} alt="E-Moto Tamir" width="1536" height="1024" className="h-20 w-auto max-w-full object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]" />
            )}
          </div>
          <div className="mt-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-heading truncate text-[15px] font-bold leading-tight text-white" data-testid="sidebar-brand-name">
                {tenant?.name || "E-Moto Tamir"}
              </div>
              <div className="truncate text-xs text-slate-400" data-testid="sidebar-brand-subtitle">
                {tenant?.subtitle || (isSuper ? "Platform yönetimi" : "Servis yönetimi")}
              </div>
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
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => {
            const items = group.items.filter(visible);
            if (!items.length) return null;
            return (
              <div key={group.title} className="mb-5">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
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
                          return `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-[background-color,color,box-shadow] duration-150 ${
                            active
                              ? "bg-orange-500 font-semibold text-white shadow-[0_10px_24px_-8px_rgba(249,115,22,0.75)]"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                          }`;
                        }}
                        data-testid={`nav-${n.to.replace(/\//g, "_") || "root"}`}
                      >
                        {({ isActive }) => {
                          const active = n.match ? n.match(pathname) : isActive;
                          return (
                            <>
                              <n.icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-white"}`} />
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

        <div className="relative mx-3 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-orange-500/20 via-slate-900 to-slate-950 p-4" data-testid="sidebar-promo">
          {promoImage && (
            <img src={promoImage} alt="" className="pointer-events-none absolute -right-3 bottom-0 h-28 w-auto object-contain opacity-90" />
          )}
          <div className="relative max-w-[70%]">
            <Sparkles className="mb-2 h-4 w-4 text-orange-400" />
            <p className="text-[13px] font-semibold leading-snug text-white">Daha güçlü bir servis deneyimi</p>
            <p className="mt-1 text-[11px] text-slate-400">Tüm servis süreçlerinizi tek panelden yönetin.</p>
          </div>
        </div>

        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link to="/profil" className="flex items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-white/5" data-testid="sidebar-profile-link">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-xs font-semibold text-white">
              {user?.avatar_path ? <AuthedImage path={user.avatar_path} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{user?.name}</span>
              <div className="truncate text-xs text-slate-400">{user?.email}</div>
            </div>
          </Link>
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-slate-950/75 px-4 backdrop-blur-xl lg:px-8">
          <button
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
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
                placeholder="Müşteri, plaka, şasi veya servis no ara…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 border-white/10 bg-white/5 pl-9 pr-14 text-slate-100 placeholder:text-slate-500 hover:border-white/20 focus-visible:bg-white/10"
                data-testid="global-search"
                aria-label="Genel arama"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">⌘K</kbd>
            </div>
          </form>
          ) : (
            <div className="flex-1" />
          )}
          <div className="ml-auto flex items-center gap-2.5">
            {user?.role === "admin" && <AdminLockButton />}
            {!isSuper && (
              <Link
                to="/service-orders/new"
                className="hidden items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(249,115,22,0.9)] transition-colors duration-150 hover:bg-orange-600 sm:inline-flex"
                data-testid="btn-header-new-order"
              >
                <Plus className="h-4 w-4" /> Yeni İş Emri
              </Link>
            )}
            {!isSuper && (
              <Link
                to="/reminders"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Bildirimler ve bakım hatırlatmaları"
                title="Bakım hatırlatmaları"
              >
                <BellRing className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-slate-950" aria-hidden="true" />
              </Link>
            )}
            <Link
              to="/profil"
              className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-1 pl-3 pr-1.5 transition-colors hover:bg-white/10 sm:flex"
              title="Profilim ve giriş bilgileri"
              data-testid="header-profile-link"
            >
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold text-white">{user?.name}</span>
                <span className="text-[11px] text-slate-400">{ROLE_LABELS[user?.role] || user?.role}</span>
              </div>
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-semibold text-white">
                {user?.avatar_path ? <AuthedImage path={user.avatar_path} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
              </span>
            </Link>
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
      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
        unlocked ? "border-orange-500/40 bg-orange-500/15 text-orange-300" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
      data-testid="btn-admin-lock"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

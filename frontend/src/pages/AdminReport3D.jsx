import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { fmtMoney, fmtDateShort } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import {
  Building2, Users, Bike, ClipboardList, TrendingUp, HandCoins, Wallet,
  Database, Server, Search, RefreshCw, AlertTriangle, CircleCheck, Activity,
} from "lucide-react";

// Sahne ve çubuk ölçüleri (px). Çubuklar bu sabitlerle konumlanır.
const PLOT_H = 200;   // en yüksek çubuğun yüksekliği
const BAR_W = 22;     // çubuk genişliği = derinliği (küp)
const SLOT = 44;      // her ayın yatay aralığı

// Yalnızca bu bileşene ait stiller. Sınıf adları "r3d-" ön ekiyle kapsamlıdır.
const CSS = `
.r3d-scene { perspective: 1000px; }
.r3d-plane {
  transform-style: preserve-3d;
  transform: rotateX(-20deg) rotateY(-28deg);
  animation: r3d-sway 14s ease-in-out infinite alternate;
}
@keyframes r3d-sway {
  0% { transform: rotateX(-20deg) rotateY(-36deg); }
  100% { transform: rotateX(-18deg) rotateY(-20deg); }
}
.r3d-bar { position: absolute; transform-style: preserve-3d; }
.r3d-face { position: absolute; left: 0; top: 0; }
.r3d-card {
  transition: transform 300ms ease, box-shadow 300ms ease;
  transform-style: preserve-3d;
}
.r3d-card:hover {
  transform: perspective(900px) rotateX(6deg) rotateY(-8deg) translateY(-4px);
  box-shadow: 0 24px 40px -16px rgb(15 23 42 / 0.35);
}
@media (prefers-reduced-motion: reduce) {
  .r3d-plane { animation: none; transform: rotateX(-20deg) rotateY(-26deg); }
  .r3d-card, .r3d-card:hover { transition: none; transform: none; }
}
`;

const MONTH_FMT = new Intl.DateTimeFormat("tr-TR", { month: "short" });
const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return ym;
  return MONTH_FMT.format(new Date(y, m - 1, 1));
};

const count = (v) => Number(v || 0).toLocaleString("tr-TR");

function TenantCard({ t }) {
  const rows = [
    ["Müşteri", count(t.customers)],
    ["Motosiklet", count(t.motorcycles)],
    ["Servis", count(t.orders)],
  ];
  return (
    <div className="r3d-card rounded-xl border border-slate-200/80 bg-white p-5 shadow-card" data-testid={`tenant-${t.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-bold text-slate-900">{t.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">Plan: {t.plan || "-"} · Bitiş: {fmtDateShort(t.ends_at)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            t.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {t.is_active ? "Aktif" : "Pasif"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 px-2 py-2">
            <dt className="text-[11px] text-slate-500">{k}</dt>
            <dd className="font-mono text-sm font-semibold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Ciro</span>
          <span className="font-mono font-medium text-slate-900">{fmtMoney(t.revenue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Alacak</span>
          <span className={`font-mono font-medium ${Number(t.receivables) > 0 ? "text-red-600" : "text-slate-900"}`}>
            {fmtMoney(t.receivables)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RevenueChart3D({ monthly }) {
  const max = Math.max(1, ...monthly.map((m) => Number(m.revenue || 0)));
  const width = monthly.length * SLOT;
  const sceneH = PLOT_H + 24; // üstte, sallanma hareketi için boşluk

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: width }}>
        <div className="r3d-scene relative" style={{ height: sceneH, width }}>
          <div className="r3d-plane absolute inset-0">
            {monthly.map((m, i) => {
              const rev = Number(m.revenue || 0);
              const h = Math.max(2, (rev / max) * PLOT_H);
              const left = i * SLOT + (SLOT - BAR_W) / 2;
              const tip = `${monthLabel(m.month)}: ${fmtMoney(rev)}`;
              const W = BAR_W;
              const H = h;
              return (
                <div
                  key={m.month}
                  className="r3d-bar"
                  style={{ left, top: sceneH - H, width: W, height: H }}
                  data-testid={`bar-${m.month}`}
                >
                  {/* ön yüz */}
                  <div
                    className="r3d-face rounded-t-[2px]"
                    title={tip}
                    style={{
                      width: W, height: H,
                      transform: `translateZ(${W / 2}px)`,
                      background: "linear-gradient(180deg, #fb923c 0%, #ea580c 100%)",
                    }}
                  />
                  {/* üst yüz */}
                  <div
                    className="r3d-face"
                    title={tip}
                    style={{
                      width: W, height: W,
                      top: (H - W) / 2,
                      transform: `rotateX(90deg) translateZ(${H / 2}px)`,
                      background: "linear-gradient(135deg, #fed7aa, #fdba74)",
                    }}
                  />
                  {/* sağ yan yüz */}
                  <div
                    className="r3d-face"
                    title={tip}
                    style={{
                      width: W, height: H,
                      transform: `rotateY(90deg) translateZ(${W / 2}px)`,
                      background: "linear-gradient(180deg, #c2410c 0%, #7c2d12 100%)",
                    }}
                  />
                  {/* sol yan yüz */}
                  <div
                    className="r3d-face"
                    title={tip}
                    style={{
                      width: W, height: H,
                      transform: `rotateY(-90deg) translateZ(${W / 2}px)`,
                      background: "linear-gradient(180deg, #9a3412 0%, #431407 100%)",
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* zemin çizgisi */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-slate-300" />
        </div>
        <div className="flex">
          {monthly.map((m) => (
            <div key={m.month} className="shrink-0 text-center text-[11px] text-slate-500" style={{ width: SLOT }}>
              {monthLabel(m.month)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminReport3D() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await api.get("/admin/overview");
      setData(r.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const customers = data?.customers || [];
  const filteredCustomers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.tenant].some((v) => String(v || "").toLowerCase().includes(needle))
    );
  }, [customers, q]);

  const actions = (
    <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="report-refresh">
      <RefreshCw className={loading ? "animate-spin" : ""} />
      Yenile
    </Button>
  );

  const header = (
    <PageHeader eyebrow="Süper Admin" title="3D Genel Rapor" description="Tüm firmalar, müşteriler ve sistem durumu" actions={actions} />
  );

  if (!data && loading) {
    return (
      <div>
        {header}
        <p className="text-sm text-slate-500">Rapor yükleniyor…</p>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Rapor yüklenemedi"
            description="Bağlantınızı kontrol edip tekrar deneyin."
            action={<Button variant="outline" size="sm" onClick={load}>Tekrar dene</Button>}
          />
        </Card>
      </div>
    );
  }

  const t = data?.totals || {};
  const tenants = data?.tenants || [];
  const monthly = data?.monthly || [];
  const sys = data?.system || {};

  const totalCards = [
    { icon: Building2, label: "Firma", value: count(t.tenants), hint: "Tüm kayıtlı firmalar", tone: "brand" },
    { icon: CircleCheck, label: "Aktif firma", value: count(t.active_tenants), hint: "Şu an aktif", tone: "emerald" },
    { icon: Users, label: "Müşteri", value: count(t.customers), tone: "sky" },
    { icon: Bike, label: "Motosiklet", value: count(t.motorcycles), tone: "slate" },
    { icon: ClipboardList, label: "Servis kaydı", value: count(t.orders), tone: "slate" },
    { icon: TrendingUp, label: "Toplam ciro", value: fmtMoney(t.revenue), tone: "sky" },
    { icon: HandCoins, label: "Tahsil edilen", value: fmtMoney(t.collected), tone: "emerald" },
    { icon: Wallet, label: "Toplam alacak", value: fmtMoney(t.receivables), tone: "red" },
  ];

  return (
    <div className="space-y-8" data-testid="admin-report-3d">
      <style>{CSS}</style>
      {header}

      {/* 1) Toplamlar */}
      <section aria-label="Toplamlar" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {totalCards.map((c) => (
          <div key={c.label} className="r3d-card rounded-xl">
            <StatCard icon={c.icon} label={c.label} value={c.value} hint={c.hint} tone={c.tone} />
          </div>
        ))}
      </section>

      {/* 2) Aylık ciro: 3D çubuk grafik */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Aylık ciro</CardTitle>
          <CardDescription>Son 12 ay · çubuk yüksekliği ciroya göre oranlanır · üzerine gelince tutar görünür</CardDescription>
        </CardHeader>
        <CardContent>
          {monthly.length ? (
            <RevenueChart3D monthly={monthly} />
          ) : (
            <EmptyState title="Henüz ciro verisi yok" description="Tamamlanan servisler burada görünür." />
          )}
        </CardContent>
      </Card>

      {/* 3) Firmalar */}
      <section aria-label="Firmalar" className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-900">Firmalar</h2>
          <p className="text-sm text-slate-500">{tenants.length} firma</p>
        </div>
        {tenants.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tenants.map((tn) => (
              <TenantCard key={tn.id} t={tn} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState title="Kayıtlı firma yok" />
          </Card>
        )}
      </section>

      {/* 4) Müşteriler */}
      <Card className="overflow-hidden">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">Müşteriler</CardTitle>
            <CardDescription>
              {filteredCustomers.length} / {customers.length} müşteri gösteriliyor
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ad, telefon veya firma ara"
              className="pl-9"
              aria-label="Müşteri ara"
              data-testid="customers-search"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCustomers.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead className="text-right">Bakiye</TableHead>
                    <TableHead>Kayıt tarihi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((c) => {
                    const balance = Number(c.balance || 0);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                        <TableCell className="font-mono text-slate-600">{c.phone || "-"}</TableCell>
                        <TableCell className="text-slate-600">{c.tenant || "-"}</TableCell>
                        <TableCell className={`text-right font-mono font-medium tabular-nums ${balance > 0 ? "text-red-600" : "text-slate-900"}`}>
                          {fmtMoney(balance)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">{fmtDateShort(c.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={customers.length ? "Eşleşen müşteri yok" : "Henüz müşteri yok"}
              description={customers.length ? "Arama metnini değiştirmeyi deneyin." : undefined}
              className="py-10"
            />
          )}
        </CardContent>
      </Card>

      {/* 5) Sistem */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-brand-600" />
            Sistem bilgisi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {[
              [Database, "Veritabanı", sys.database || "-"],
              [Database, "Veritabanı adı", sys.db_name || "-"],
              [Activity, "Sunucu zamanı", sys.server_time ? new Date(sys.server_time).toLocaleString("tr-TR") : "-"],
              [Users, "Kullanıcı", count(sys.users)],
              [Database, "Dosya", count(sys.files)],
              [ClipboardList, "Denetim kaydı", count(sys.audit_entries)],
            ].map(([Icon, k, v]) => (
              <div key={k} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-card">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="truncate font-mono font-semibold text-slate-900">{v}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

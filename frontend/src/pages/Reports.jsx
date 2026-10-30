import React, { useEffect, useMemo, useState } from "react";
import api, { fmtMoney, STATUS_META } from "../lib/api";
import { useLayout } from "../lib/layoutPrefs";
import { usePrivacy } from "../context/PrivacyContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download, Wallet, Receipt, Percent, Gauge, TrendingUp, Wrench, Package, Users, Boxes, BarChart3 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import AnimatedMotorcycleSVG from "../components/AnimatedMotorcycleSVG";
import Money from "../components/Money";
import DashboardDebtorsTable from "../components/DashboardDebtorsTable";
import { DashboardSection, SectionsPanel } from "../components/DashboardLayout";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import {
  KpiTile, ChartPanel, LockedChart, Donut, TrendArea, Bar, RankBadge, Initials, GlassTooltip,
  AXIS_TICK, GRID_STROKE, PALETTE, compact, monthLabel,
} from "../components/reports/ReportKit";

function toCSV(rows, headers) {
  const head = headers.map((h) => h.label).join(",");
  const body = rows.map((r) => headers.map((h) => `"${String(r[h.key] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  return head + "\n" + body;
}

const download = (name, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const exportCsv = (name, rows, headers) => () => {
  download(name, toCSV(rows, headers));
  toast.success("İndirildi");
};

// Düzen anahtarı v2: yeni bölümler eklendi, eski kayıtlı sıra sıfırlanır.
const LAYOUT_KEY = "report.layout.v2";
const SECTIONS = [
  { id: "kpi", label: "Özet göstergeler", span: "full" },
  { id: "trend", label: "Ciro ve tahsilat trendi (12 ay)", span: "wide" },
  { id: "status", label: "Servis durum dağılımı", span: "narrow" },
  { id: "composition", label: "Ciro bileşimi (aylık)", span: "wide" },
  { id: "payments", label: "Tahsilat yöntemleri", span: "narrow" },
  { id: "profit", label: "Kâr ve zarar", span: "narrow" },
  { id: "customers", label: "En Çok Servis Kullanan Müşteriler", span: "wide" },
  { id: "services", label: "En Çok Yapılan Hizmetler", span: "wide" },
  { id: "parts", label: "En Çok Kullanılan Parçalar", span: "narrow" },
  { id: "stock", label: "Kritik Stok", span: "wide" },
  { id: "debtors", label: "Borçlu Müşteriler", span: "narrow" },
];
const DEFAULT_IDS = SECTIONS.map((s) => s.id);
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

const PAYMENT_LABELS = { cash: "Nakit", card: "Kart", transfer: "Havale", other: "Diğer", nakit: "Nakit", kart: "Kart", havale: "Havale", "çek": "Çek", "diğer": "Diğer" };

const PROFIT_ROWS = [
  { label: "Parça geliri", key: "parts_revenue" },
  { label: "Parça maliyeti", key: "parts_cost" },
  { label: "Parça marjı", key: "parts_margin" },
  { label: "Hizmet geliri", key: "services_revenue" },
  { label: "İşçilik geliri", key: "labor_revenue" },
];

/** Tablo kartı: başlık, CSV indirme ve yatay kaydırmalı içerik. */
function TableCard({ title, description, onExport, footer, children }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-slate-200/70 dark:border-white/10">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" />CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
      {footer && <div className="border-t border-slate-100 px-4 py-2.5 text-sm dark:border-white/10">{footer}</div>}
    </Card>
  );
}

function RankTable({ columns, rows, rowKey, renderRow, empty = "Kayıt yok" }) {
  return (
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
        <tr>
          {columns.map((c) => (
            <th key={c.label} className={`px-4 py-2.5 font-semibold ${c.right ? "text-right" : "text-left"}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr>
        ) : (
          rows.map((row, i) => (
            <tr key={rowKey(row)} className="border-t border-slate-100 transition-colors hover:bg-brand-50/40 dark:border-white/5 dark:hover:bg-white/[0.03]">
              {renderRow(row, i)}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default function Reports() {
  const { unlocked } = usePrivacy();
  const [r, setR] = useState(null);
  const [showAllStock, setShowAllStock] = useState(false);
  const { order, visible, hidden, toggle, reset, dnd } = useLayout(LAYOUT_KEY, DEFAULT_IDS);

  // Kilit açılıp kapanınca tutarlar yeniden alınır (sunucu parasal alanları gizlerse null gelir).
  useEffect(() => {
    let active = true;
    api.get("/reports/summary")
      .then((x) => { if (active) setR(x.data); })
      .catch(() => toast.error("Rapor verileri yüklenemedi"));
    return () => { active = false; };
  }, [unlocked]);

  const A = r?.analytics;
  const locked = !!r?.masked;

  const trend = useMemo(() => (A?.monthly || []).map((m) => ({ ...m, label: monthLabel(m.month) })), [A]);
  const sparkRev = trend.map((m) => ({ v: m.revenue }));
  const sparkCol = trend.map((m) => ({ v: m.collected }));
  const statusData = useMemo(() => (A?.status_distribution || []).map((s, i) => ({
    name: STATUS_META[s.status]?.label || s.status, value: s.count, color: PALETTE[i % PALETTE.length],
  })), [A]);
  const methodData = useMemo(() => (A?.payment_methods || []).map((m, i) => ({
    name: PAYMENT_LABELS[m.method] || m.method, value: m.amount ?? 0, count: m.count, color: PALETTE[i % PALETTE.length],
  })), [A]);

  if (!r) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  const pl = r.profit_loss;
  const topCustMax = Math.max(0, ...r.top_customers.map((c) => c.spent || 0));
  const topSvcMax = Math.max(0, ...r.top_services.map((s) => s.revenue || 0));
  const topPartMax = Math.max(0, ...r.top_parts.map((p) => p.qty || 0));
  const collectionPct = A?.kpis?.collection_rate ?? 0;
  const bestMonth = trend.reduce((b, m) => (m.revenue > (b?.revenue || 0) ? m : b), null);

  const bodies = {
    kpi: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile testId="kpi-revenue" label="Toplam ciro" icon={Wallet} tone="orange" value={<Money value={r.totals.total_revenue} />} hint={`${r.totals.orders_count} servis kaydı`} spark={sparkRev} sparkKey="v" />
        <KpiTile testId="kpi-collected" label="Toplam tahsilat" icon={TrendingUp} tone="cyan" value={<Money value={r.totals.total_collected} />} hint={`Tahsilat oranı %${collectionPct}`} spark={sparkCol} sparkKey="v" />
        <KpiTile testId="kpi-receivable" label="Alacak" icon={Receipt} tone="red" value={<Money value={r.totals.receivables} />} hint={`${A?.kpis?.debtor_count ?? 0} borçlu müşteri`} />
        <KpiTile testId="kpi-avg" label="Ortalama fiş" icon={Gauge} tone="violet" value={<Money value={A?.kpis?.avg_ticket} />} hint={`${A?.kpis?.open_orders ?? 0} açık iş emri`} />
        <KpiTile testId="kpi-rate" label="Tahsilat oranı" icon={Percent} tone="emerald" value={`%${collectionPct}`} hint="Toplam ciroya göre" />
      </div>
    ),

    trend: (
      <ChartPanel
        title="Ciro ve tahsilat"
        description="Son 12 ay, servis açılış tarihine göre"
        footer={bestMonth && bestMonth.revenue > 0 ? <>En yüksek ciro: <strong>{monthLabel(bestMonth.month)}</strong> · {locked ? "gizli" : fmtMoney(bestMonth.revenue)}</> : "Henüz ciro kaydı yok"}
        actions={<span className="flex items-center gap-3 text-xs text-slate-500"><i className="h-2 w-2 rounded-full bg-orange-500" />Ciro<i className="h-2 w-2 rounded-full bg-cyan-400" />Tahsilat</span>}
      >
        {locked ? <LockedChart /> : <TrendArea data={trend} />}
      </ChartPanel>
    ),

    status: (
      <ChartPanel title="Servis durumu" description="Tüm kayıtlar (iptaller hariç)">
        {statusData.length ? (
          <>
            <Donut data={statusData} centerLabel="Toplam" centerValue={statusData.reduce((a, b) => a + b.value, 0)} />
            <ul className="space-y-2">
              {statusData.map((s) => (
                <li key={s.name} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300"><i className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                    <span className="font-semibold tabular-nums">{s.value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="py-10 text-center text-sm text-slate-500">Veri yok</p>}
      </ChartPanel>
    ),

    composition: (
      <ChartPanel title="Ciro bileşimi" description="Parça, hizmet ve işçilik (aylık, brüt tutar)">
        {locked ? <LockedChart /> : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <RBar dataKey="parts_revenue" name="Parça" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                <RBar dataKey="services_revenue" name="Hizmet" stackId="a" fill="#22d3ee" />
                <RBar dataKey="labor_revenue" name="İşçilik" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartPanel>
    ),

    payments: (
      <ChartPanel title="Tahsilat yöntemleri" description="Ödeme tipine göre toplam">
        {locked ? <LockedChart height={200} /> : methodData.length ? (
          <>
            <Donut data={methodData} centerLabel="Tahsilat" centerValue={compact(r.totals.total_collected)} />
            <ul className="space-y-2">
              {methodData.map((m) => (
                <li key={m.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />{m.name} <span className="text-xs text-slate-400">({m.count})</span></span>
                    <span className="font-medium"><Money value={m.value} /></span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="py-10 text-center text-sm text-slate-500">Tahsilat kaydı yok</p>}
      </ChartPanel>
    ),

    profit: (
      <ChartPanel title="Kâr ve zarar" description="Brüt kâr hesabı">
        <dl className="divide-y divide-slate-100 text-sm dark:divide-white/10">
          {PROFIT_ROWS.map((row) => {
            const v = pl[row.key] ?? 0;
            const max = Math.max(Math.abs(pl.parts_revenue || 0), Math.abs(pl.services_revenue || 0), Math.abs(pl.labor_revenue || 0), 1);
            return (
              <div key={row.key} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600 dark:text-slate-300">{row.label}</dt>
                  <dd className="font-medium"><Money value={pl[row.key]} /></dd>
                </div>
                {!locked && <div className="mt-1.5"><Bar value={Math.abs(v)} max={max} color={row.key.includes("cost") ? "#ef4444" : "#10b981"} /></div>}
              </div>
            );
          })}
        </dl>
        <div className="mt-auto rounded-lg bg-gradient-to-br from-brand-50 to-cyan-50 p-4 dark:from-white/5 dark:to-white/[0.03]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Brüt kâr</p>
          <p className="font-heading mt-1 text-2xl font-bold text-slate-900 dark:text-white"><Money value={pl.gross_profit} /></p>
        </div>
      </ChartPanel>
    ),

    customers: (
      <TableCard
        title="En Çok Servis Kullanan Müşteriler"
        description="Harcamaya göre ilk 10"
        onExport={exportCsv("musteri_raporu.csv", r.top_customers, [
          { key: "customer_name", label: "Müşteri" }, { key: "count", label: "Servis" }, { key: "spent", label: "Harcama" },
        ])}
      >
        <RankTable
          columns={[{ label: "#" }, { label: "Müşteri" }, { label: "Servis", right: true }, { label: "Harcama", right: true }]}
          rows={r.top_customers}
          rowKey={(c) => c.customer_id}
          renderRow={(c, i) => (
            <>
              <td className="px-4 py-3"><RankBadge n={i + 1} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Initials name={c.customer_name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.customer_name}</p>
                    {!locked && <div className="mt-1 w-32"><Bar value={c.spent} max={topCustMax} /></div>}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{c.count}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums"><Money value={c.spent} /></td>
            </>
          )}
        />
      </TableCard>
    ),

    services: (
      <TableCard
        title="En Çok Yapılan Hizmetler"
        description="Ciroya göre ilk 10"
        onExport={exportCsv("hizmet_raporu.csv", r.top_services, [
          { key: "name", label: "Hizmet" }, { key: "count", label: "Adet" }, { key: "revenue", label: "Ciro" },
        ])}
      >
        <RankTable
          columns={[{ label: "#" }, { label: "Hizmet" }, { label: "Adet", right: true }, { label: "Ciro", right: true }]}
          rows={r.top_services}
          rowKey={(s) => s.name}
          renderRow={(s, i) => (
            <>
              <td className="px-4 py-3"><RankBadge n={i + 1} /></td>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                {!locked && <div className="mt-1 w-40"><Bar value={s.revenue} max={topSvcMax} color="#22d3ee" /></div>}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{s.count}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums"><Money value={s.revenue} /></td>
            </>
          )}
        />
      </TableCard>
    ),

    parts: (
      <TableCard
        title="En Çok Kullanılan Parçalar"
        description="Adede göre ilk 10"
        onExport={exportCsv("parca_raporu.csv", r.top_parts, [
          { key: "name", label: "Parça" }, { key: "qty", label: "Adet" }, { key: "revenue", label: "Ciro" },
        ])}
      >
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {r.top_parts.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Kayıt yok</li>}
          {r.top_parts.map((p, i) => (
            <li key={p.name} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"><Package className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <span className="text-sm font-semibold tabular-nums">{p.qty}</span>
                </div>
                <div className="mt-1.5"><Bar value={p.qty} max={topPartMax} color={PALETTE[i % PALETTE.length]} /></div>
              </div>
            </li>
          ))}
        </ul>
      </TableCard>
    ),

    stock: (
      <TableCard
        title="Kritik Stok"
        description={`Stok, minimum seviyenin altında veya eşitinde · ${r.critical_stock.length} ürün`}
        footer={r.critical_stock.length > 8 ? (
          <button type="button" className="font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setShowAllStock((v) => !v)}>
            {showAllStock ? "Daha az göster" : `Tümünü göster (${r.critical_stock.length})`}
          </button>
        ) : null}
      >
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {r.critical_stock.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Tüm stoklar iyi durumda</li>}
          {(showAllStock ? r.critical_stock : r.critical_stock.slice(0, 8)).map((p) => {
            const pct = p.min_stock > 0 ? Math.min(100, Math.round((p.stock / p.min_stock) * 100)) : 0;
            return (
              <li key={p.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium"><span className="mr-2 font-mono text-xs text-slate-400">{p.code}</span>{p.name}</p>
                  <div className="mt-1.5"><Bar value={pct} max={100} color="#ef4444" /></div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="text-base font-bold text-red-600 tabular-nums">{p.stock}</p>
                  <p className="text-slate-500">min {p.min_stock}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </TableCard>
    ),

    debtors: (
      <TableCard title="Borçlu Müşteriler" description="Kalan borcu olan servis kayıtları">
        <DashboardDebtorsTable debtors={r.debtors} />
      </TableCard>
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        art={<AnimatedMotorcycleSVG type="touring" height="100%" />}
        visual={<PageVisual icon={BarChart3} />}
        title="Raporlar"
        description="Ciro, tahsilat, servis durumu ve stok özetleri. Bölümleri sürükleyerek düzenleyebilirsiniz."
        actions={
          <SectionsPanel sections={order.map((id) => SECTION_BY_ID[id])} hidden={hidden} onToggle={toggle} onReset={reset} />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {visible.map((id) => (
          <DashboardSection key={id} id={id} label={SECTION_BY_ID[id].label} span={SECTION_BY_ID[id].span} dnd={dnd}>
            {bodies[id]}
          </DashboardSection>
        ))}
      </div>
    </div>
  );
}

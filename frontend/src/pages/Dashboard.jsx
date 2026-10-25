import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort, STATUS_META } from "../lib/api";
import { useLayout } from "../lib/layoutPrefs";
import { usePrivacy } from "../context/PrivacyContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import Money from "../components/Money";
import DashboardDebtorsTable from "../components/DashboardDebtorsTable";
import { DashboardSection, SectionsPanel } from "../components/DashboardLayout";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  Wrench, ClipboardList, PackageCheck, Truck, Wallet, TrendingUp, HandCoins,
  AlertTriangle, MessageCircle, RefreshCw, CircleCheck, BellRing, Lock,
} from "lucide-react";
import { toast } from "sonner";

const FALLBACK_BRAND = "#F97316";
const FALLBACK_STATUS = "#94A3B8";
const GRID_STROKE = "#E2E8F0";
const AXIS_TICK = { fontSize: 11, fill: "#64748B" };

// Durum renkleri: her durum kendi anlamını taşır (grafik ve açıklama listesinde aynı renk).
const STATUS_HEX = {
  new: "#2563EB",
  diagnosed: "#4F46E5",
  pricing: "#64748B",
  awaiting_approval: "#CA8A04",
  approved: "#0D9488",
  in_repair: "#EA580C",
  parts_waiting: "#D97706",
  completed: "#059669",
  awaiting_delivery: "#0891B2",
  delivered: "#15803D",
  cancelled: "#DC2626",
};
const statusColor = (s) => STATUS_HEX[s] || FALLBACK_STATUS;

// Grafik çizgileri firma temasını izlesin diye CSS değişkeninden okunur.
function readBrandHex() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--brand-primary").trim();
    return v || FALLBACK_BRAND;
  } catch {
    return FALLBACK_BRAND;
  }
}

const compact = (v) => new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const LAYOUT_KEY = "dash.layout.v1";
const SECTIONS = [
  { id: "kpi", label: "Özet göstergeler", span: "full" },
  { id: "reminders", label: "Bugünkü bakım hatırlatmaları", span: "full" },
  { id: "revenue", label: "Aylık ciro", span: "wide" },
  { id: "status", label: "Servis durumu", span: "narrow" },
  { id: "recent", label: "Son servis kayıtları", span: "wide" },
  { id: "operations", label: "En çok yapılan işlemler", span: "narrow" },
  { id: "debtors", label: "Borçlu müşteriler", span: "wide" },
];
const DEFAULT_IDS = SECTIONS.map((s) => s.id);
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export default function Dashboard() {
  const { unlocked, openPin } = usePrivacy();
  const [data, setData] = useState(null);
  const [digest, setDigest] = useState(null);
  const [regen, setRegen] = useState(false);
  const { order, visible, hidden, toggle, reset, dnd } = useLayout(LAYOUT_KEY, DEFAULT_IDS);
  const brand = useMemo(readBrandHex, []);

  // Kilit açılıp kapanınca tutarlar yeniden alınır (sunucu parasal alanları gizlerse null gelir).
  useEffect(() => {
    let active = true;
    api.get("/dashboard")
      .then((r) => { if (active) setData(r.data); })
      .catch(() => toast.error("Dashboard verileri yüklenemedi"));
    return () => { active = false; };
  }, [unlocked]);

  useEffect(() => {
    api.get("/dashboard/reminders-today").then((r) => setDigest(r.data)).catch(() => {});
  }, []);

  const regenerate = async () => {
    setRegen(true);
    try {
      const r = await api.post("/dashboard/reminders-today/regenerate");
      setDigest(r.data);
      toast.success(`${r.data.due_count} hatırlatma güncellendi`);
    } catch {
      toast.error("Yenileme başarısız");
    } finally {
      setRegen(false);
    }
  };

  const openAll = () => {
    (digest?.links || []).forEach((l, i) => setTimeout(() => window.open(l.url, "_blank"), i * 300));
  };

  if (!data) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  const { kpi, monthly_revenue, status_distribution, top_operations, recent_orders, debtors } = data;
  const links = digest?.links || [];

  const bodies = {
    kpi: (
      <section aria-label="Özet göstergeler" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wrench} label="Bugünkü servis" value={kpi.today_services} testId="kpi-today" />
        <StatCard icon={ClipboardList} label="Açık servisler" value={kpi.open_services} tone="slate" testId="kpi-open" />
        <StatCard icon={PackageCheck} label="Tamamlanan" value={kpi.completed_services} tone="emerald" testId="kpi-completed" />
        <StatCard icon={Truck} label="Teslim bekliyor" value={kpi.awaiting_delivery} tone="amber" testId="kpi-awaiting" />
        <StatCard icon={HandCoins} label="Bugünkü tahsilat" value={<Money value={kpi.today_collection} />} tone="emerald" testId="kpi-today-collection" />
        <StatCard icon={TrendingUp} label="Bu ay ciro" value={<Money value={kpi.month_revenue} />} tone="sky" testId="kpi-month-revenue" />
        <StatCard icon={Wallet} label="Toplam alacak" value={<Money value={kpi.total_receivables} />} tone="red" testId="kpi-receivables" />
        <StatCard icon={AlertTriangle} label="Borçlu servis" value={kpi.unpaid_count} tone="amber" testId="kpi-unpaid" />
      </section>
    ),

    reminders: (
      <Card className="flex-1 border-brand-200" data-testid="reminders-widget">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <BellRing className="h-4 w-4 text-brand-600" />
              Bugünkü bakım hatırlatmaları
              {digest && <Badge variant="brand">{digest.due_count}</Badge>}
            </CardTitle>
            <CardDescription className="mt-1">
              {digest?.generated_at
                ? `Her sabah 09:00'da otomatik oluşturulur · Son güncelleme: ${new Date(digest.generated_at).toLocaleString("tr-TR")}`
                : "Henüz oluşturulmadı. 'Yenile' ile hemen hazırlayabilirsiniz."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regen} data-testid="reminders-widget-refresh">
              <RefreshCw className={regen ? "animate-spin" : ""} />
              Yenile
            </Button>
            {links.length > 0 && (
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={openAll}
                data-testid="reminders-widget-open-all"
              >
                <MessageCircle />
                Tümünü aç ({links.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {digest?.skipped_no_phone > 0 && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {digest.skipped_no_phone} müşteri telefon bilgisi eksik olduğu için atlandı.
            </p>
          )}
          {links.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Bugün bakım hatırlatması yok"
              description="Bakım zamanı gelen müşteri olduğunda burada listelenir."
              className="py-8"
            />
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
              <Table>
                <TableBody>
                  {links.map((l) => (
                    <TableRow key={l.motorcycle_id} data-testid={`widget-link-${l.motorcycle_id}`}>
                      <TableCell className="w-1/3">
                        <div className="font-medium text-slate-900">{l.name}</div>
                        <div className="font-mono text-xs text-slate-500">{l.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-slate-700">
                          {l.brand_model} · <span className="font-mono">{l.plate}</span>
                        </div>
                        <div className="mt-1 flex gap-1">
                          {l.km_over && <Badge variant="destructive">KM+</Badge>}
                          {l.date_over && <Badge variant="destructive">Tarih</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 transition-colors duration-150 hover:text-emerald-800"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    ),

    revenue: (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">Aylık ciro</CardTitle>
          <CardDescription>Son 12 ay</CardDescription>
        </CardHeader>
        <CardContent>
          {!unlocked ? (
            <EmptyState
              icon={Lock}
              title="Ciro grafiği gizli"
              description="Tutarları görmek için kilidi açın."
              action={<Button variant="outline" size="sm" onClick={openPin}>Kilidi aç</Button>}
            />
          ) : monthly_revenue?.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={monthly_revenue} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={brand}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: brand, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Henüz ciro verisi yok" description="Tamamlanan servisler burada grafik olarak görünür." />
          )}
        </CardContent>
      </Card>
    ),

    status: (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">Servis durumu</CardTitle>
          <CardDescription>Tüm kayıtlar</CardDescription>
        </CardHeader>
        <CardContent>
          {status_distribution?.length ? (
            <>
              <div className="h-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={status_distribution}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={84}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {status_distribution.map((s) => (
                        <Cell key={s.status} fill={statusColor(s.status)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, STATUS_META[n]?.label || n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2">
                {status_distribution.map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: statusColor(s.status) }} />
                      {STATUS_META[s.status]?.label || s.status}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">{s.count}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState title="Servis kaydı yok" description="İlk iş emrinizi oluşturduğunuzda dağılım burada görünür." />
          )}
        </CardContent>
      </Card>
    ),

    recent: (
      <Card className="flex-1 overflow-hidden">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Son servis kayıtları</CardTitle>
          <Link to="/service-orders" className="text-xs font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700 hover:underline">
            Tümünü gör →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent_orders?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Servis no</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Plaka</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent_orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link to={`/service-orders/${o.id}`} className="font-mono font-medium text-slate-900 hover:text-brand-600 hover:underline">
                          {o.service_no}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-600">{fmtDateShort(o.created_at)}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell className="font-mono">{o.plate}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right">
                        <Money value={o.grand_total} className="font-medium" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={Wrench} title="Henüz servis kaydı yok" description="Yeni iş emri oluşturarak başlayın." className="py-12" />
          )}
        </CardContent>
      </Card>
    ),

    operations: (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">En çok yapılan işlemler</CardTitle>
        </CardHeader>
        <CardContent>
          {top_operations?.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={top_operations} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0F172A" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Henüz işlem yok" description="Servislerde yapılan işlemler burada sıralanır." />
          )}
        </CardContent>
      </Card>
    ),

    debtors: (
      <Card className="flex-1 overflow-hidden" data-testid="debtors-widget">
        <CardHeader>
          <CardTitle className="text-base">Borçlu müşteriler</CardTitle>
          <CardDescription>Bakiyesi açık olan müşteriler</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DashboardDebtorsTable debtors={debtors} />
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="space-y-8" data-testid="dashboard">
      <PageHeader
        eyebrow="Genel bakış"
        title="Dashboard"
        description="Servis operasyonunun anlık durumu"
        actions={
          <>
            <SectionsPanel
              sections={order.map((id) => SECTION_BY_ID[id])}
              hidden={hidden}
              onToggle={toggle}
              onReset={reset}
            />
            <Button asChild data-testid="btn-new-service-order">
              <Link to="/service-orders/new">
                <ClipboardList />
                Yeni Servis Kaydı
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {visible.map((id) => (
          <DashboardSection
            key={id}
            id={id}
            label={SECTION_BY_ID[id].label}
            span={SECTION_BY_ID[id].span}
            dnd={dnd}
          >
            {bodies[id]}
          </DashboardSection>
        ))}
      </div>
    </div>
  );
}

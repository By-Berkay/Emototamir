import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort, STATUS_META } from "../lib/api";
import { useLayout } from "../lib/layoutPrefs";
import { usePrivacy } from "../context/PrivacyContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import Money from "../components/Money";
import { DashboardSection, SectionsPanel } from "../components/DashboardLayout";
import { HeroBanner, KpiCard, Panel, StatusBadge, DataTable } from "../components/design/kit";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  Wrench, ClipboardList, PackageCheck, TrendingUp, HandCoins, Wallet, BellRing,
  RefreshCw, MessageCircle, AlertTriangle, CircleCheck, Lock,
} from "lucide-react";
import { toast } from "sonner";

const ORANGE = "#f97316";
const BLUE = "#38bdf8";
const FALLBACK_STATUS = "#94A3B8";
const GRID_STROKE = "rgba(148,163,184,0.18)";
const AXIS_TICK = { fontSize: 11, fill: "#94A3B8" };

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
const statusLabel = (s) => STATUS_META[s]?.label || s;

// Durum rozetinin tonu (kit StatusBadge tonlarından biri).
const STATUS_TONE = {
  new: "info",
  diagnosed: "info",
  pricing: "neutral",
  awaiting_approval: "warning",
  approved: "brand",
  in_repair: "brand",
  parts_waiting: "warning",
  completed: "success",
  awaiting_delivery: "violet",
  delivered: "success",
  cancelled: "danger",
};

const compact = (v) => new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const monthLabel = (k) => {
  if (!k) return "";
  const [y, m] = String(k).split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("tr-TR", { month: "short" });
};

// Bakım hatırlatması için göreli tarih metni (gün sayısı sunucudan gelir).
const dueText = (days) => {
  if (days === null || days === undefined) return "Tarih bilgisi yok";
  if (days < 0) return `${-days} gün gecikti`;
  if (days === 0) return "Bugün";
  return `${days} gün kaldı`;
};

const LAYOUT_KEY = "dash.layout.v1";
const SECTIONS = [
  { id: "kpi", label: "Özet göstergeler", span: "full" },
  { id: "revenue", label: "Ciro trendi", span: "wide" },
  { id: "status", label: "Servis durumu", span: "narrow" },
  { id: "reminders", label: "Bakım hatırlatmaları", span: "narrow" },
  { id: "recent", label: "Son servis kayıtları", span: "wide" },
  { id: "debtors", label: "Cari hesap özeti", span: "narrow" },
  { id: "operations", label: "Operasyon", span: "wide" },
];
const DEFAULT_IDS = SECTIONS.map((s) => s.id);
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

// Koyu tema tooltip'i. Recharts içeriği props olarak geçirir.
function DarkTip({ active, payload, label, money = false, labelOf }) {
  if (!active || !payload?.length) return null;
  const head = labelOf ? labelOf(label ?? payload[0].name) : (label ?? payload[0].name);
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <p className="mb-1 font-semibold text-slate-300">{head}</p>
      {payload.map((x) => (
        <p key={x.dataKey || x.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: x.color || x.fill }} />
          <span className="text-slate-400">{labelOf && x.name === payload[0].name ? labelOf(x.name) : x.name}</span>
          <span className="ml-auto font-semibold tabular-nums">{money ? fmtMoney(x.value) : x.value}</span>
        </p>
      ))}
    </div>
  );
}

// Koyu tema boş durum (ortak EmptyState açık renk kullandığı için burada tanımlı).
function Empty({ icon: Icon, title, desc, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}>
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="font-heading text-sm font-semibold text-white">{title}</p>
      {desc && <p className="mt-1 max-w-xs text-xs text-slate-400">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { unlocked, openPin } = usePrivacy();
  const { user, tenant } = useAuth();
  const [data, setData] = useState(null);
  const [digest, setDigest] = useState(null);
  const [regen, setRegen] = useState(false);
  const { order, visible, hidden, toggle, reset, dnd } = useLayout(LAYOUT_KEY, DEFAULT_IDS);

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

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-testid="dashboard-loading">
        <div className="emt-glass-dark flex items-center gap-3 rounded-2xl border border-white/10 px-5 py-4 text-sm text-slate-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden="true" />
          Panel hazırlanıyor
        </div>
      </div>
    );
  }

  const { kpi, monthly_revenue, status_distribution, top_operations, recent_orders, debtors } = data;
  const links = digest?.links || [];
  const firstName = user?.name ? String(user.name).trim().split(/\s+/)[0] : "";
  const statusTotal = (status_distribution || []).reduce((s, x) => s + (x.count || 0), 0);

  // Ciro serisine, veriden türetilmiş 3 aylık hareketli ortalama eklenir (ikinci seri).
  const trend = (monthly_revenue || []).map((m, i, arr) => {
    const win = arr.slice(Math.max(0, i - 2), i + 1);
    const avg = win.reduce((s, x) => s + (Number(x.revenue) || 0), 0) / win.length;
    return { month: m.month, revenue: Number(m.revenue) || 0, avg: Math.round(avg * 100) / 100 };
  });
  const sparkRevenue = unlocked && trend.length ? trend.map((t) => t.revenue) : undefined;

  const heroEyebrow = (
    <span data-testid="hero-tenant">{tenant?.name ? `Hoş geldin · ${tenant.name}` : "Hoş geldin"}</span>
  );
  const heroTitle = (
    <span data-testid="hero-greeting">{firstName ? `${firstName} 👋` : "Merhaba 👋"}</span>
  );
  const heroSubtitle = (
    <span>
      Bugün <span className="font-semibold text-white" data-testid="hero-today">{kpi.today_services}</span> servis,{" "}
      <span className="font-semibold text-white" data-testid="hero-open">{kpi.open_services}</span> açık iş emriniz var.
      Bekleyen alacak:{" "}
      <span className="font-semibold text-white" data-testid="hero-receivables"><Money value={kpi.total_receivables} /></span>
    </span>
  );

  const bodies = {
    kpi: (
      <section aria-label="Özet göstergeler" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        <KpiCard icon={Wrench} label="Bugünkü servisler" value={kpi.today_services} tone="orange" testId="kpi-today" />
        <KpiCard icon={ClipboardList} label="Açık iş emirleri" value={kpi.open_services} tone="blue" testId="kpi-open" />
        <KpiCard icon={PackageCheck} label="Teslime hazır" value={kpi.awaiting_delivery} tone="violet" testId="kpi-awaiting" />
        <KpiCard icon={TrendingUp} label="Bu ay ciro" value={<Money value={kpi.month_revenue} />} tone="orange" spark={sparkRevenue} testId="kpi-month-revenue" />
        <KpiCard icon={HandCoins} label="Bugünkü tahsilat" value={<Money value={kpi.today_collection} />} tone="green" testId="kpi-today-collection" />
        <KpiCard icon={Wallet} label="Bekleyen alacak" value={<Money value={kpi.total_receivables} />} tone="red" testId="kpi-receivables" />
      </section>
    ),

    reminders: (
      <Panel
        className="h-full"
        testId="reminders-widget"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <BellRing className="h-4 w-4 text-orange-400" />
            Bakım hatırlatmaları
            {digest && <StatusBadge tone="brand">{digest.due_count}</StatusBadge>}
          </span>
        }
        subtitle={
          digest?.generated_at
            ? `Her sabah 09:00'da otomatik oluşturulur · Son güncelleme: ${new Date(digest.generated_at).toLocaleString("tr-TR")}`
            : "Henüz oluşturulmadı. 'Yenile' ile hemen hazırlayabilirsiniz."
        }
        action={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerate}
              disabled={regen}
              data-testid="reminders-widget-refresh"
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
            >
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
          </>
        }
      >
        {digest?.skipped_no_phone > 0 && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {digest.skipped_no_phone} müşteri telefon bilgisi eksik olduğu için atlandı.
          </p>
        )}
        {links.length === 0 ? (
          <Empty icon={CircleCheck} title="Bugün bakım hatırlatması yok" desc="Bakım zamanı gelen müşteri olduğunda burada listelenir." />
        ) : (
          <ul className="max-h-96 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10">
            {links.map((l) => {
              const urgent = Boolean(l.km_over || l.date_over);
              const soon = !urgent && l.days_left !== null && l.days_left !== undefined && l.days_left <= 7;
              const urgentLabel = [l.km_over ? "KM+" : "", l.date_over ? "Tarih" : ""].filter(Boolean).join(" · ");
              return (
                <li key={l.motorcycle_id} className="flex items-center gap-3 p-3" data-testid={`widget-link-${l.motorcycle_id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{l.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {l.brand_model} · <span className="font-mono">{l.plate}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{l.phone ? `${dueText(l.days_left)} · ${l.phone}` : dueText(l.days_left)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge tone={urgent ? "danger" : soon ? "warning" : "info"}>
                      {urgent ? urgentLabel || "Gecikti" : soon ? "Yaklaşıyor" : "Planlı"}
                    </StatusBadge>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 transition-colors duration-150 hover:text-emerald-300"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    ),

    revenue: (
      <Panel
        className="h-full"
        title="Ciro trendi"
        subtitle="Son 12 ay"
        action={
          unlocked && trend.length ? (
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />Ciro</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />3 ay ortalaması</span>
            </div>
          ) : undefined
        }
      >
        {!unlocked ? (
          <Empty
            icon={Lock}
            title="Ciro grafiği gizli"
            desc="Tutarları görmek için kilidi açın."
            action={<Button variant="outline" size="sm" onClick={openPin} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">Kilidi aç</Button>}
          />
        ) : trend.length ? (
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ORANGE} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashAvgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
                <Tooltip content={<DarkTip money labelOf={monthLabel} />} />
                <Area type="monotone" dataKey="avg" name="3 ay ortalaması" stroke={BLUE} strokeWidth={2} fill="url(#dashAvgGrad)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="revenue" name="Ciro" stroke={ORANGE} strokeWidth={2.5} fill="url(#dashRevGrad)" activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty title="Henüz ciro verisi yok" desc="Tamamlanan servisler burada grafik olarak görünür." />
        )}
      </Panel>
    ),

    status: (
      <Panel className="h-full" title="Servis durumu" subtitle="Tüm kayıtlar">
        {status_distribution?.length ? (
          <>
            <div className="relative h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={status_distribution}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {status_distribution.map((s) => (
                      <Cell key={s.status} fill={statusColor(s.status)} />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTip labelOf={statusLabel} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-2xl font-bold tabular-nums text-white">{statusTotal}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Toplam</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {status_distribution.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-xs text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: statusColor(s.status) }} />
                    {statusLabel(s.status)}
                  </span>
                  <span className="font-mono font-semibold text-white">{s.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
              Tamamlanan (teslim edildi)
              <span className="font-semibold text-white" data-testid="kpi-completed">{kpi.completed_services}</span>
            </p>
          </>
        ) : (
          <Empty title="Servis kaydı yok" desc="İlk iş emrinizi oluşturduğunuzda dağılım burada görünür." />
        )}
      </Panel>
    ),

    recent: (
      <Panel
        className="h-full overflow-hidden"
        title="Son servis kayıtları"
        action={
          <Link to="/service-orders" className="text-xs font-semibold text-orange-400 transition-colors duration-150 hover:text-orange-300 hover:underline">
            Tümünü gör →
          </Link>
        }
      >
        {recent_orders?.length ? (
          <DataTable>
            <thead>
              <tr>
                <th>Servis no</th>
                <th>Müşteri</th>
                <th>Motosiklet</th>
                <th>Durum</th>
                <th className="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {recent_orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/service-orders/${o.id}`} className="font-mono font-medium text-white hover:text-orange-400 hover:underline">
                      {o.service_no}
                    </Link>
                    <div className="text-xs text-slate-400">{fmtDateShort(o.created_at)}</div>
                  </td>
                  <td className="text-slate-300">{o.customer_name}</td>
                  <td className="font-mono text-slate-300">{o.plate}</td>
                  <td>
                    <span data-testid={`status-badge-${o.status}`}>
                      <StatusBadge tone={STATUS_TONE[o.status] || "neutral"}>{statusLabel(o.status)}</StatusBadge>
                    </span>
                  </td>
                  <td className="text-right">
                    <Money value={o.grand_total} className="font-medium text-white" />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon={Wrench} title="Henüz servis kaydı yok" desc="Yeni iş emri oluşturarak başlayın." className="py-12" />
        )}
      </Panel>
    ),

    debtors: (
      <Panel
        className="h-full"
        testId="debtors-widget"
        title="Cari hesap özeti"
        subtitle="Bakiyesi açık olan müşteriler"
        action={
          <span className="text-xs text-slate-400">
            Borçlu servis <span className="font-semibold text-white" data-testid="kpi-unpaid">{kpi.unpaid_count}</span>
          </span>
        }
      >
        {debtors?.length ? (
          <ul className="max-h-96 divide-y divide-white/10 overflow-y-auto">
            {debtors.map((d) => {
              const bal = d.balance === null || d.balance === undefined ? null : Number(d.balance);
              const tone = bal === null ? "text-slate-400" : bal > 0 ? "text-rose-400" : "text-emerald-400";
              return (
                <li key={d.customer_id} className="flex items-center justify-between gap-3 py-3" data-testid={`debtor-${d.customer_id}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{d.customer_name}</p>
                    <p className="text-xs text-slate-400">{d.orders} servis</p>
                  </div>
                  <Money value={d.balance} className={`shrink-0 font-semibold ${tone}`} />
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon={CircleCheck} title="Borçlu müşteri yok" desc="Tüm bakiyeler kapalı." />
        )}
      </Panel>
    ),

    operations: (
      <Panel className="h-full" title="Operasyon" subtitle="En çok yapılan işlemler">
        {top_operations?.length ? (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={top_operations} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip content={<DarkTip />} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
                <Bar dataKey="count" name="Adet" fill={ORANGE} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty title="Henüz işlem yok" desc="Servislerde yapılan işlemler burada sıralanır." />
        )}
      </Panel>
    ),
  };

  return (
    <div className="space-y-6" data-testid="dashboard">
      <HeroBanner
        testId="dashboard-hero"
        eyebrow={heroEyebrow}
        title={heroTitle}
        subtitle={heroSubtitle}
        slot="dashboard_hero"
        fallback="/visuals/moto-main.png"
        actions={
          <>
            <SectionsPanel
              sections={order.map((id) => SECTION_BY_ID[id]).filter(Boolean)}
              hidden={hidden}
              onToggle={toggle}
              onReset={reset}
            />
            <Button asChild data-testid="btn-new-service-order" className="bg-orange-500 text-white hover:bg-orange-600">
              <Link to="/service-orders/new">
                <ClipboardList />
                Yeni Servis Kaydı
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {visible.filter((id) => SECTION_BY_ID[id] && bodies[id]).map((id) => (
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

import React, { useEffect, useState } from "react";
import api, { fmtMoney, fmtDateShort, STATUS_META } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import StatusBadge from "../components/StatusBadge";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Link } from "react-router-dom";
import {
  Wrench, ClipboardList, PackageCheck, Truck, Wallet, TrendingUp, HandCoins, AlertTriangle, MessageCircle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";

const KPI = ({ icon: Icon, label, value, accent = "text-slate-900", testid }) => (
  <Card className="border-slate-200" data-testid={testid}>
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className={`mt-2 font-heading text-2xl font-bold ${accent}`}>{value}</div>
        </div>
        <div className="h-11 w-11 rounded-md bg-slate-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const COLORS = ["#2563EB", "#F97316", "#059669", "#DC2626", "#CA8A04", "#7C3AED", "#0891B2", "#DB2777"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [digest, setDigest] = useState(null);
  const [regen, setRegen] = useState(false);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
    api.get("/dashboard/reminders-today").then(r => setDigest(r.data)).catch(()=>{});
  }, []);

  const regenerate = async () => {
    setRegen(true);
    try { const r = await api.post("/dashboard/reminders-today/regenerate"); setDigest(r.data); toast.success(`${r.data.due_count} hatırlatma güncellendi`); }
    catch { toast.error("Yenileme başarısız"); }
    finally { setRegen(false); }
  };
  const openAll = () => { (digest?.links || []).forEach((l, i) => setTimeout(() => window.open(l.url, "_blank"), i * 300)); };

  if (!data) return <div className="text-slate-500">Yükleniyor…</div>;
  const { kpi, monthly_revenue, status_distribution, top_operations, recent_orders } = data;

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Servis operasyonunun anlık durumu</p>
        </div>
        <Link to="/service-orders/new"
              className="hidden sm:inline-flex items-center h-10 px-4 rounded-md bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors duration-150"
              data-testid="btn-new-service-order">
          <ClipboardList className="h-4 w-4 mr-2" /> Yeni Servis Kaydı
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Wrench} label="Bugünkü Servis" value={kpi.today_services} testid="kpi-today" />
        <KPI icon={ClipboardList} label="Açık Servisler" value={kpi.open_services} testid="kpi-open" />
        <KPI icon={PackageCheck} label="Tamamlanan" value={kpi.completed_services} accent="text-emerald-600" testid="kpi-completed" />
        <KPI icon={Truck} label="Teslim Bekliyor" value={kpi.awaiting_delivery} accent="text-orange-600" testid="kpi-awaiting" />
        <KPI icon={HandCoins} label="Bugünkü Tahsilat" value={fmtMoney(kpi.today_collection)} accent="text-emerald-600" testid="kpi-today-collection" />
        <KPI icon={TrendingUp} label="Bu Ay Ciro" value={fmtMoney(kpi.month_revenue)} testid="kpi-month-revenue" />
        <KPI icon={Wallet} label="Toplam Alacak" value={fmtMoney(kpi.total_receivables)} accent="text-red-600" testid="kpi-receivables" />
        <KPI icon={AlertTriangle} label="Borçlu Servis" value={kpi.unpaid_count} testid="kpi-unpaid" />
      </div>

      {/* Daily reminders widget */}
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white" data-testid="reminders-widget">
        <CardHeader className="pb-3 flex-row items-start justify-between">
          <div>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Bugünkü Bakım Hatırlatmaları
              {digest && <span className="text-sm font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-1">{digest.due_count}</span>}
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {digest?.generated_at
                ? `Her sabah 09:00'da otomatik oluşturulur · Son güncelleme: ${new Date(digest.generated_at).toLocaleString("tr-TR")}`
                : "Henüz oluşturulmadı — 'Yenile' ile hemen hazırlayabilirsiniz."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regen} data-testid="reminders-widget-refresh"><RefreshCw className={`h-3.5 w-3.5 mr-1 ${regen?"animate-spin":""}`} />Yenile</Button>
            {digest?.links?.length > 0 && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openAll} data-testid="reminders-widget-open-all"><MessageCircle className="h-3.5 w-3.5 mr-1" />Tümünü Aç ({digest.links.length})</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {(!digest || digest.links.length === 0) && (
            <div className="text-sm text-slate-500 py-4 text-center">🎉 Bugün bakım hatırlatması gereken müşteri yok.</div>
          )}
          {digest?.skipped_no_phone > 0 && <div className="text-xs text-amber-600 mb-2">⚠ {digest.skipped_no_phone} müşteri telefon bilgisi eksik olduğu için atlandı.</div>}
          {digest?.links?.length > 0 && (
            <div className="max-h-72 overflow-y-auto border rounded bg-white">
              <table className="min-w-full text-sm">
                <tbody>
                  {digest.links.map(l => (
                    <tr key={l.motorcycle_id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`widget-link-${l.motorcycle_id}`}>
                      <td className="px-3 py-2 w-1/3">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{l.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        <div>{l.brand_model} · <span className="font-mono">{l.plate}</span></div>
                        <div className="flex gap-1 mt-1">
                          {l.km_over && <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">KM+</span>}
                          {l.date_over && <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Tarih</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold text-xs">
                          <MessageCircle className="h-3 w-3" />WhatsApp
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Aylık Ciro (Son 12 Ay)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={monthly_revenue}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Servis Durumu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={status_distribution} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90}>
                    {status_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, STATUS_META[n]?.label || n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {status_distribution.map((s, i) => (
                <span key={s.status} className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  {STATUS_META[s.status]?.label || s.status} ({s.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">En Çok Yapılan İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={top_operations} layout="vertical">
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0F172A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Son Servis Kayıtları</CardTitle>
            <Link to="/service-orders" className="text-xs text-orange-600 font-semibold hover:underline">Tümü →</Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2">Servis No</th>
                    <th className="text-left px-4 py-2">Tarih</th>
                    <th className="text-left px-4 py-2">Müşteri</th>
                    <th className="text-left px-4 py-2">Plaka</th>
                    <th className="text-left px-4 py-2">Durum</th>
                    <th className="text-right px-4 py-2">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_orders.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2"><Link to={`/service-orders/${o.id}`} className="font-mono text-slate-900 hover:underline">{o.service_no}</Link></td>
                      <td className="px-4 py-2 text-slate-600">{fmtDateShort(o.created_at)}</td>
                      <td className="px-4 py-2">{o.customer_name}</td>
                      <td className="px-4 py-2 font-mono">{o.plate}</td>
                      <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-2 text-right font-medium">{fmtMoney(o.grand_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

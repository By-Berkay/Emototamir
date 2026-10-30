import React, { useEffect, useState } from "react";
import { CountStrip } from "../components/reports/ReportKit";
import { Wrench, Clock, Gauge, CircleCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import api, { fmtMoney, fmtDateShort, STATUS_META, STATUS_LIST } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import StatusBadge from "../components/StatusBadge";
import { Plus, Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import AnimatedMotorcycleSVG from "../components/AnimatedMotorcycleSVG";
import { Wrench as PvIcon } from "lucide-react";
import { toast } from "sonner";

export default function ServiceOrders() {
  const loc = useLocation();
  const initialQ = new URLSearchParams(loc.search).get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [items, setItems] = useState([]);

  // Üst çubuktaki genel aramadan gelen ?q= değişince (sayfa zaten açıkken de) listeyi güncelle
  useEffect(() => { setQ(new URLSearchParams(loc.search).get("q") || ""); }, [loc.search]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("payment_status", paymentStatus);
    api.get(`/service-orders?${params.toString()}`)
      .then(({ data }) => { if (active) setItems(data); })
      .catch(() => { if (active) toast.error("Servis kayıtları yüklenemedi"); });
    // Hızlı yazımda eski istek yanıtının yeni listeyi ezmesini engelle
    return () => { active = false; };
  }, [q, status, paymentStatus]);

  return (
    <div className="space-y-6">
      <PageHeader art={<AnimatedMotorcycleSVG type="sport" height="100%" />} visual={<PageVisual icon={PvIcon} />}
        title="Servis Kayıtları"
        description={`${items.length} servis kaydı`}
        actions={
          <Link to="/service-orders/new"><Button className="bg-brand-500 hover:bg-brand-600" data-testid="btn-new-service"><Plus className="h-4 w-4 mr-2" />Yeni Servis</Button></Link>
        }
      />
      <CountStrip items={[
        { label: "Toplam servis", value: items.length, hint: "Tüm kayıtlar", icon: Wrench, tone: "orange", testId: "so-total" },
        { label: "Açık iş", value: items.filter((o) => !["completed", "delivered", "cancelled"].includes(o.status)).length, hint: "Tamamlanmamış kayıtlar", icon: Clock, tone: "cyan", testId: "so-open" },
        { label: "Tamirde", value: items.filter((o) => o.status === "in_repair").length, hint: "Aktif işçilik", icon: Gauge, tone: "violet", testId: "so-repair" },
        { label: "Teslim edildi", value: items.filter((o) => o.status === "delivered").length, hint: "Kapanmış kayıtlar", icon: CircleCheck, tone: "emerald", testId: "so-delivered" },
      ]} />

      <Card className="border-slate-200"><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Servis no, plaka, müşteri" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" data-testid="so-search" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="so-status-filter"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {STATUS_LIST.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger><SelectValue placeholder="Ödeme" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Ödemeler</SelectItem>
            <SelectItem value="unpaid">Borçlu</SelectItem>
            <SelectItem value="paid">Ödenmiş</SelectItem>
          </SelectContent>
        </Select>
      </CardContent></Card>

      <Card className="border-slate-200"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Servis No</th>
                <th className="text-left px-4 py-3">Tarih</th>
                <th className="text-left px-4 py-3">Müşteri</th>
                <th className="text-left px-4 py-3">Motosiklet</th>
                <th className="text-left px-4 py-3">Plaka</th>
                <th className="text-left px-4 py-3">Durum</th>
                <th className="text-right px-4 py-3">Tutar</th>
                <th className="text-right px-4 py-3">Ödenen</th>
                <th className="text-right px-4 py-3">Kalan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const remaining = (o.grand_total || 0) - (o.paid_total || 0);
                return (
                  <tr key={o.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3"><Link to={`/service-orders/${o.id}`} className="font-mono text-slate-900 hover:underline" data-testid={`so-row-${o.id}`}>{o.service_no}</Link></td>
                    <td className="px-4 py-3">{fmtDateShort(o.created_at)}</td>
                    <td className="px-4 py-3">{o.customer_name}</td>
                    <td className="px-4 py-3">{o.brand} {o.model}</td>
                    <td className="px-4 py-3 font-mono">{o.plate}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(o.grand_total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmtMoney(o.paid_total)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${remaining>0.01?"text-red-600":"text-slate-400"}`}>{fmtMoney(remaining)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Servis kaydı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

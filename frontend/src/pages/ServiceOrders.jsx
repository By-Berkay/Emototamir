import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Wrench, Clock, Hourglass, Gauge, PackageCheck, Plus, Search, Eye, Pencil, FileDown } from "lucide-react";
import { toast } from "sonner";
import api, { openAuthedPdf, fmtDateShort, STATUS_META, STATUS_LIST } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { HeroBanner, KpiCard, Panel, StatusBadge, DataTable, FilterChips } from "../components/design/kit";
import Money from "../components/Money";

/* Durum -> rozet tonu eşlemesi (yalnızca sunumda kullanılır). */
const STATUS_TONE = {
  new: "info",
  diagnosed: "violet",
  pricing: "neutral",
  awaiting_approval: "warning",
  approved: "success",
  in_repair: "brand",
  parts_waiting: "warning",
  completed: "success",
  awaiting_delivery: "info",
  delivered: "success",
  cancelled: "danger",
};

const QUICK_STATUS = [
  { value: "all", label: "Tümü" },
  { value: "awaiting_approval", label: "Onay bekleyen" },
  { value: "in_repair", label: "Tamirde" },
  { value: "parts_waiting", label: "Parça bekleniyor" },
  { value: "delivered", label: "Teslim edildi" },
];

export default function ServiceOrders() {
  const loc = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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

  const countBy = (list) => items.filter((o) => list.includes(o.status)).length;
  const openCount = items.filter((o) => !["completed", "delivered", "cancelled"].includes(o.status)).length;
  const deliveredCount = countBy(["delivered"]);

  return (
    <div className="space-y-6 text-white">
      <HeroBanner
        eyebrow="Servis yönetimi"
        title="Servis Kayıtları"
        subtitle={`${items.length} servis kaydı`}
        slot="services_hero"
        fallback={null}
        actions={
          <Link to="/service-orders/new">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="btn-new-service">
              <Plus className="h-4 w-4 mr-2" />Yeni iş emri
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon={Clock} label="Açık servis" value={openCount} tone="orange" testId="so-open" />
        <KpiCard icon={Hourglass} label="Onay bekleyen" value={countBy(["awaiting_approval"])} tone="amber" testId="so-approval" />
        <KpiCard icon={Gauge} label="Devam eden" value={countBy(["in_repair", "parts_waiting"])} tone="violet" testId="so-repair" />
        <KpiCard icon={PackageCheck} label="Teslime hazır" value={countBy(["completed", "awaiting_delivery"])} tone="green" testId="so-ready" />
      </div>

      <div className="emt-glass-dark rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Servis no, plaka, müşteri"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              data-testid="so-search"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white" data-testid="so-status-filter"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue placeholder="Ödeme" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Ödemeler</SelectItem>
              <SelectItem value="unpaid">Borçlu</SelectItem>
              <SelectItem value="paid">Ödenmiş</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <FilterChips options={QUICK_STATUS} value={status} onChange={setStatus} />
      </div>

      <Panel
        title="Servis kayıtları"
        subtitle={<span><span data-testid="so-total">{items.length} servis kaydı</span> · <span data-testid="so-delivered">{deliveredCount} teslim edildi</span></span>}
      >
        <DataTable>
          <thead>
            <tr>
              <th>No</th>
              <th>Tarih</th>
              <th>Müşteri</th>
              <th>Motosiklet</th>
              <th>Durum</th>
              <th className="text-right">Tutar</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => {
              const remaining = (o.grand_total || 0) - (o.paid_total || 0);
              const label = STATUS_META[o.status]?.label || o.status;
              return (
                <tr key={o.id}>
                  <td>
                    <Link to={`/service-orders/${o.id}`} className="font-mono font-semibold text-orange-400 hover:underline" data-testid={`so-row-${o.id}`}>
                      {o.service_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-slate-300">{fmtDateShort(o.created_at)}</td>
                  <td className="text-white">{o.customer_name}</td>
                  <td>
                    <div className="text-white">{o.brand} {o.model}</div>
                    <div className="font-mono text-xs text-slate-400">{o.plate}</div>
                  </td>
                  <td>
                    <span data-testid={`status-badge-${o.status}`}>
                      <StatusBadge tone={STATUS_TONE[o.status] || "neutral"}>{label}</StatusBadge>
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="font-semibold text-white"><Money value={o.grand_total} /></div>
                    <div className="text-[11px] text-slate-400">
                      Ödenen <Money value={o.paid_total} /> ·{" "}
                      <span className={remaining > 0.01 ? "font-semibold text-rose-300" : "text-emerald-300"}>
                        Kalan <Money value={remaining} />
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white" title="Görüntüle">
                        <Link to={`/service-orders/${o.id}`} aria-label="Görüntüle"><Eye /></Link>
                      </Button>
                      {isAdmin && (
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white" title="Düzenle">
                          <Link to={`/service-orders/${o.id}/edit`} aria-label="Düzenle"><Pencil /></Link>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white"
                        title="Kabul PDF"
                        aria-label="Kabul PDF"
                        onClick={() => openAuthedPdf(`/service-orders/${o.id}/pdf/kabul`)}
                      >
                        <FileDown />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">Servis kaydı bulunamadı</td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </Panel>
    </div>
  );
}

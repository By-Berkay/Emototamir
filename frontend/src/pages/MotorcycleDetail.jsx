import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort, STATUS_META } from "../lib/api";
import FaultViewer from "../components/FaultViewer";
import { toast } from "sonner";
import { useSiteAsset } from "../lib/siteAssets";
import { ArrowLeft, Wrench, Wallet, CalendarClock, User, Phone, StickyNote } from "lucide-react";
import { Panel, DataTable, KpiCard, StatusBadge } from "../components/design/kit";

// Servis durumu -> rozet tonu (etiketler lib/api STATUS_META'dan gelir)
const STATUS_TONE = {
  new: "info",
  diagnosed: "info",
  pricing: "neutral",
  awaiting_approval: "warning",
  approved: "success",
  in_repair: "brand",
  parts_waiting: "warning",
  completed: "success",
  awaiting_delivery: "violet",
  delivered: "success",
  cancelled: "danger",
};

function Chip({ label, value, mono = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs ring-1 ring-white/10">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold text-white ${mono ? "font-mono" : ""}`}>{value}</span>
    </span>
  );
}

function Spec({ label, value }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-right font-medium text-white ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</dd>
    </div>
  );
}

export default function MotorcycleDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  // Site asset yüklenmemişse null döner; bu durumda mevcut çizim (FaultViewer) gösterilir
  const image = useSiteAsset("motorcycle_detail", null);
  useEffect(() => {
    api.get(`/motorcycles/${id}`).then((r) => setM(r.data))
      .catch(() => toast.error("Motosiklet bilgileri yüklenemedi"));
  }, [id]);
  if (!m) return <div className="py-20 text-center text-sm text-slate-400">Yükleniyor…</div>;

  const title = `${m.brand} ${m.model}`;
  const orders = m.service_orders || [];

  return (
    <div className="space-y-6 text-white">
      <section className="emt-glass-dark relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8">
        <Link to="/motorcycles" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Motosikletler
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">Motosiklet detayı</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          {m.year && <StatusBadge tone="brand">{m.year}</StatusBadge>}
        </div>
        <p className="mt-2 text-sm text-slate-300">{[m.type, m.color].filter(Boolean).join(" · ")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {m.plate && <Chip label="Plaka" value={m.plate} mono />}
          {m.vin && <Chip label="Şasi" value={m.vin} mono />}
          {m.engine_cc ? <Chip label="Motor" value={`${m.engine_cc} cc`} /> : null}
          {m.km ? <Chip label="Km" value={`${Number(m.km).toLocaleString("tr-TR")} km`} /> : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={Wrench} label="Toplam servis" value={m.total_services ?? 0} tone="orange" testId="moto-detail-services" />
        <KpiCard icon={Wallet} label="Toplam harcama" value={fmtMoney(m.total_spent)} tone="green" testId="moto-detail-spent" />
        <KpiCard icon={CalendarClock} label="Son servis" value={fmtDateShort(m.last_service_date)} tone="blue" testId="moto-detail-last" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="emt-glass-dark overflow-hidden rounded-2xl border border-white/10 p-5">
          {image ? (
            <div className="flex h-60 items-center justify-center rounded-xl bg-gradient-to-b from-slate-800/60 to-slate-950">
              <img src={image} alt={title} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl bg-gradient-to-b from-slate-800/60 to-slate-950 py-4">
              <FaultViewer type={m.type} color={m.color} label={title} height={240} />
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Spec label="Motor hacmi" value={m.engine_cc ? `${m.engine_cc} cc` : "-"} />
            <Spec label="Kilometre" value={`${Number(m.km || 0).toLocaleString("tr-TR")} km`} />
            <Spec label="Renk" value={m.color || "-"} />
            <Spec label="Yakıt" value={m.fuel_type || "-"} />
            <Spec label="Vites" value={m.transmission || "-"} />
          </dl>
        </section>

        <Panel title="Teknik bilgiler" subtitle="Kayıtlı araç bilgileri">
          <dl className="divide-y divide-white/10 text-sm">
            <Row label="Tip" value={m.type || "-"} />
            <Row label="Model yılı" value={m.year || "-"} />
            <Row label="Plaka" value={m.plate || "-"} mono />
            <Row label="Şase (VIN)" value={m.vin || "-"} mono />
            <Row label="Motor No" value={m.engine_no || "-"} mono />
            <Row label="Son servis km" value={m.last_km != null ? `${Number(m.last_km).toLocaleString("tr-TR")} km` : "-"} />
          </dl>
        </Panel>

        <Panel title="Sahip" subtitle="Motosiklet sahibi">
          {m.customer ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-sm font-bold text-orange-300 ring-1 ring-orange-500/30">
                  <User className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <Link to={`/customers/${m.customer.id}`} className="block truncate font-semibold text-white hover:underline">
                    {m.customer.first_name} {m.customer.last_name}
                  </Link>
                  <span className="text-xs text-slate-400">Müşteri kartını aç</span>
                </div>
              </div>
              {m.customer.phone && (
                <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm ring-1 ring-white/10">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="font-mono text-slate-200">{m.customer.phone}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{m.owner_name ? m.owner_name : "Sahip bilgisi yok"}</p>
          )}
        </Panel>
      </div>

      <Panel title="Servis geçmişi" subtitle={`${orders.length} servis kaydı`}>
        <DataTable>
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Servis No</th>
              <th className="px-4 py-3 text-left font-semibold">Tarih</th>
              <th className="px-4 py-3 text-left font-semibold">Durum</th>
              <th className="px-4 py-3 text-right font-semibold">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-white/10 transition-colors hover:bg-white/5">
                <td className="px-4 py-3"><Link to={`/service-orders/${o.id}`} className="font-mono text-orange-300 hover:underline">{o.service_no}</Link></td>
                <td className="px-4 py-3 text-slate-300">{fmtDateShort(o.created_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATUS_TONE[o.status] || "neutral"}>{STATUS_META[o.status]?.label || o.status || "-"}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-white">{fmtMoney(o.grand_total)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Servis kaydı yok</td></tr>
            )}
          </tbody>
        </DataTable>
      </Panel>

      {m.notes && m.notes.trim() && (
        <Panel title="Notlar" action={<StickyNote className="h-4 w-4 text-slate-400" />}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{m.notes}</p>
        </Panel>
      )}
    </div>
  );
}

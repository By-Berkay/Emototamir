import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import FaultViewer from "../components/FaultViewer";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import MotoPhoto from "../components/MotoPhoto";
import { Bike } from "lucide-react";

export default function MotorcycleDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  useEffect(() => {
    api.get(`/motorcycles/${id}`).then((r) => setM(r.data))
      .catch(() => toast.error("Motosiklet bilgileri yüklenemedi"));
  }, [id]);
  if (!m) return <div>Yükleniyor…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        art={<MotoPhoto />}
        visual={<PageVisual icon={Bike} />}
        title={`${m.brand} ${m.model}`}
        description={`${m.plate} · ${m.type}${m.year ? ` · ${m.year}` : ""}${m.customer ? ` · ${m.customer.first_name} ${m.customer.last_name}` : ""}`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-slate-200"><CardContent className="p-5">
          <FaultViewer type={m.type} color={m.color} label={`${m.brand} ${m.model}`} height={200} />
          <div className="mt-4 space-y-1">
            <div className="font-heading text-2xl font-bold">{m.brand} {m.model}</div>
            <div className="text-sm text-slate-500">{m.type} · {m.year || "-"}</div>
            <div className="font-mono text-sm inline-block bg-slate-900 text-white px-2 py-1 rounded mt-1">{m.plate}</div>
          </div>
          <dl className="mt-4 text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500">Motor Hacmi</dt><dd>{m.engine_cc || "-"} cc</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Kilometre</dt><dd>{m.km?.toLocaleString("tr-TR")} km</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Renk</dt><dd>{m.color || "-"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Yakıt</dt><dd>{m.fuel_type}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Vites</dt><dd>{m.transmission}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Şase</dt><dd className="font-mono text-xs">{m.vin || "-"}</dd></div>
          </dl>
          {m.customer && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs uppercase text-slate-500 mb-1">Sahibi</div>
              <Link to={`/customers/${m.customer.id}`} className="font-medium hover:underline">{m.customer.first_name} {m.customer.last_name}</Link>
              <div className="text-sm text-slate-500 font-mono">{m.customer.phone}</div>
            </div>
          )}
        </CardContent></Card>

        <Card className="lg:col-span-2 border-slate-200"><CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard label="Toplam Servis" value={m.total_services} tone="brand" />
            <StatCard label="Toplam Harcama" value={fmtMoney(m.total_spent)} tone="emerald" />
            <StatCard label="Son Servis" value={fmtDateShort(m.last_service_date)} tone="slate" />
          </div>
          <h3 className="font-heading text-lg font-semibold mb-3">Servis Geçmişi</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-3 py-2">Servis No</th><th className="text-left px-3 py-2">Tarih</th><th className="text-left px-3 py-2">Durum</th><th className="text-right px-3 py-2">Tutar</th></tr></thead>
            <tbody>
              {m.service_orders.map((o) => (
                <tr key={o.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2"><Link to={`/service-orders/${o.id}`} className="font-mono hover:underline">{o.service_no}</Link></td>
                  <td className="px-3 py-2">{fmtDateShort(o.created_at)}</td>
                  <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(o.grand_total)}</td>
                </tr>
              ))}
              {m.service_orders.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Servis kaydı yok</td></tr>}
            </tbody>
          </table>
        </CardContent></Card>
      </div>
    </div>
  );
}

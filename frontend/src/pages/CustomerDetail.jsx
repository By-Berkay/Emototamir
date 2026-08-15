import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import StatusBadge from "../components/StatusBadge";
import { Bike, Phone, MapPin, Mail } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  useEffect(() => { api.get(`/customers/${id}`).then((r) => setC(r.data)); }, [id]);
  if (!c) return <div>Yükleniyor…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-bold">
          {c.first_name?.[0]}{c.last_name?.[0]}
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">{c.first_name} {c.last_name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-1">
            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone}</span>
            {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
            {c.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.city}{c.district?` / ${c.district}`:""}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Toplam Servis</div><div className="text-2xl font-bold">{c.total_services}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Toplam Harcama</div><div className="text-2xl font-bold">{fmtMoney(c.total_spent)}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Toplam Tahsilat</div><div className="text-2xl font-bold text-emerald-600">{fmtMoney(c.total_paid)}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Bakiye (Borç)</div><div className={`text-2xl font-bold ${c.balance>0.01?"text-red-600":"text-emerald-600"}`}>{fmtMoney(c.balance)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="motorcycles">
        <TabsList>
          <TabsTrigger value="motorcycles">Motosikletler ({c.motorcycles.length})</TabsTrigger>
          <TabsTrigger value="services">Servis Geçmişi ({c.service_orders.length})</TabsTrigger>
          <TabsTrigger value="transactions">Cari Hareketler</TabsTrigger>
        </TabsList>
        <TabsContent value="motorcycles">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.motorcycles.map((m) => (
              <Link to={`/motorcycles/${m.id}`} key={m.id}>
                <Card className="border-slate-200 hover:border-orange-400 transition-colors duration-150">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-md bg-slate-900 text-white flex items-center justify-center"><Bike className="h-5 w-5" /></div>
                      <div>
                        <div className="font-heading font-semibold">{m.brand} {m.model}</div>
                        <div className="text-xs text-slate-500">{m.type} · {m.year}</div>
                      </div>
                    </div>
                    <div className="font-mono text-sm bg-slate-100 rounded px-2 py-1 inline-block">{m.plate}</div>
                    <div className="text-xs text-slate-500 mt-2">{m.km?.toLocaleString("tr-TR")} km</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {c.motorcycles.length === 0 && <div className="text-slate-500 col-span-full">Motosiklet bulunamadı.</div>}
          </div>
        </TabsContent>
        <TabsContent value="services">
          <Card className="border-slate-200"><CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="text-left px-4 py-2">Servis No</th><th className="text-left px-4 py-2">Tarih</th><th className="text-left px-4 py-2">Motosiklet</th><th className="text-left px-4 py-2">Durum</th><th className="text-right px-4 py-2">Tutar</th></tr>
              </thead>
              <tbody>
                {c.service_orders.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2"><Link to={`/service-orders/${o.id}`} className="font-mono hover:underline">{o.service_no}</Link></td>
                    <td className="px-4 py-2">{fmtDateShort(o.created_at)}</td>
                    <td className="px-4 py-2">{o.brand} {o.model} <span className="font-mono text-xs text-slate-500">({o.plate})</span></td>
                    <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2 text-right font-medium">{fmtMoney(o.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card className="border-slate-200"><CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Tarih</th><th className="text-left px-4 py-2">Tür</th><th className="text-left px-4 py-2">Açıklama</th><th className="text-right px-4 py-2">Tutar</th></tr></thead>
              <tbody>
                {c.transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2">{fmtDateShort(t.created_at)}</td>
                    <td className="px-4 py-2">{t.type === "charge" ? "Borç" : t.type === "payment" ? "Tahsilat" : "Düzeltme"}</td>
                    <td className="px-4 py-2">{t.description}</td>
                    <td className={`px-4 py-2 text-right font-medium ${t.amount>0?"text-red-600":"text-emerald-600"}`}>{fmtMoney(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

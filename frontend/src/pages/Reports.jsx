import React, { useEffect, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { toast } from "sonner";

function toCSV(rows, headers) {
  const head = headers.map(h=>h.label).join(",");
  const body = rows.map(r=>headers.map(h=>`"${String(r[h.key]??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  return head + "\n" + body;
}

const download = (name, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/reports/summary").then(x=>setR(x.data)).catch(() => toast.error("Rapor verileri yüklenemedi")); }, []);
  if (!r) return <div>Yükleniyor…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Raporlar" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Toplam Ciro" value={fmtMoney(r.totals.total_revenue)} tone="brand" />
        <StatCard label="Toplam Tahsilat" value={fmtMoney(r.totals.total_collected)} tone="emerald" />
        <StatCard label="Alacak" value={fmtMoney(r.totals.receivables)} tone="red" />
        <StatCard label="Servis Sayısı" value={r.totals.orders_count} tone="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">En Çok Servis Kullanan Müşteriler</CardTitle>
            <Button variant="outline" size="sm" onClick={()=>{download("musteri_raporu.csv", toCSV(r.top_customers,[{key:"customer_name",label:"Müşteri"},{key:"count",label:"Servis"},{key:"spent",label:"Harcama"}])); toast.success("İndirildi");}}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Müşteri</th><th className="text-right px-4 py-2">Servis</th><th className="text-right px-4 py-2">Harcama</th></tr></thead>
              <tbody>{r.top_customers.map(c=><tr key={c.customer_id} className="border-t"><td className="px-4 py-2">{c.customer_name}</td><td className="px-4 py-2 text-right">{c.count}</td><td className="px-4 py-2 text-right font-medium">{fmtMoney(c.spent)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">En Çok Yapılan Hizmetler</CardTitle>
            <Button variant="outline" size="sm" onClick={()=>{download("hizmet_raporu.csv", toCSV(r.top_services,[{key:"name",label:"Hizmet"},{key:"count",label:"Adet"},{key:"revenue",label:"Ciro"}])); toast.success("İndirildi");}}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Hizmet</th><th className="text-right px-4 py-2">Adet</th><th className="text-right px-4 py-2">Ciro</th></tr></thead>
              <tbody>{r.top_services.map(s=><tr key={s.name} className="border-t"><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2 text-right">{s.count}</td><td className="px-4 py-2 text-right font-medium">{fmtMoney(s.revenue)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">En Çok Kullanılan Parçalar</CardTitle>
            <Button variant="outline" size="sm" onClick={()=>{download("parca_raporu.csv", toCSV(r.top_parts,[{key:"name",label:"Parça"},{key:"qty",label:"Adet"},{key:"revenue",label:"Ciro"}])); toast.success("İndirildi");}}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Parça</th><th className="text-right px-4 py-2">Adet</th><th className="text-right px-4 py-2">Ciro</th></tr></thead>
              <tbody>{r.top_parts.map(p=><tr key={p.name} className="border-t"><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-right">{p.qty}</td><td className="px-4 py-2 text-right font-medium">{fmtMoney(p.revenue)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Kritik Stok</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Kod</th><th className="text-left px-4 py-2">Ad</th><th className="text-right px-4 py-2">Stok</th><th className="text-right px-4 py-2">Min</th></tr></thead>
              <tbody>
                {r.critical_stock.map(p=><tr key={p.id} className="border-t"><td className="px-4 py-2 font-mono">{p.code}</td><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-right text-red-600 font-bold">{p.stock}</td><td className="px-4 py-2 text-right">{p.min_stock}</td></tr>)}
                {r.critical_stock.length===0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Tüm stoklar iyi durumda</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

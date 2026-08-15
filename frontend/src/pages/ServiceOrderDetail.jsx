import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { fmtMoney, fmtDate, fmtDateShort, STATUS_META, STATUS_LIST } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import StatusBadge from "../components/StatusBadge";
import { toast } from "sonner";

export default function ServiceOrderDetail() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payOpen, setPayOpen] = useState(false);

  const load = () => api.get(`/service-orders/${id}`).then(r => setO(r.data));
  useEffect(() => { load(); }, [id]);

  if (!o) return <div>Yükleniyor…</div>;
  const remaining = (o.grand_total || 0) - (o.paid_total || 0);

  const changeStatus = async (s) => {
    await api.post(`/service-orders/${id}/status`, { status: s });
    toast.success("Durum güncellendi");
    load();
  };

  const doPayment = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error("Tutar giriniz");
    await api.post("/payments", { customer_id: o.customer_id, service_order_id: o.id, amount: amt, method: payMethod });
    toast.success("Tahsilat kaydedildi");
    setPayOpen(false); setPayAmount(""); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold">{o.service_no}</span>
            <StatusBadge status={o.status} />
          </div>
          <div className="text-sm text-slate-500 mt-1">{fmtDate(o.created_at)}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={o.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-56" data-testid="change-status"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_LIST.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-collect"><i className="mr-2">₺</i>Tahsilat Yap</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tahsilat</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="text-sm text-slate-600">Kalan: <span className="font-bold text-red-600">{fmtMoney(remaining)}</span></div>
                <div><Label>Tutar</Label><Input type="number" value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} data-testid="pay-amount" /></div>
                <div><Label>Ödeme Yöntemi</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Nakit</SelectItem>
                      <SelectItem value="card">Kredi Kartı</SelectItem>
                      <SelectItem value="transfer">Havale/EFT</SelectItem>
                      <SelectItem value="other">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={()=>setPayOpen(false)}>İptal</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={doPayment} data-testid="pay-submit">Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200"><CardContent className="p-5">
          <div className="text-xs uppercase text-slate-500">Müşteri</div>
          <Link to={`/customers/${o.customer_id}`} className="font-semibold hover:underline">{o.customer_name}</Link>
          <div className="text-sm text-slate-600 font-mono">{o.customer_phone}</div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5">
          <div className="text-xs uppercase text-slate-500">Motosiklet</div>
          <Link to={`/motorcycles/${o.motorcycle_id}`} className="font-semibold hover:underline">{o.brand} {o.model}</Link>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{o.plate}</span>
            <span>{o.km?.toLocaleString("tr-TR")} km</span>
          </div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5">
          <div className="text-xs uppercase text-slate-500">Ödeme Durumu</div>
          <div className="text-lg font-bold">{fmtMoney(o.grand_total)}</div>
          <div className="text-xs text-slate-500">Ödenen: {fmtMoney(o.paid_total)} · Kalan: <span className={remaining>0.01?"text-red-600 font-bold":"text-emerald-600"}>{fmtMoney(remaining)}</span></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Genel</TabsTrigger>
          <TabsTrigger value="items">Parçalar & İşçilik</TabsTrigger>
          <TabsTrigger value="payments">Ödemeler</TabsTrigger>
          <TabsTrigger value="history">Durum Geçmişi</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card className="border-slate-200"><CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Müşteri Şikayeti</h4><p className="text-sm">{o.complaint || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Arıza Tespiti</h4><p className="text-sm">{o.diagnosis || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Yapılacak İşlemler</h4><p className="text-sm">{o.operations || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Notlar</h4><p className="text-sm">{o.notes || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Yakıt / Aksesuarlar</h4>
              <p className="text-sm">Yakıt: {o.fuel_level}</p>
              <div className="flex flex-wrap gap-1 mt-1">{(o.accessories||[]).map(a=><span key={a} className="text-xs bg-slate-100 px-2 py-0.5 rounded">{a}</span>)}</div>
            </div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Arızalı Bölgeler</h4>
              <div className="flex flex-wrap gap-1">{(o.fault_zones||[]).map(f=><span key={f} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">{f}</span>)}</div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="items">
          <Card className="border-slate-200"><CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Tür</th><th className="text-left px-4 py-2">Ad</th><th className="text-right px-4 py-2">Adet</th><th className="text-right px-4 py-2">Birim</th><th className="text-right px-4 py-2">Toplam</th></tr></thead>
              <tbody>
                {o.items.map(it=>(
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded ${it.kind==="part"?"bg-blue-50 text-blue-700":"bg-emerald-50 text-emerald-700"}`}>{it.kind==="part"?"Parça":"Hizmet"}</span></td>
                    <td className="px-4 py-2">{it.name}</td>
                    <td className="px-4 py-2 text-right">{it.qty}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(it.unit_price)}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtMoney(it.qty*it.unit_price)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-slate-50"><td colSpan={4} className="text-right px-4 py-2 font-semibold">İşçilik</td><td className="text-right px-4 py-2">{fmtMoney(o.labor_total)}</td></tr>
                <tr className="bg-slate-50"><td colSpan={4} className="text-right px-4 py-2 font-semibold">İskonto</td><td className="text-right px-4 py-2 text-red-600">-{fmtMoney(o.discount)}</td></tr>
                <tr className="bg-slate-100"><td colSpan={4} className="text-right px-4 py-3 font-bold text-lg">Genel Toplam</td><td className="text-right px-4 py-3 font-bold text-lg">{fmtMoney(o.grand_total)}</td></tr>
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-slate-200"><CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Tarih</th><th className="text-left px-4 py-2">Tahsilat No</th><th className="text-left px-4 py-2">Yöntem</th><th className="text-right px-4 py-2">Tutar</th></tr></thead>
              <tbody>
                {o.payments.map(p=>(
                  <tr key={p.id} className="border-t"><td className="px-4 py-2">{fmtDateShort(p.created_at)}</td><td className="px-4 py-2 font-mono">{p.payment_no}</td><td className="px-4 py-2">{p.method}</td><td className="px-4 py-2 text-right font-semibold text-emerald-600">{fmtMoney(p.amount)}</td></tr>
                ))}
                {o.payments.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Henüz tahsilat yok</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-slate-200"><CardContent className="p-5">
            <ul className="space-y-3">
              {(o.status_history||[]).map((h, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="h-2 w-2 bg-orange-500 rounded-full"></span>
                  <StatusBadge status={h.status} />
                  <span className="text-sm text-slate-600">{fmtDate(h.at)}</span>
                  <span className="text-xs text-slate-500">— {h.by}</span>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

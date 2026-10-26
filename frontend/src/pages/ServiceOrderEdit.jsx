import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { fmtMoney, STATUS_META, STATUS_LIST } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Trash2, Save } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { toast } from "sonner";
import FaultDiagram from "../components/FaultDiagram";
import { documentTotals, lineAmounts, DEFAULT_VAT } from "../lib/pricing";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import DocumentTotals from "../components/DocumentTotals";

const ACCESSORY_OPTS = ["Kask", "Telefon Tutucu", "Çanta", "Topcase", "Yan Çanta", "Navigasyon"];
const FUEL_OPTS = ["Boş", "1/4", "1/2", "3/4", "Dolu"];

export default function ServiceOrderEdit() {
  const nav = useNavigate();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [partKey, setPartKey] = useState(0);
  const [svcKey, setSvcKey] = useState(0);
  const [initialStatus, setInitialStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/service-orders/${id}`)
      .then(r => { setOrder(r.data); setInitialStatus(r.data.status); })
      .catch(() => toast.error("Servis kaydı yüklenemedi"));
    api.get("/products").then(r => setProducts(r.data));
    api.get("/service-catalog").then(r => setServices(r.data));
  }, [id]);

  const update = (patch) => setOrder({ ...order, ...patch });

  const addPart = (p) => update({ items: [...order.items, { id: crypto.randomUUID(), kind: "part", ref_id: p.id, name: p.name, qty: 1, unit_price: p.sale_price, vat: p.vat ?? DEFAULT_VAT, price_mode: p.price_mode || "incl" }] });
  const addService = (s) => update({ items: [...order.items, { id: crypto.randomUUID(), kind: "service", ref_id: s.id, name: s.name, qty: 1, unit_price: s.price, vat: s.vat ?? DEFAULT_VAT, price_mode: s.price_mode || "incl" }] });
  const updItem = (idx, patch) => update({ items: order.items.map((i, x) => x === idx ? { ...i, ...patch } : i) });
  const rmItem = (idx) => update({ items: order.items.filter((_, x) => x !== idx) });

  const totals = useMemo(() => {
    if (!order) return null;
    return documentTotals({
      items: order.items, labor_total: order.labor_total,
      labor_price_mode: order.labor_price_mode || "incl", labor_vat: order.labor_vat ?? DEFAULT_VAT, discount: order.discount,
    });
  }, [order]);


  const toggleAcc = (a) => update({ accessories: order.accessories.includes(a) ? order.accessories.filter(x=>x!==a) : [...order.accessories, a] });
  const toggleFault = (k) => update({ fault_zones: order.fault_zones.includes(k) ? order.fault_zones.filter(x=>x!==k) : [...order.fault_zones, k] });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Durum değişimi PUT ile yapılmaz; yalnızca /status endpoint'i ile kaydedilir.
      await api.put(`/service-orders/${id}`, {
        customer_id: order.customer_id, motorcycle_id: order.motorcycle_id,
        km: Number(order.km) || 0, fuel_level: order.fuel_level,
        accessories: order.accessories, fault_zones: order.fault_zones,
        complaint: order.complaint, diagnosis: order.diagnosis, operations: order.operations,
        notes: order.notes, items: order.items,
        labor_total: Number(order.labor_total) || 0, labor_price_mode: order.labor_price_mode || "incl",
        labor_vat: Number(order.labor_vat ?? DEFAULT_VAT), discount: Number(order.discount) || 0,
      });
      if (order.status !== initialStatus) {
        await api.post(`/service-orders/${id}/status`, { status: order.status });
      }
      toast.success("Değişiklikler kaydedildi");
      nav(`/service-orders/${id}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Kayıt başarısız"); }
    finally { setSaving(false); }
  };

  if (!order) return <div>Yükleniyor…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servis Düzenle"
        description={<span className="font-mono">{order.service_no}</span>}
        actions={
          <>
            <Button variant="outline" onClick={() => nav(`/service-orders/${id}`)}>Vazgeç</Button>
            <Button className="bg-brand-500 hover:bg-brand-600" onClick={save} disabled={saving} data-testid="edit-save"><Save className="h-4 w-4 mr-2" />Kaydet</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader><CardTitle className="text-base">Genel</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Kilometre</Label><Input type="number" value={order.km || ""} onChange={(e)=>update({ km: e.target.value })} /></div>
            <div><Label>Yakıt</Label>
              <Select value={order.fuel_level || "1/2"} onValueChange={(v)=>update({ fuel_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FUEL_OPTS.map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Durum</Label>
              <Select value={order.status} onValueChange={(v)=>update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_LIST.map(s=><SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Aksesuarlar</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ACCESSORY_OPTS.map(a => (
                  <button key={a} type="button" onClick={()=>toggleAcc(a)}
                    className={`text-xs px-3 py-1.5 rounded-md border ${(order.accessories||[]).includes(a) ? "bg-brand-500 text-white border-brand-500" : "bg-white border-slate-200 text-slate-700"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2"><Label>Müşteri Şikayeti</Label><Textarea rows={2} value={order.complaint || ""} onChange={(e)=>update({ complaint: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Arıza Tespiti</Label><Textarea rows={2} value={order.diagnosis || ""} onChange={(e)=>update({ diagnosis: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Yapılan İşlemler</Label><Textarea rows={2} value={order.operations || ""} onChange={(e)=>update({ operations: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Notlar</Label><Textarea rows={2} value={order.notes || ""} onChange={(e)=>update({ notes: e.target.value })} /></div>
          </CardContent>
        </Card>
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Arızalı Bölgeler</CardTitle></CardHeader>
          <CardContent><FaultDiagram selected={order.fault_zones || []} onToggle={toggleFault} motoType={order.motorcycle?.type || order.moto_type} /></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="flex-row justify-between items-center">
          <CardTitle className="text-base">Parçalar & Yapılan İşler</CardTitle>
          <div className="flex gap-2">
            <Select key={`ep-${partKey}`} value="" onValueChange={(v)=>{const p=products.find(x=>x.id===v); if(p){ addPart(p); setPartKey(k=>k+1); }}}>
              <SelectTrigger className="w-48" data-testid="edit-add-part"><SelectValue placeholder="Parça ekle" /></SelectTrigger>
              <SelectContent>{products.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</SelectItem>)}</SelectContent>
            </Select>
            <Select key={`es-${svcKey}`} value="" onValueChange={(v)=>{const s=services.find(x=>x.id===v); if(s){ addService(s); setSvcKey(k=>k+1); }}}>
              <SelectTrigger className="w-48" data-testid="edit-add-service"><SelectValue placeholder="Hizmet ekle" /></SelectTrigger>
              <SelectContent>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.name} · {fmtMoney(s.price)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="text-left px-4 py-2">Tür</th><th className="text-left px-4 py-2">Ad</th><th className="text-right px-4 py-2 w-24">Adet</th><th className="text-right px-4 py-2 w-32">Birim ₺</th><th className="text-right px-4 py-2 w-40">Fiyat tipi</th><th className="text-right px-4 py-2 w-24">KDV</th><th className="text-right px-4 py-2 w-32">Toplam (KDV dahil)</th><th className="w-10"></th></tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => (
                <tr key={it.id || idx} className="border-t">
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded ${it.kind==="part"?"bg-blue-50 text-blue-700":"bg-emerald-50 text-emerald-700"}`}>{it.kind==="part"?"Parça":"Hizmet"}</span></td>
                  <td className="px-4 py-2"><Input value={it.name} onChange={(e)=>updItem(idx,{name:e.target.value})} className="h-8" data-testid={`item-name-${idx}`} /></td>
                  <td className="px-4 py-2"><Input type="number" value={it.qty} onChange={(e)=>updItem(idx,{qty:Number(e.target.value)||0})} className="h-8 text-right" data-testid={`item-qty-${idx}`} /></td>
                  <td className="px-4 py-2"><Input type="number" value={it.unit_price} onChange={(e)=>updItem(idx,{unit_price:Number(e.target.value)||0})} className="h-8 text-right" data-testid={`item-price-${idx}`} /></td>
                  <td className="px-4 py-2"><PriceModeSelect value={it.price_mode} onChange={(v)=>updItem(idx,{price_mode:v})} /></td>
                  <td className="px-4 py-2"><VatSelect value={it.vat} onChange={(v)=>updItem(idx,{vat:v})} /></td>
                  <td className="px-4 py-2 text-right font-medium">{fmtMoney(lineAmounts(it).gross)}</td>
                  <td className="px-4 py-2"><button onClick={()=>rmItem(idx)} className="text-red-500 hover:text-red-700" data-testid={`item-del-${idx}`}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {order.items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Kalem yok</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200"><CardContent className="p-5 grid grid-cols-2 gap-4">
          <div><Label>Ek İşçilik (₺)</Label><Input type="number" value={order.labor_total || 0} onChange={(e)=>update({ labor_total: e.target.value })} /></div>
          <div><Label>İşçilik fiyat tipi</Label><PriceModeSelect value={order.labor_price_mode || "incl"} onChange={(v)=>update({ labor_price_mode: v })} /></div>
          <div><Label>İşçilik KDV</Label><VatSelect value={order.labor_vat ?? DEFAULT_VAT} onChange={(v)=>update({ labor_vat: v })} /></div>
          <div><Label>İskonto (₺)</Label><Input type="number" value={order.discount || 0} onChange={(e)=>update({ discount: e.target.value })} /></div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5">
          <DocumentTotals t={totals} />
          <Button onClick={save} disabled={saving} className="w-full mt-4 h-11 bg-brand-500 hover:bg-brand-600 font-semibold"><Save className="h-4 w-4 mr-2" />Kaydet</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

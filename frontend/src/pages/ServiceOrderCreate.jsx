import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import FaultDiagram from "../components/FaultDiagram";

const ACCESSORY_OPTS = ["Kask", "Telefon Tutucu", "Çanta", "Topcase", "Yan Çanta", "Navigasyon"];
const FUEL_OPTS = ["Boş", "1/4", "1/2", "3/4", "Dolu"];

export default function ServiceOrderCreate() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [motos, setMotos] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);

  const [customerId, setCustomerId] = useState("");
  const [motoId, setMotoId] = useState("");
  const [km, setKm] = useState("");
  const [fuel, setFuel] = useState("1/2");
  const [accessories, setAccessories] = useState([]);
  const [faults, setFaults] = useState([]);
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [operations, setOperations] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [labor, setLabor] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState("new");

  useEffect(() => { api.get("/customers").then(r=>setCustomers(r.data)); }, []);
  useEffect(() => { api.get("/products").then(r=>setProducts(r.data)); api.get("/service-catalog").then(r=>setServices(r.data)); }, []);
  useEffect(() => {
    if (!customerId) return setMotos([]);
    api.get(`/motorcycles?customer_id=${customerId}`).then(r=>{ setMotos(r.data); setMotoId(""); });
  }, [customerId]);
  useEffect(() => {
    const m = motos.find(x => x.id === motoId);
    if (m) setKm(String(m.km || ""));
  }, [motoId, motos]);

  const addPart = (p) => setItems([...items, { id: crypto.randomUUID(), kind: "part", ref_id: p.id, name: p.name, qty: 1, unit_price: p.sale_price, vat: p.vat || 20 }]);
  const addService = (s) => setItems([...items, { id: crypto.randomUUID(), kind: "service", ref_id: s.id, name: s.name, qty: 1, unit_price: s.price, vat: s.vat || 20 }]);
  const updItem = (id, patch) => setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  const rmItem = (id) => setItems(items.filter(i => i.id !== id));

  const totals = useMemo(() => {
    const parts = items.filter(i=>i.kind==="part").reduce((s,i)=>s+i.qty*i.unit_price,0);
    const svcs = items.filter(i=>i.kind==="service").reduce((s,i)=>s+i.qty*i.unit_price,0);
    const grand = parts + svcs + Number(labor||0) - Number(discount||0);
    return { parts, svcs, grand };
  }, [items, labor, discount]);

  const toggleAcc = (a) => setAccessories(accessories.includes(a) ? accessories.filter(x=>x!==a) : [...accessories, a]);
  const toggleFault = (k) => setFaults(faults.includes(k) ? faults.filter(x=>x!==k) : [...faults, k]);

  const save = async () => {
    if (!customerId || !motoId) return toast.error("Müşteri ve motosiklet seçin");
    try {
      const { data } = await api.post("/service-orders", {
        customer_id: customerId, motorcycle_id: motoId, km: Number(km) || 0, fuel_level: fuel,
        accessories, fault_zones: faults, complaint, diagnosis, operations, notes,
        items, labor_total: Number(labor) || 0, discount: Number(discount) || 0, status,
      });
      toast.success(`Servis oluşturuldu: ${data.service_no}`);
      nav(`/service-orders/${data.id}`);
    } catch (e) { toast.error("Kayıt başarısız"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Yeni Servis Kaydı</h1>
        <p className="text-sm text-slate-500 mt-1">İş emri oluşturmak için müşteri, motosiklet ve arıza bilgilerini girin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader><CardTitle className="text-base">Müşteri & Motosiklet</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Müşteri *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="so-customer"><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
                <SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Motosiklet *</Label>
              <Select value={motoId} onValueChange={setMotoId} disabled={!customerId}>
                <SelectTrigger data-testid="so-motorcycle"><SelectValue placeholder={customerId ? "Motosiklet seç" : "Önce müşteri seçin"} /></SelectTrigger>
                <SelectContent>{motos.map(m=><SelectItem key={m.id} value={m.id}>{m.brand} {m.model} · {m.plate}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Kilometre</Label><Input type="number" value={km} onChange={(e)=>setKm(e.target.value)} data-testid="so-km" /></div>
            <div>
              <Label>Yakıt</Label>
              <Select value={fuel} onValueChange={setFuel}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FUEL_OPTS.map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Aksesuarlar</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ACCESSORY_OPTS.map(a => (
                  <button key={a} type="button" onClick={()=>toggleAcc(a)}
                    className={`text-xs px-3 py-1.5 rounded-md border ${accessories.includes(a) ? "bg-orange-500 text-white border-orange-500" : "bg-white border-slate-200 text-slate-700"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2"><Label>Müşteri Şikayeti</Label><Textarea rows={2} value={complaint} onChange={(e)=>setComplaint(e.target.value)} data-testid="so-complaint" /></div>
            <div className="md:col-span-2"><Label>Arıza Tespiti</Label><Textarea rows={2} value={diagnosis} onChange={(e)=>setDiagnosis(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Yapılacak İşlemler</Label><Textarea rows={2} value={operations} onChange={(e)=>setOperations(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Arızalı Bölgeler</CardTitle></CardHeader>
          <CardContent><FaultDiagram selected={faults} onToggle={toggleFault} /></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200"><CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">Parçalar & Hizmetler</CardTitle>
        <div className="flex gap-2">
          <Select onValueChange={(v)=>{const p=products.find(x=>x.id===v); if(p) addPart(p);}}>
            <SelectTrigger className="w-48" data-testid="add-part"><SelectValue placeholder="Parça ekle" /></SelectTrigger>
            <SelectContent>{products.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v)=>{const s=services.find(x=>x.id===v); if(s) addService(s);}}>
            <SelectTrigger className="w-48" data-testid="add-service"><SelectValue placeholder="Hizmet ekle" /></SelectTrigger>
            <SelectContent>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.name} · {fmtMoney(s.price)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left px-4 py-2">Tür</th><th className="text-left px-4 py-2">Ad</th><th className="text-right px-4 py-2 w-24">Adet</th><th className="text-right px-4 py-2 w-32">Birim ₺</th><th className="text-right px-4 py-2 w-32">Toplam</th><th className="w-10"></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded ${it.kind==="part"?"bg-blue-50 text-blue-700":"bg-emerald-50 text-emerald-700"}`}>{it.kind==="part"?"Parça":"Hizmet"}</span></td>
                <td className="px-4 py-2">{it.name}</td>
                <td className="px-4 py-2"><Input type="number" value={it.qty} onChange={(e)=>updItem(it.id,{qty:Number(e.target.value)||0})} className="h-8 text-right" /></td>
                <td className="px-4 py-2"><Input type="number" value={it.unit_price} onChange={(e)=>updItem(it.id,{unit_price:Number(e.target.value)||0})} className="h-8 text-right" /></td>
                <td className="px-4 py-2 text-right font-medium">{fmtMoney(it.qty*it.unit_price)}</td>
                <td className="px-4 py-2"><button onClick={()=>rmItem(it.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Henüz parça veya hizmet eklenmedi</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200"><CardContent className="p-5 grid grid-cols-2 gap-4">
          <div><Label>Ek İşçilik (₺)</Label><Input type="number" value={labor} onChange={(e)=>setLabor(e.target.value)} /></div>
          <div><Label>İskonto (₺)</Label><Input type="number" value={discount} onChange={(e)=>setDiscount(e.target.value)} /></div>
          <div className="col-span-2"><Label>Notlar</Label><Textarea rows={2} value={notes} onChange={(e)=>setNotes(e.target.value)} /></div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Parçalar</span><span>{fmtMoney(totals.parts)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Hizmet</span><span>{fmtMoney(totals.svcs)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">İşçilik</span><span>{fmtMoney(labor)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">İskonto</span><span className="text-red-600">-{fmtMoney(discount)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Genel Toplam</span><span>{fmtMoney(totals.grand)}</span></div>
          </div>
          <Button onClick={save} className="w-full mt-4 h-11 bg-orange-500 hover:bg-orange-600 font-semibold" data-testid="so-save">
            <Plus className="h-4 w-4 mr-2" /> Servisi Oluştur
          </Button>
        </CardContent></Card>
      </div>
    </div>
  );
}

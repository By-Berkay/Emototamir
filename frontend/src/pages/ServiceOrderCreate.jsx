import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Trash2, Plus, UserPlus, Bike as BikeIcon, Package } from "lucide-react";
import { toast } from "sonner";
import FaultDiagram from "../components/FaultDiagram";
import { documentTotals, lineAmounts, DEFAULT_VAT } from "../lib/pricing";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import DocumentTotals from "../components/DocumentTotals";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { MOTO_TYPES } from "../lib/api";
import MotorcycleIllustration from "../components/MotorcycleIllustration";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

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
  const [laborMode, setLaborMode] = useState("incl");
  const [laborVat, setLaborVat] = useState(DEFAULT_VAT);
  const [status, setStatus] = useState("new");
  const [partKey, setPartKey] = useState(0);
  const [svcKey, setSvcKey] = useState(0);
  const [saving, setSaving] = useState(false);

  // Quick add dialogs
  const [custOpen, setCustOpen] = useState(false);
  const [custForm, setCustForm] = useState({ first_name:"", last_name:"", phone:"", tc_no:"", email:"", city:"", district:"", address:"", notes:"" });
  const [motoOpen, setMotoOpen] = useState(false);
  const [motoForm, setMotoForm] = useState({ brand:"", model:"", year:"", type:"Naked", engine_cc:"", plate:"", vin:"", color:"" });

  useEffect(() => { api.get("/customers").then(r=>setCustomers(r.data)); }, []);
  useEffect(() => { api.get("/products").then(r=>setProducts(r.data)); api.get("/service-catalog").then(r=>setServices(r.data)); }, []);
  useEffect(() => {
    if (!customerId) return setMotos([]);
    api.get(`/motorcycles?customer_id=${customerId}`).then(r=>{ setMotos(r.data); setMotoId(""); });
  }, [customerId]);
  useEffect(() => {
    // Yalnızca motosiklet seçimi değişince km doldur; liste yenilenince kullanıcının girdiği km ezilmesin.
    const m = motos.find(x => x.id === motoId);
    if (m) setKm(String(m.km || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motoId]);

  const addPart = (p) => setItems([...items, { id: crypto.randomUUID(), kind: "part", ref_id: p.id, name: p.name, qty: 1, unit_price: p.sale_price, vat: p.vat ?? DEFAULT_VAT, price_mode: p.price_mode || "incl" }]);
  const addService = (s) => setItems([...items, { id: crypto.randomUUID(), kind: "service", ref_id: s.id, name: s.name, qty: 1, unit_price: s.price, vat: s.vat ?? DEFAULT_VAT, price_mode: s.price_mode || "incl" }]);
  const updItem = (id, patch) => setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  const rmItem = (id) => setItems(items.filter(i => i.id !== id));

  const totals = useMemo(
    () => documentTotals({ items, labor_total: labor, labor_price_mode: laborMode, labor_vat: laborVat, discount }),
    [items, labor, laborMode, laborVat, discount]
  );


  const toggleAcc = (a) => setAccessories(accessories.includes(a) ? accessories.filter(x=>x!==a) : [...accessories, a]);
  const toggleFault = (k) => setFaults(faults.includes(k) ? faults.filter(x=>x!==k) : [...faults, k]);

  const saveCustomer = async () => {
    if (!custForm.first_name || !custForm.last_name || !custForm.phone) return toast.error("Ad, soyad, telefon zorunlu");
    // duplicate check
    try {
      const q = new URLSearchParams();
      if (custForm.phone) q.set("phone", custForm.phone);
      if (custForm.tc_no) q.set("tc_no", custForm.tc_no);
      const { data: dups } = await api.get(`/customers/duplicates/search?${q}`);
      if (dups.length > 0) {
        const d = dups[0];
        const ok = window.confirm(`Bu bilgilerle eşleşen müşteri var:\n\n${d.first_name} ${d.last_name} · ${d.phone}\n\nEvet: mevcut müşteriyle devam et\nHayır: yeni müşteri oluştur`);
        if (ok) {
          setCustomerId(d.id); await refreshCustomers(); setCustOpen(false); toast.success("Mevcut müşteri seçildi"); return;
        }
      }
      const { data } = await api.post("/customers", custForm);
      await refreshCustomers(); setCustomerId(data.id); setCustOpen(false); toast.success("Müşteri eklendi");
    } catch { toast.error("Kayıt başarısız"); }
  };

  const saveMoto = async () => {
    if (!customerId) return toast.error("Önce müşteri seçin");
    if (!motoForm.brand || !motoForm.model || !motoForm.plate) return toast.error("Marka, model, plaka zorunlu");
    try {
      const q = new URLSearchParams();
      if (motoForm.plate) q.set("plate", motoForm.plate.toUpperCase().replace(/\s/g, ""));
      if (motoForm.vin) q.set("vin", motoForm.vin);
      const { data: dups } = await api.get(`/motorcycles/duplicates/search?${q}`);
      if (dups.length > 0) {
        const d = dups[0];
        const ok = window.confirm(`Bu plaka/şase ile motosiklet var:\n\n${d.brand} ${d.model} · ${d.plate}\n\nEvet: mevcut motosiklet seçilsin\nHayır: yeni motosiklet oluştur`);
        if (ok) {
          setMotoId(d.id); await refreshMotos(); setMotoOpen(false); toast.success("Mevcut motosiklet seçildi"); return;
        }
      }
      const payload = { ...motoForm, customer_id: customerId, year: motoForm.year ? Number(motoForm.year) : null, engine_cc: motoForm.engine_cc ? Number(motoForm.engine_cc) : null, km: 0 };
      const { data } = await api.post("/motorcycles", payload);
      await refreshMotos(); setMotoId(data.id); setMotoOpen(false); toast.success("Motosiklet eklendi");
    } catch { toast.error("Kayıt başarısız"); }
  };
  const refreshCustomers = async () => { const { data } = await api.get("/customers"); setCustomers(data); };
  const refreshMotos = async () => { if (!customerId) return; const { data } = await api.get(`/motorcycles?customer_id=${customerId}`); setMotos(data); };

  const save = async () => {
    if (!customerId || !motoId) return toast.error("Müşteri ve motosiklet seçin");
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await api.post("/service-orders", {
        customer_id: customerId, motorcycle_id: motoId, km: Number(km) || 0, fuel_level: fuel,
        accessories, fault_zones: faults, complaint, diagnosis, operations, notes,
        items, labor_total: Number(labor) || 0, labor_price_mode: laborMode, labor_vat: Number(laborVat),
        discount: Number(discount) || 0, status,
      });
      toast.success(`Servis oluşturuldu: ${data.service_no}`);
      nav(`/service-orders/${data.id}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Kayıt başarısız"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Yeni Servis Kaydı" description="İş emri oluşturmak için müşteri, motosiklet ve arıza bilgilerini girin." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader><CardTitle className="text-base">Müşteri & Motosiklet</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label>Müşteri *</Label>
                <Button type="button" size="sm" variant="outline" onClick={()=>setCustOpen(true)} data-testid="quick-add-customer"><UserPlus className="h-3.5 w-3.5 mr-1" />Yeni Müşteri</Button>
              </div>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="so-customer"><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
                <SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label>Motosiklet *</Label>
                <Button type="button" size="sm" variant="outline" disabled={!customerId} onClick={()=>setMotoOpen(true)} data-testid="quick-add-moto"><BikeIcon className="h-3.5 w-3.5 mr-1" />Yeni Motosiklet</Button>
              </div>
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
                    className={`text-xs px-3 py-1.5 rounded-md border ${accessories.includes(a) ? "bg-brand-500 text-white border-brand-500" : "bg-white border-slate-200 text-slate-700"}`}>
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
          <CardContent><FaultDiagram selected={faults} onToggle={toggleFault} motoType={motos.find(x => x.id === motoId)?.type} /></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200"><CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">Parçalar & Hizmetler</CardTitle>
        <div className="flex gap-2">
          <Select key={`p-${partKey}`} value="" onValueChange={(v)=>{const p=products.find(x=>x.id===v); if(p){ addPart(p); setPartKey(k=>k+1); }}}>
            <SelectTrigger className="w-48" data-testid="add-part"><SelectValue placeholder="Parça ekle" /></SelectTrigger>
            <SelectContent>{products.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</SelectItem>)}</SelectContent>
          </Select>
          <Select key={`s-${svcKey}`} value="" onValueChange={(v)=>{const s=services.find(x=>x.id===v); if(s){ addService(s); setSvcKey(k=>k+1); }}}>
            <SelectTrigger className="w-48" data-testid="add-service"><SelectValue placeholder="Hizmet ekle" /></SelectTrigger>
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
            {items.map(it => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded ${it.kind==="part"?"bg-blue-50 text-blue-700":"bg-emerald-50 text-emerald-700"}`}>{it.kind==="part"?"Parça":"Hizmet"}</span></td>
                <td className="px-4 py-2">{it.name}</td>
                <td className="px-4 py-2"><Input type="number" value={it.qty} onChange={(e)=>updItem(it.id,{qty:Number(e.target.value)||0})} className="h-8 text-right" /></td>
                <td className="px-4 py-2"><Input type="number" value={it.unit_price} onChange={(e)=>updItem(it.id,{unit_price:Number(e.target.value)||0})} className="h-8 text-right" /></td>
                <td className="px-4 py-2"><PriceModeSelect value={it.price_mode} onChange={(v)=>updItem(it.id,{price_mode:v})} /></td>
                <td className="px-4 py-2"><VatSelect value={it.vat} onChange={(v)=>updItem(it.id,{vat:v})} /></td>
                <td className="px-4 py-2 text-right font-medium">{fmtMoney(lineAmounts(it).gross)}</td>
                <td className="px-4 py-2"><button onClick={()=>rmItem(it.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8}><EmptyState icon={Package} title="Henüz parça veya hizmet eklenmedi" /></td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200"><CardContent className="p-5 grid grid-cols-2 gap-4">
          <div><Label>Ek İşçilik (₺)</Label><Input type="number" value={labor} onChange={(e)=>setLabor(e.target.value)} /></div>
          <div><Label>İşçilik fiyat tipi</Label><PriceModeSelect value={laborMode} onChange={setLaborMode} /></div>
          <div><Label>İşçilik KDV</Label><VatSelect value={laborVat} onChange={setLaborVat} /></div>
          <div><Label>İskonto (₺)</Label><Input type="number" value={discount} onChange={(e)=>setDiscount(e.target.value)} /></div>
          <div className="col-span-2"><Label>Notlar</Label><Textarea rows={2} value={notes} onChange={(e)=>setNotes(e.target.value)} /></div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5">
          <DocumentTotals t={totals} />
          <Button onClick={save} disabled={saving} className="w-full mt-4 h-11 bg-brand-500 hover:bg-brand-600 font-semibold" data-testid="so-save">
            <Plus className="h-4 w-4 mr-2" /> Servisi Oluştur
          </Button>
        </CardContent></Card>
      </div>

      {/* Quick add customer */}
      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Hızlı Müşteri Ekle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Ad *</Label><Input value={custForm.first_name} onChange={(e)=>setCustForm({...custForm,first_name:e.target.value})} data-testid="qa-first" /></div>
            <div><Label>Soyad *</Label><Input value={custForm.last_name} onChange={(e)=>setCustForm({...custForm,last_name:e.target.value})} data-testid="qa-last" /></div>
            <div><Label>Telefon *</Label><Input value={custForm.phone} onChange={(e)=>setCustForm({...custForm,phone:e.target.value})} data-testid="qa-phone" /></div>
            <div><Label>TC No</Label><Input value={custForm.tc_no} onChange={(e)=>setCustForm({...custForm,tc_no:e.target.value})} /></div>
            <div><Label>E-posta</Label><Input value={custForm.email} onChange={(e)=>setCustForm({...custForm,email:e.target.value})} /></div>
            <div><Label>İl</Label><Input value={custForm.city} onChange={(e)=>setCustForm({...custForm,city:e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setCustOpen(false)}>Vazgeç</Button><Button className="bg-brand-500 hover:bg-brand-600" onClick={saveCustomer} data-testid="qa-save-customer">Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick add motorcycle */}
      <Dialog open={motoOpen} onOpenChange={setMotoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Hızlı Motosiklet Ekle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div><Label>Marka *</Label><Input value={motoForm.brand} onChange={(e)=>setMotoForm({...motoForm,brand:e.target.value})} data-testid="qa-brand" /></div>
              <div><Label>Model *</Label><Input value={motoForm.model} onChange={(e)=>setMotoForm({...motoForm,model:e.target.value})} data-testid="qa-model" /></div>
              <div><Label>Yıl</Label><Input type="number" value={motoForm.year} onChange={(e)=>setMotoForm({...motoForm,year:e.target.value})} /></div>
              <div><Label>Tip</Label>
                <Select value={motoForm.type} onValueChange={(v)=>setMotoForm({...motoForm,type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOTO_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Motor (cc)</Label><Input type="number" value={motoForm.engine_cc} onChange={(e)=>setMotoForm({...motoForm,engine_cc:e.target.value})} /></div>
              <div><Label>Renk</Label><Input value={motoForm.color} onChange={(e)=>setMotoForm({...motoForm,color:e.target.value})} /></div>
              <div><Label>Plaka *</Label><Input value={motoForm.plate} onChange={(e)=>setMotoForm({...motoForm,plate:e.target.value.toUpperCase()})} className="font-mono" data-testid="qa-plate" /></div>
              <div><Label>Şase/VIN</Label><Input value={motoForm.vin} onChange={(e)=>setMotoForm({...motoForm,vin:e.target.value})} className="font-mono" /></div>
            </div>
            <div><Label>Önizleme</Label><MotorcycleIllustration type={motoForm.type} className="w-full h-32" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setMotoOpen(false)}>Vazgeç</Button><Button className="bg-brand-500 hover:bg-brand-600" onClick={saveMoto} data-testid="qa-save-moto">Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

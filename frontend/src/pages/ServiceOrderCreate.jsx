import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtMoney, MOTO_TYPES } from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Trash2, Plus, UserPlus, Bike as BikeIcon, Package, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import FaultViewer from "../components/FaultViewer";
import { documentTotals, lineAmounts, DEFAULT_VAT } from "../lib/pricing";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import DocumentTotals from "../components/DocumentTotals";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import EmptyState from "../components/EmptyState";
import { HeroBanner, Panel, StatusBadge, DataTable } from "../components/design/kit";
import { cn } from "../lib/utils";

const ACCESSORY_OPTS = ["Kask", "Telefon Tutucu", "Çanta", "Topcase", "Yan Çanta", "Navigasyon"];
const FUEL_OPTS = ["Boş", "1/4", "1/2", "3/4", "Dolu"];

// Koyu tema form sınıfları (ui bileşenlerinin açık varsayılanlarını geçersiz kılar)
const FIELD = "border-white/10 bg-slate-900/60 text-white placeholder:text-slate-500 focus-visible:ring-orange-500/40";
const SELECT = "h-10 border-white/10 bg-slate-900/60 text-white";
const LABEL = "text-xs font-medium text-slate-300";
const BTN_PRIMARY = "bg-orange-500 text-white shadow-sm hover:bg-orange-600";
const BTN_GHOST = "border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10 hover:text-white";
const NATIVE_SELECT = "[&_select]:!border-white/10 [&_select]:!bg-slate-900/60 [&_select]:!text-white";
const TOTALS = "[&_.text-slate-400]:!text-slate-400 [&_.border-t]:!border-white/10 [&_.text-red-600]:!text-rose-400 [&_.text-emerald-700]:!text-emerald-300 [&_.text-lg]:!text-2xl [&_.text-lg]:!text-orange-400";
const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2";
const TH = "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400";
const THR = "px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400";

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

  const selectedMoto = motos.find(x => x.id === motoId);

  return (
    <div className="space-y-6 pb-8">
      <HeroBanner
        eyebrow="Servis"
        title="Yeni Servis Kaydı"
        subtitle="İş emri oluşturmak için müşteri, motosiklet ve arıza bilgilerini girin."
        slot="service_detail_hero"
        actions={
          <Button variant="outline" className={BTN_GHOST} onClick={() => nav("/service-orders")}>
            <ArrowLeft className="h-4 w-4" /> Servislere dön
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Müşteri ve motosiklet" subtitle="Kayıtlı müşteri ve araç seçin ya da hızlıca yeni ekleyin.">
            <div className={GRID}>
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label className={LABEL}>Müşteri *</Label>
                  <Button type="button" size="sm" variant="outline" className={BTN_GHOST} onClick={()=>setCustOpen(true)} data-testid="quick-add-customer"><UserPlus className="h-3.5 w-3.5 mr-1" />Yeni Müşteri</Button>
                </div>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className={SELECT} data-testid="so-customer"><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
                  <SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label className={LABEL}>Motosiklet *</Label>
                  <Button type="button" size="sm" variant="outline" className={BTN_GHOST} disabled={!customerId} onClick={()=>setMotoOpen(true)} data-testid="quick-add-moto"><BikeIcon className="h-3.5 w-3.5 mr-1" />Yeni Motosiklet</Button>
                </div>
                <Select value={motoId} onValueChange={setMotoId} disabled={!customerId}>
                  <SelectTrigger className={SELECT} data-testid="so-motorcycle"><SelectValue placeholder={customerId ? "Motosiklet seç" : "Önce müşteri seçin"} /></SelectTrigger>
                  <SelectContent>{motos.map(m=><SelectItem key={m.id} value={m.id}>{m.brand} {m.model} · {m.plate}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={LABEL}>Kilometre</Label>
                <Input type="number" value={km} onChange={(e)=>setKm(e.target.value)} className={FIELD} data-testid="so-km" />
              </div>
              <div className="space-y-1.5">
                <Label className={LABEL}>Yakıt</Label>
                <Select value={fuel} onValueChange={setFuel}><SelectTrigger className={SELECT}><SelectValue /></SelectTrigger>
                  <SelectContent>{FUEL_OPTS.map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </Panel>

          <Panel title="Arıza ve işlemler" subtitle="Müşteri şikayeti, tespit edilen arıza ve yapılacak işler.">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className={LABEL}>Aksesuarlar</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCESSORY_OPTS.map(a => (
                    <button key={a} type="button" onClick={()=>toggleAcc(a)}
                      className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        accessories.includes(a) ? "border-orange-500 bg-orange-500 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5"><Label className={LABEL}>Müşteri Şikayeti</Label><Textarea rows={2} value={complaint} onChange={(e)=>setComplaint(e.target.value)} className={FIELD} data-testid="so-complaint" /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Arıza Tespiti</Label><Textarea rows={2} value={diagnosis} onChange={(e)=>setDiagnosis(e.target.value)} className={FIELD} /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Yapılacak İşlemler</Label><Textarea rows={2} value={operations} onChange={(e)=>setOperations(e.target.value)} className={FIELD} /></div>
            </div>
          </Panel>

          <Panel
            title="Parçalar ve hizmetler"
            subtitle="Katalogdan parça veya hizmet ekleyin; adet ve fiyatları tablodan düzenleyin."
            action={
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Select key={`p-${partKey}`} value="" onValueChange={(v)=>{const p=products.find(x=>x.id===v); if(p){ addPart(p); setPartKey(k=>k+1); }}}>
                  <SelectTrigger className={cn(SELECT, "h-9 w-full sm:w-48")} data-testid="add-part"><SelectValue placeholder="Parça ekle" /></SelectTrigger>
                  <SelectContent>{products.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</SelectItem>)}</SelectContent>
                </Select>
                <Select key={`s-${svcKey}`} value="" onValueChange={(v)=>{const s=services.find(x=>x.id===v); if(s){ addService(s); setSvcKey(k=>k+1); }}}>
                  <SelectTrigger className={cn(SELECT, "h-9 w-full sm:w-48")} data-testid="add-service"><SelectValue placeholder="Hizmet ekle" /></SelectTrigger>
                  <SelectContent>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.name} · {fmtMoney(s.price)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            }
          >
            <div className={NATIVE_SELECT}>
              <DataTable>
                <thead className="bg-white/5">
                  <tr><th className={TH}>Tür</th><th className={TH}>Ad</th><th className={cn(THR, "w-24")}>Adet</th><th className={cn(THR, "w-32")}>Birim ₺</th><th className={cn(THR, "w-40")}>Fiyat tipi</th><th className={cn(THR, "w-24")}>KDV</th><th className={cn(THR, "w-32")}>Toplam (KDV dahil)</th><th className="w-10"></th></tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-t border-white/10">
                      <td className="px-4 py-2"><StatusBadge tone={it.kind==="part"?"info":"success"}>{it.kind==="part"?"Parça":"Hizmet"}</StatusBadge></td>
                      <td className="px-4 py-2 text-white">{it.name}</td>
                      <td className="px-4 py-2"><Input type="number" value={it.qty} onChange={(e)=>updItem(it.id,{qty:Number(e.target.value)||0})} className={cn(FIELD, "h-8 text-right")} /></td>
                      <td className="px-4 py-2"><Input type="number" value={it.unit_price} onChange={(e)=>updItem(it.id,{unit_price:Number(e.target.value)||0})} className={cn(FIELD, "h-8 text-right")} /></td>
                      <td className="px-4 py-2"><PriceModeSelect value={it.price_mode} onChange={(v)=>updItem(it.id,{price_mode:v})} /></td>
                      <td className="px-4 py-2"><VatSelect value={it.vat} onChange={(v)=>updItem(it.id,{vat:v})} /></td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-white">{fmtMoney(lineAmounts(it).gross)}</td>
                      <td className="px-4 py-2"><button onClick={()=>rmItem(it.id)} className="text-rose-400 transition-colors hover:text-rose-300" aria-label="Kalemi sil"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={8}><div className="[&_.text-white]:!text-white [&_.text-slate-400]:!text-slate-400"><EmptyState icon={Package} title="Henüz parça veya hizmet eklenmedi" /></div></td></tr>}
                </tbody>
              </DataTable>
            </div>
          </Panel>

          <Panel title="İşçilik, iskonto ve notlar" subtitle="Ek işçilik, indirim ve servise ait notlar.">
            <div className="space-y-4">
              <div className={cn(GRID, "lg:grid-cols-3")}>
                <div className="space-y-1.5"><Label className={LABEL}>Ek İşçilik (₺)</Label><Input type="number" value={labor} onChange={(e)=>setLabor(e.target.value)} className={FIELD} /></div>
                <div className={cn("space-y-1.5", NATIVE_SELECT)}><Label className={LABEL}>İşçilik fiyat tipi</Label><PriceModeSelect value={laborMode} onChange={setLaborMode} /></div>
                <div className={cn("space-y-1.5", NATIVE_SELECT)}><Label className={LABEL}>İşçilik KDV</Label><VatSelect value={laborVat} onChange={setLaborVat} /></div>
                <div className="space-y-1.5"><Label className={LABEL}>İskonto (₺)</Label><Input type="number" value={discount} onChange={(e)=>setDiscount(e.target.value)} className={FIELD} /></div>
              </div>
              <div className="space-y-1.5"><Label className={LABEL}>Notlar</Label><Textarea rows={2} value={notes} onChange={(e)=>setNotes(e.target.value)} className={FIELD} /></div>
            </div>
          </Panel>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Panel title="Arızalı bölgeler" subtitle={selectedMoto ? `${selectedMoto.brand} ${selectedMoto.model}` : "Motosiklet seçildiğinde görünür"}>
            <FaultViewer selected={faults} onToggle={toggleFault} type={motos.find(x => x.id === motoId)?.type} color={motos.find(x => x.id === motoId)?.color} label={(() => { const m = motos.find(x => x.id === motoId); return m ? `${m.brand} ${m.model}` : ""; })()} />
          </Panel>

          <Panel title="Toplamlar" subtitle="Parça, hizmet, işçilik ve KDV dahil genel toplam.">
            <div className={TOTALS}>
              <DocumentTotals t={totals} />
            </div>
            <Button onClick={save} disabled={saving} className={cn(BTN_PRIMARY, "mt-5 h-11 w-full font-semibold")} data-testid="so-save">
              <Plus className="h-4 w-4 mr-2" /> Servisi Oluştur
            </Button>
          </Panel>
        </aside>
      </div>

      {/* Quick add customer */}
      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent className="max-w-xl border-white/10 bg-slate-950 text-white">
          <DialogHeader><DialogTitle className="text-white">Hızlı Müşteri Ekle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className={LABEL}>Ad *</Label><Input value={custForm.first_name} onChange={(e)=>setCustForm({...custForm,first_name:e.target.value})} className={FIELD} data-testid="qa-first" /></div>
            <div className="space-y-1.5"><Label className={LABEL}>Soyad *</Label><Input value={custForm.last_name} onChange={(e)=>setCustForm({...custForm,last_name:e.target.value})} className={FIELD} data-testid="qa-last" /></div>
            <div className="space-y-1.5"><Label className={LABEL}>Telefon *</Label><Input value={custForm.phone} onChange={(e)=>setCustForm({...custForm,phone:e.target.value})} className={FIELD} data-testid="qa-phone" /></div>
            <div className="space-y-1.5"><Label className={LABEL}>TC No</Label><Input value={custForm.tc_no} onChange={(e)=>setCustForm({...custForm,tc_no:e.target.value})} className={FIELD} /></div>
            <div className="space-y-1.5"><Label className={LABEL}>E-posta</Label><Input value={custForm.email} onChange={(e)=>setCustForm({...custForm,email:e.target.value})} className={FIELD} /></div>
            <div className="space-y-1.5"><Label className={LABEL}>İl</Label><Input value={custForm.city} onChange={(e)=>setCustForm({...custForm,city:e.target.value})} className={FIELD} /></div>
          </div>
          <DialogFooter><Button variant="outline" className={BTN_GHOST} onClick={()=>setCustOpen(false)}>Vazgeç</Button><Button className={BTN_PRIMARY} onClick={saveCustomer} data-testid="qa-save-customer">Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick add motorcycle */}
      <Dialog open={motoOpen} onOpenChange={setMotoOpen}>
        <DialogContent className="max-w-2xl border-white/10 bg-slate-950 text-white">
          <DialogHeader><DialogTitle className="text-white">Hızlı Motosiklet Ekle</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className={LABEL}>Marka *</Label><Input value={motoForm.brand} onChange={(e)=>setMotoForm({...motoForm,brand:e.target.value})} className={FIELD} data-testid="qa-brand" /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Model *</Label><Input value={motoForm.model} onChange={(e)=>setMotoForm({...motoForm,model:e.target.value})} className={FIELD} data-testid="qa-model" /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Yıl</Label><Input type="number" value={motoForm.year} onChange={(e)=>setMotoForm({...motoForm,year:e.target.value})} className={FIELD} /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Tip</Label>
                <Select value={motoForm.type} onValueChange={(v)=>setMotoForm({...motoForm,type:v})}>
                  <SelectTrigger className={SELECT}><SelectValue /></SelectTrigger>
                  <SelectContent>{MOTO_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className={LABEL}>Motor (cc)</Label><Input type="number" value={motoForm.engine_cc} onChange={(e)=>setMotoForm({...motoForm,engine_cc:e.target.value})} className={FIELD} /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Renk</Label><Input value={motoForm.color} onChange={(e)=>setMotoForm({...motoForm,color:e.target.value})} className={FIELD} /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Plaka *</Label><Input value={motoForm.plate} onChange={(e)=>setMotoForm({...motoForm,plate:e.target.value.toUpperCase()})} className={cn(FIELD, "font-mono")} data-testid="qa-plate" /></div>
              <div className="space-y-1.5"><Label className={LABEL}>Şase/VIN</Label><Input value={motoForm.vin} onChange={(e)=>setMotoForm({...motoForm,vin:e.target.value})} className={cn(FIELD, "font-mono")} /></div>
            </div>
            <div className="space-y-1.5"><Label className={LABEL}>Önizleme</Label><FaultViewer type={motoForm.type} color={motoForm.color} label={`${motoForm.brand} ${motoForm.model}`.trim()} height={160} /></div>
          </div>
          <DialogFooter><Button variant="outline" className={BTN_GHOST} onClick={()=>setMotoOpen(false)}>Vazgeç</Button><Button className={BTN_PRIMARY} onClick={saveMoto} data-testid="qa-save-moto">Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

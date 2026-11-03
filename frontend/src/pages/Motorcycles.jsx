import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney, MOTO_TYPES } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Plus, Search, Bike, Trash2, Gauge, Wallet, CalendarClock, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import MotoPhoto from "../components/MotoPhoto";
import { useAuth } from "../context/AuthContext";
import { HeroBanner, KpiCard, StatusBadge } from "../components/design/kit";

const empty = { customer_id: "", brand: "", model: "", year: "", type: "Naked", engine_cc: "", plate: "", vin: "", engine_no: "", km: 0, color: "", fuel_type: "Benzin", transmission: "Manuel", owner_name: "", notes: "" };

const DAY_MS = 24 * 60 * 60 * 1000;
const DARK_FIELD = "border-white/10 bg-white/5 text-white placeholder:text-slate-500 hover:border-white/20 focus-visible:border-orange-500 focus-visible:ring-orange-500/20";
const DARK_MENU = "border-white/10 bg-slate-950 text-white";
const DARK_OUTLINE_BTN = "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white";

// Motosikletin servis durumu: yalnızca listede zaten gelen servis verisinden türetilir.
const activityOf = (m) => {
  if (!m.total_services) return { tone: "neutral", label: "Servis yok" };
  const recent = m.last_service_date && Date.now() - new Date(m.last_service_date).getTime() < 30 * DAY_MS;
  return recent ? { tone: "success", label: "Son 30 gün servis" } : { tone: "info", label: "Servis geçmişi var" };
};

const sortTr = (arr) => [...arr].sort((a, b) => String(a).localeCompare(String(b), "tr"));

export default function Motorcycles() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [delDialog, setDelDialog] = useState({ open: false, moto: null, reason: "" });
  const [fBrand, setFBrand] = useState("all");
  const [fModel, setFModel] = useState("all");
  const [fYear, setFYear] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "super_admin";

  const load = async () => {
    const { data } = await api.get(`/motorcycles${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setItems(data);
  };
  // Eski arama yanıtı yeni listeyi ezmesin
  useEffect(() => {
    let active = true;
    api.get(`/motorcycles${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(({ data }) => { if (active) setItems(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [q]);
  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)); }, []);

  const save = async () => {
    if (!form.customer_id || !form.brand || !form.model || !form.plate) return toast.error("Müşteri, marka, model ve plaka zorunlu");
    try {
      const payload = { ...form, year: form.year ? Number(form.year) : null, engine_cc: form.engine_cc ? Number(form.engine_cc) : null, km: Number(form.km) || 0 };
      await api.post("/motorcycles", payload);
      toast.success("Motosiklet eklendi");
      setOpen(false); setForm(empty); load();
    } catch { toast.error("Kayıt başarısız"); }
  };

  const del = (m, e) => {
    e.preventDefault(); e.stopPropagation();
    setDelDialog({ open: true, moto: m, reason: "" });
  };

  const confirmDelete = async () => {
    const { moto, reason } = delDialog;
    if (!reason.trim()) return toast.error("Silme sebebi zorunlu");
    try {
      // Açık servis kaydı varsa backend silmeyi engeller; kullanıcı onaylarsa force ile tekrar denenir
      let res;
      try {
        res = await api.delete(`/motorcycles/${moto.id}`, { data: { reason, force: false } });
      } catch (err) {
        const detail = err.response?.data?.detail || "";
        if (err.response?.status !== 400 || !detail.includes("açık servis")) throw err;
        if (!window.confirm(`${detail}\n\nYine de silinsin mi? Açık servis kayıtları da çöp kutusuna alınır.`)) return;
        res = await api.delete(`/motorcycles/${moto.id}`, { data: { reason, force: true } });
      }
      const extras = Object.entries(res.data.counts || {}).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`);
      toast.success(`${moto.plate} çöp kutusuna alındı${extras.length ? ` · ${extras.join(", ")}` : ""}`);
      setDelDialog({ open: false, moto: null, reason: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Silme başarısız");
    }
  };

  // Filtre seçenekleri ve sonuçlar yüklü listeden (istemci tarafı) hesaplanır
  const brands = sortTr(new Set(items.map((m) => m.brand).filter(Boolean)));
  const models = sortTr(new Set((fBrand === "all" ? items : items.filter((m) => m.brand === fBrand)).map((m) => m.model).filter(Boolean)));
  const years = [...new Set(items.map((m) => m.year).filter(Boolean))].sort((a, b) => b - a);
  const visible = items.filter((m) =>
    (fBrand === "all" || m.brand === fBrand) &&
    (fModel === "all" || m.model === fModel) &&
    (fYear === "all" || String(m.year) === fYear)
  );
  const activeFilters = [fBrand, fModel, fYear].filter((v) => v !== "all").length;
  const clearFilters = () => { setFBrand("all"); setFModel("all"); setFYear("all"); };

  // KPI değerleri: yüklü motosiklet kayıtlarından
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const addedThisMonth = items.filter((m) => m.created_at && new Date(m.created_at).getTime() >= monthStart).length;
  const avgKm = items.length ? Math.round(items.reduce((a, m) => a + (Number(m.km) || 0), 0) / items.length) : 0;
  const totalSpent = items.reduce((a, m) => a + (Number(m.total_spent) || 0), 0);

  return (
    <div className="space-y-6 text-white">
      <HeroBanner
        eyebrow="Araç kayıtları"
        title="Motosikletler"
        subtitle={`${items.length} kayıtlı motosiklet. Plaka, marka, model veya şase numarasıyla hızlıca arayın, servis geçmişine tek dokunuşla ulaşın.`}
        slot="motorcycles_hero"
        fallback="/visuals/moto-main.png"
        actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 text-white hover:bg-orange-600" data-testid="btn-new-motorcycle"><Plus className="mr-2 h-4 w-4" /> Yeni motosiklet</Button>
          </DialogTrigger>
          <DialogContent className={`max-w-3xl ${DARK_MENU}`}>
            <DialogHeader><DialogTitle className="text-white">Yeni Motosiklet</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-slate-300">Müşteri *</Label>
                  <Select value={form.customer_id} onValueChange={(v)=>setForm({...form, customer_id:v})}>
                    <SelectTrigger data-testid="select-customer" className={DARK_FIELD}><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
                    <SelectContent className={DARK_MENU}>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-slate-300">Marka *</Label><Input className={DARK_FIELD} value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} /></div>
                <div><Label className="text-slate-300">Model *</Label><Input className={DARK_FIELD} value={form.model} onChange={(e)=>setForm({...form, model:e.target.value})} /></div>
                <div><Label className="text-slate-300">Yıl</Label><Input className={DARK_FIELD} type="number" value={form.year} onChange={(e)=>setForm({...form, year:e.target.value})} /></div>
                <div>
                  <Label className="text-slate-300">Tip</Label>
                  <Select value={form.type} onValueChange={(v)=>setForm({...form, type:v})}>
                    <SelectTrigger data-testid="select-type" className={DARK_FIELD}><SelectValue /></SelectTrigger>
                    <SelectContent className={DARK_MENU}>{MOTO_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-slate-300">Motor (cc)</Label><Input className={DARK_FIELD} type="number" value={form.engine_cc} onChange={(e)=>setForm({...form, engine_cc:e.target.value})} /></div>
                <div><Label className="text-slate-300">Plaka *</Label><Input value={form.plate} onChange={(e)=>setForm({...form, plate:e.target.value.toUpperCase()})} className={`${DARK_FIELD} font-mono`} /></div>
                <div><Label className="text-slate-300">Şase/VIN</Label><Input value={form.vin} onChange={(e)=>setForm({...form, vin:e.target.value})} className={`${DARK_FIELD} font-mono`} /></div>
                <div><Label className="text-slate-300">Motor No</Label><Input className={DARK_FIELD} value={form.engine_no} onChange={(e)=>setForm({...form, engine_no:e.target.value})} /></div>
                <div><Label className="text-slate-300">Kilometre</Label><Input className={DARK_FIELD} type="number" value={form.km} onChange={(e)=>setForm({...form, km:e.target.value})} /></div>
                <div><Label className="text-slate-300">Renk</Label><Input className={DARK_FIELD} value={form.color} onChange={(e)=>setForm({...form, color:e.target.value})} /></div>
              </div>
              <div className="md:col-span-1">
                <Label className="text-slate-300">Önizleme</Label>
                <div className="mt-1"><div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900"><MotoPhoto /></div></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className={DARK_OUTLINE_BTN} onClick={()=>setOpen(false)}>İptal</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={save} data-testid="btn-save-motorcycle">Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard icon={Bike} label="Toplam motosiklet" value={items.length} tone="orange" testId="moto-total" />
        <KpiCard icon={CalendarClock} label="Bu ay eklenen" value={addedThisMonth} tone="violet" testId="moto-added-month" />
        <KpiCard icon={Gauge} label="Ortalama km" value={`${avgKm.toLocaleString("tr-TR")} km`} tone="green" testId="moto-km" />
        <KpiCard icon={Wallet} label="Toplam servis tutarı" value={fmtMoney(totalSpent)} tone="blue" testId="moto-spent" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:flex-row md:items-center">
        <div className="relative md:max-w-sm md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Plaka, marka, model, şase ile ara" value={q} onChange={(e)=>setQ(e.target.value)} className={`pl-9 ${DARK_FIELD}`} data-testid="moto-search" />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtrele{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>
          {activeFilters > 0 && (
            <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-300 hover:text-white">
              <X className="h-3.5 w-3.5" /> Temizle
            </button>
          )}
        </div>
        <div className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-2 sm:grid-cols-3 md:grid md:flex-1 md:grid-cols-3`}>
          <Select value={fBrand} onValueChange={(v) => { setFBrand(v); setFModel("all"); }}>
            <SelectTrigger aria-label="Marka" className={DARK_FIELD}><SelectValue /></SelectTrigger>
            <SelectContent className={DARK_MENU}>
              <SelectItem value="all">Tüm markalar</SelectItem>
              {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fModel} onValueChange={setFModel}>
            <SelectTrigger aria-label="Model" className={DARK_FIELD}><SelectValue /></SelectTrigger>
            <SelectContent className={DARK_MENU}>
              <SelectItem value="all">Tüm modeller</SelectItem>
              {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fYear} onValueChange={setFYear}>
            <SelectTrigger aria-label="Yıl" className={DARK_FIELD}><SelectValue /></SelectTrigger>
            <SelectContent className={DARK_MENU}>
              <SelectItem value="all">Tüm yıllar</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-slate-400">{visible.length} sonuç gösteriliyor</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visible.map((m) => {
          const activity = activityOf(m);
          return (
            <article
              key={m.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 transition-colors hover:border-orange-500/40"
            >
              <Link
                to={`/motorcycles/${m.id}`}
                className="relative block h-36 overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950"
                aria-label={`${m.brand} ${m.model} detayı`}
              >
                <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30">
                  <Bike className="h-4 w-4" />
                </span>
                <span className="absolute inset-x-4 bottom-3 truncate font-heading text-3xl font-black uppercase tracking-tight text-white/90 transition-transform duration-300 group-hover:-translate-y-0.5">
                  {m.brand}
                </span>
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-base font-semibold text-white">{m.brand} {m.model}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{[m.type, m.engine_cc ? `${m.engine_cc} cc` : ""].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-white ring-1 ring-white/10">{m.plate}</span>
                  {m.year && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/30">{m.year}</span>}
                  <StatusBadge tone={activity.tone}>{activity.label}</StatusBadge>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> {Number(m.km || 0).toLocaleString("tr-TR")} km</span>
                  <span className="font-semibold text-white">{fmtMoney(m.total_spent)}</span>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <span className="min-w-0 truncate text-xs text-slate-400">{m.customer?.first_name} {m.customer?.last_name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e)=>del(m, e)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30 transition-colors hover:bg-rose-500/10"
                        title="Motosikleti sil"
                        data-testid={`del-moto-${m.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Sil
                      </button>
                    )}
                    <Link
                      to={`/motorcycles/${m.id}`}
                      className="inline-flex h-8 items-center rounded-lg bg-orange-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                    >
                      Detay
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {visible.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30">
              <Bike className="h-5 w-5" />
            </span>
            <p className="font-heading text-base font-semibold text-white">Motosiklet bulunamadı</p>
            <p className="text-sm text-slate-400">Arama terimini veya filtreleri değiştirmeyi deneyin.</p>
          </div>
        )}
      </div>

      <Dialog open={delDialog.open} onOpenChange={(o)=>{ if(!o) setDelDialog({ open:false, moto:null, reason:"" }); }}>
        <DialogContent className={DARK_MENU}>
          <DialogHeader><DialogTitle className="text-white">Motosikleti Sil {delDialog.moto ? `— ${delDialog.moto.plate}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Silinen motosiklet <b className="text-white">çöp kutusuna</b> alınır ve <b className="text-white">30 gün</b> içinde geri yüklenebilir.</p>
            <div>
              <Label className="text-slate-300">Silme Sebebi * <span className="text-xs text-slate-400 font-normal">(denetim kaydına yazılır)</span></Label>
              <Textarea rows={3} className={DARK_FIELD} value={delDialog.reason} onChange={(e)=>setDelDialog({...delDialog, reason:e.target.value})} placeholder="Örn: Motosiklet satıldı · Hatalı kayıt" data-testid="moto-delete-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className={DARK_OUTLINE_BTN} onClick={()=>setDelDialog({ open:false, moto:null, reason:"" })}>İptal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete} disabled={!delDialog.reason.trim()} data-testid="moto-delete-confirm">
              <Trash2 className="h-4 w-4 mr-1" />Sil ve Çöp Kutusuna Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney, MOTO_TYPES } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus, Search, Bike, Trash2 } from "lucide-react";
import { toast } from "sonner";
import MotorcycleIllustration from "../components/MotorcycleIllustration";
import { useAuth } from "../context/AuthContext";
import { Textarea } from "../components/ui/textarea";

const empty = { customer_id: "", brand: "", model: "", year: "", type: "Naked", engine_cc: "", plate: "", vin: "", engine_no: "", km: 0, color: "", fuel_type: "Benzin", transmission: "Manuel", owner_name: "", notes: "" };

export default function Motorcycles() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [delDialog, setDelDialog] = useState({ open: false, moto: null, reason: "" });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Motosikletler</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} motosiklet</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600" data-testid="btn-new-motorcycle"><Plus className="h-4 w-4 mr-2" /> Yeni Motosiklet</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Yeni Motosiklet</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Müşteri *</Label>
                  <Select value={form.customer_id} onValueChange={(v)=>setForm({...form, customer_id:v})}>
                    <SelectTrigger data-testid="select-customer"><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
                    <SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Marka *</Label><Input value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} /></div>
                <div><Label>Model *</Label><Input value={form.model} onChange={(e)=>setForm({...form, model:e.target.value})} /></div>
                <div><Label>Yıl</Label><Input type="number" value={form.year} onChange={(e)=>setForm({...form, year:e.target.value})} /></div>
                <div>
                  <Label>Tip</Label>
                  <Select value={form.type} onValueChange={(v)=>setForm({...form, type:v})}>
                    <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{MOTO_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Motor (cc)</Label><Input type="number" value={form.engine_cc} onChange={(e)=>setForm({...form, engine_cc:e.target.value})} /></div>
                <div><Label>Plaka *</Label><Input value={form.plate} onChange={(e)=>setForm({...form, plate:e.target.value.toUpperCase()})} className="font-mono" /></div>
                <div><Label>Şase/VIN</Label><Input value={form.vin} onChange={(e)=>setForm({...form, vin:e.target.value})} className="font-mono" /></div>
                <div><Label>Motor No</Label><Input value={form.engine_no} onChange={(e)=>setForm({...form, engine_no:e.target.value})} /></div>
                <div><Label>Kilometre</Label><Input type="number" value={form.km} onChange={(e)=>setForm({...form, km:e.target.value})} /></div>
                <div><Label>Renk</Label><Input value={form.color} onChange={(e)=>setForm({...form, color:e.target.value})} /></div>
              </div>
              <div className="md:col-span-1">
                <Label>Önizleme</Label>
                <div className="mt-1"><MotorcycleIllustration type={form.type} className="w-full" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={save} data-testid="btn-save-motorcycle">Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Plaka, marka, model, şase ile ara" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" data-testid="moto-search" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((m) => (
          <div key={m.id} className="relative group">
            <Link to={`/motorcycles/${m.id}`}>
              <Card className="border-slate-200 hover:border-orange-400 hover:shadow-md transition-all duration-150">
                <CardContent className="p-5">
                  <MotorcycleIllustration type={m.type} className="w-full h-32 mb-4" />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-heading text-lg font-semibold text-slate-900">{m.brand} {m.model}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.type} · {m.year || "-"} · {m.engine_cc ? `${m.engine_cc}cc` : ""}</div>
                    </div>
                    <span className="font-mono text-xs bg-slate-900 text-white px-2 py-1 rounded">{m.plate}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>{m.customer?.first_name} {m.customer?.last_name}</span>
                    <span className="font-medium">{fmtMoney(m.total_spent)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            {canDelete && (
              <button
                onClick={(e)=>del(m, e)}
                className="absolute top-2 right-2 bg-white/90 border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                title="Motosikleti sil"
                data-testid={`del-moto-${m.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="text-slate-500 col-span-full text-center py-12"><Bike className="h-10 w-10 mx-auto opacity-40 mb-2" /> Motosiklet bulunamadı</div>}
      </div>

      <Dialog open={delDialog.open} onOpenChange={(o)=>{ if(!o) setDelDialog({ open:false, moto:null, reason:"" }); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motosikleti Sil {delDialog.moto ? `— ${delDialog.moto.plate}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Silinen motosiklet <b>çöp kutusuna</b> alınır ve <b>30 gün</b> içinde geri yüklenebilir.</p>
            <div>
              <Label>Silme Sebebi * <span className="text-xs text-slate-400 font-normal">(denetim kaydına yazılır)</span></Label>
              <Textarea rows={3} value={delDialog.reason} onChange={(e)=>setDelDialog({...delDialog, reason:e.target.value})} placeholder="Örn: Motosiklet satıldı · Hatalı kayıt" data-testid="moto-delete-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDelDialog({ open:false, moto:null, reason:"" })}>İptal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete} disabled={!delDialog.reason.trim()} data-testid="moto-delete-confirm">
              <Trash2 className="h-4 w-4 mr-1" />Sil ve Çöp Kutusuna Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

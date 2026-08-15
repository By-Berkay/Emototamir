import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney, MOTO_TYPES } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus, Search, Bike } from "lucide-react";
import { toast } from "sonner";
import MotorcycleIllustration from "../components/MotorcycleIllustration";

const empty = { customer_id: "", brand: "", model: "", year: "", type: "Naked", engine_cc: "", plate: "", vin: "", engine_no: "", km: 0, color: "", fuel_type: "Benzin", transmission: "Manuel", owner_name: "", notes: "" };

export default function Motorcycles() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const { data } = await api.get(`/motorcycles${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Motosikletler</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} motosiklet</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
          <Link key={m.id} to={`/motorcycles/${m.id}`}>
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
        ))}
        {items.length === 0 && <div className="text-slate-500 col-span-full text-center py-12"><Bike className="h-10 w-10 mx-auto opacity-40 mb-2" /> Motosiklet bulunamadı</div>}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import { toast } from "sonner";

const empty = { code:"", name:"", description:"", price:0, vat:20, price_mode:"incl" };

export default function Services() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => { const { data } = await api.get("/service-catalog"); setItems(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.code || !form.name) return toast.error("Kod ve ad zorunlu");
    try {
      await api.post("/service-catalog", { ...form, price: Number(form.price)||0 });
      toast.success("Hizmet eklendi"); setOpen(false); setForm(empty); load();
    } catch { toast.error("Kayıt başarısız"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hizmetler"
        description={`${items.length} hizmet`}
        actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-500 hover:bg-brand-600"><Plus className="h-4 w-4 mr-2" />Yeni Hizmet</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Hizmet</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kod</Label><Input value={form.code} onChange={(e)=>setForm({...form, code:e.target.value})} /></div>
              <div><Label>Ad</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} /></div>
              <div className="col-span-2"><Label>Açıklama</Label><Textarea rows={2} value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} /></div>
              <div><Label>Fiyat (₺)</Label><Input type="number" value={form.price} onChange={(e)=>setForm({...form, price:e.target.value})} /></div>
              <div><Label>KDV</Label><VatSelect value={form.vat} onChange={(v)=>setForm({...form, vat:v})} testId="service-vat" /></div>
              <div><Label>Fiyat tipi</Label><PriceModeSelect value={form.price_mode} onChange={(v)=>setForm({...form, price_mode:v})} testId="service-price-mode" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button><Button className="bg-brand-500 hover:bg-brand-600" onClick={save}>Kaydet</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(s=>(
          <Card key={s.id} className="border-slate-200"><CardContent className="p-5">
            <div className="text-xs text-slate-500 font-mono">{s.code}</div>
            <div className="font-heading text-lg font-semibold mt-1">{s.name}</div>
            {s.description && <div className="text-sm text-slate-500 mt-1">{s.description}</div>}
            <div className="mt-3 text-xl font-bold text-slate-900">{fmtMoney(s.price)}</div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

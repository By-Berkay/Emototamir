import React, { useEffect, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const empty = { code:"", name:"", brand:"", category:"Motor Yağı", cost_price:0, sale_price:0, stock:0, min_stock:5, unit:"Adet", vat:20, description:"" };
const CATS = ["Motor Yağı","Filtre","Fren","Elektrik","Lastik","Zincir","Dişli","Akü","Buji","Süspansiyon","Kaporta","Motor","Egzoz","Diğer"];

export default function Products() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => { const { data } = await api.get(`/products${q?`?q=${encodeURIComponent(q)}`:""}`); setItems(data); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const save = async () => {
    if (!form.code || !form.name) return toast.error("Kod ve ad zorunlu");
    try {
      await api.post("/products", { ...form, cost_price: Number(form.cost_price)||0, sale_price:Number(form.sale_price)||0, stock:Number(form.stock)||0, min_stock:Number(form.min_stock)||0 });
      toast.success("Parça eklendi"); setOpen(false); setForm(empty); load();
    } catch { toast.error("Kayıt başarısız"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="font-heading text-3xl font-bold text-slate-900">Parçalar</h1><p className="text-sm text-slate-500 mt-1">{items.length} parça</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600" data-testid="btn-new-product"><Plus className="h-4 w-4 mr-2" />Yeni Parça</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Yeni Parça</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kod *</Label><Input value={form.code} onChange={(e)=>setForm({...form, code:e.target.value})} /></div>
              <div><Label>Ad *</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} /></div>
              <div><Label>Marka</Label><Input value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} /></div>
              <div><Label>Kategori</Label>
                <select className="w-full border rounded-md h-10 px-2" value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})}>
                  {CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>Alış (₺)</Label><Input type="number" value={form.cost_price} onChange={(e)=>setForm({...form, cost_price:e.target.value})} /></div>
              <div><Label>Satış (₺)</Label><Input type="number" value={form.sale_price} onChange={(e)=>setForm({...form, sale_price:e.target.value})} /></div>
              <div><Label>Stok</Label><Input type="number" value={form.stock} onChange={(e)=>setForm({...form, stock:e.target.value})} /></div>
              <div><Label>Min Stok</Label><Input type="number" value={form.min_stock} onChange={(e)=>setForm({...form, min_stock:e.target.value})} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button><Button className="bg-orange-500 hover:bg-orange-600" onClick={save} data-testid="btn-save-product">Kaydet</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Kod, ad, kategori" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-slate-200"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-3">Kod</th><th className="text-left px-4 py-3">Ad</th><th className="text-left px-4 py-3">Kategori</th><th className="text-right px-4 py-3">Alış</th><th className="text-right px-4 py-3">Satış</th><th className="text-right px-4 py-3">Stok</th></tr></thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono">{p.code}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{p.category}</span></td>
                  <td className="px-4 py-3 text-right">{fmtMoney(p.cost_price)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(p.sale_price)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${p.stock<=p.min_stock?"text-red-600":""}`}>
                    {p.stock<=p.min_stock && <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />}{p.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

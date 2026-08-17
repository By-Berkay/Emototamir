import React, { useEffect, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Plus, Users, Search, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TAG_META } from "./CustomerDetail";
import { useAuth } from "../context/AuthContext";

const empty = { first_name: "", last_name: "", phone: "", alt_phone: "", email: "", tc_no: "", address: "", city: "", district: "", notes: "" };

export default function Customers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState({});
  const [delDialog, setDelDialog] = useState({ open: false, ids: [], reason: "" });
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "super_admin";

  const load = async () => {
    const { data } = await api.get(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const save = async () => {
    if (!form.first_name || !form.last_name || !form.phone) return toast.error("Ad, soyad ve telefon zorunlu");
    try {
      await api.post("/customers", form);
      toast.success("Müşteri eklendi");
      setOpen(false); setForm(empty); load();
    } catch (e) {
      toast.error("Kayıt başarısız");
    }
  };

  const del = async (c) => {
    setDelDialog({ open: true, ids: [c.id], reason: "" });
  };

  const confirmDelete = async () => {
    const { ids, reason } = delDialog;
    if (!reason.trim()) return toast.error("Silme sebebi zorunlu");
    try {
      if (ids.length === 1) {
        const { data } = await api.delete(`/customers/${ids[0]}`, { data: { reason, force: true } });
        const parts = Object.entries(data.counts || {}).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`);
        toast.success(`Silindi · Çöp kutusuna alındı${parts.length ? ` · ${parts.join(", ")}` : ""}`);
      } else {
        const { data } = await api.post("/customers/bulk-delete", { ids, reason, force: true });
        toast.success(`${data.deleted}/${data.total} müşteri çöp kutusuna alındı`);
      }
      setDelDialog({ open: false, ids: [], reason: "" });
      setSelected({});
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Silme başarısız");
    }
  };

  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const allSelected = items.length > 0 && items.every(c => selected[c.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else {
      const s = {}; items.forEach(c => { s[c.id] = true; }); setSelected(s);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Müşteriler</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} müşteri</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600" data-testid="btn-new-customer">
              <Plus className="h-4 w-4 mr-2" /> Yeni Müşteri
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Yeni Müşteri</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ad *</Label><Input value={form.first_name} onChange={(e)=>setForm({...form, first_name:e.target.value})} data-testid="input-first-name" /></div>
              <div><Label>Soyad *</Label><Input value={form.last_name} onChange={(e)=>setForm({...form, last_name:e.target.value})} data-testid="input-last-name" /></div>
              <div><Label>Telefon *</Label><Input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} data-testid="input-phone" /></div>
              <div><Label>Alternatif Telefon</Label><Input value={form.alt_phone} onChange={(e)=>setForm({...form, alt_phone:e.target.value})} /></div>
              <div><Label>E-posta</Label><Input value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} /></div>
              <div><Label>TC Kimlik No</Label><Input value={form.tc_no} onChange={(e)=>setForm({...form, tc_no:e.target.value})} /></div>
              <div><Label>İl</Label><Input value={form.city} onChange={(e)=>setForm({...form, city:e.target.value})} /></div>
              <div><Label>İlçe</Label><Input value={form.district} onChange={(e)=>setForm({...form, district:e.target.value})} /></div>
              <div className="col-span-2"><Label>Adres</Label><Textarea rows={2} value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} /></div>
              <div className="col-span-2"><Label>Notlar</Label><Textarea rows={2} value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={save} data-testid="btn-save-customer">Kaydet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="İsim veya telefon ile ara" value={q} onChange={(e)=>setQ(e.target.value)} className="pl-9" data-testid="customer-search" />
        </div>
        {canDelete && selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 text-sm text-red-800" data-testid="bulk-bar">
            <span className="font-semibold">{selectedIds.length} seçili</span>
            <Button size="sm" variant="outline" onClick={()=>setSelected({})}>Temizle</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={()=>setDelDialog({ open: true, ids: selectedIds, reason: "" })} data-testid="bulk-delete">
              <Trash2 className="h-3.5 w-3.5 mr-1" />Seçileni Sil ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  {canDelete && <th className="w-8 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} data-testid="check-all" /></th>}
                  <th className="text-left px-4 py-3">Müşteri</th>
                  <th className="text-left px-4 py-3">Telefon</th>
                  <th className="text-left px-4 py-3">Şehir</th>
                  <th className="text-right px-4 py-3">Servis</th>
                  <th className="text-right px-4 py-3">Toplam Harcama</th>
                  <th className="text-right px-4 py-3">Bakiye</th>
                  {canDelete && <th className="text-right px-4 py-3 w-16">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selected[c.id] ? "bg-red-50/50" : ""}`}>
                    {canDelete && <td className="px-3 py-3"><input type="checkbox" checked={!!selected[c.id]} onChange={()=>setSelected({...selected, [c.id]: !selected[c.id]})} data-testid={`check-customer-${c.id}`} /></td>}
                    <td className="px-4 py-3">
                      <Link to={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline flex items-center gap-2" data-testid={`customer-row-${c.id}`}>
                        <div className="h-8 w-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">{c.first_name?.[0]}{c.last_name?.[0]}</div>
                        <span>{c.first_name} {c.last_name}</span>
                        {c.top_tag && TAG_META[c.top_tag] && (
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${TAG_META[c.top_tag].cls}`} data-testid={`customer-tag-${c.id}`}>{TAG_META[c.top_tag].label}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono"><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span></td>
                    <td className="px-4 py-3 text-slate-600">{c.city || "-"}</td>
                    <td className="px-4 py-3 text-right">{c.total_services}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(c.total_spent)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${c.balance > 0.01 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(c.balance)}</td>
                    {canDelete && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={()=>del(c)} className="text-slate-400 hover:text-red-600 p-1" title="Müşteriyi sil" data-testid={`del-customer-${c.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={canDelete?8:6} className="px-4 py-12 text-center text-slate-500"><Users className="h-8 w-8 mx-auto mb-2 opacity-40" />Müşteri bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete reason dialog */}
      <Dialog open={delDialog.open} onOpenChange={(o)=>{ if(!o) setDelDialog({ open:false, ids:[], reason:"" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {delDialog.ids.length === 1 ? "Müşteriyi Sil" : `${delDialog.ids.length} Müşteriyi Sil`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Silinen kayıtlar <b>çöp kutusuna</b> alınır ve <b>30 gün</b> içinde geri yüklenebilir. 30 gün sonra kalıcı olarak silinir.
            </p>
            <div>
              <Label>Silme Sebebi * <span className="text-xs text-slate-400 font-normal">(denetim kaydına yazılır)</span></Label>
              <Textarea
                rows={3}
                value={delDialog.reason}
                onChange={(e)=>setDelDialog({...delDialog, reason: e.target.value})}
                placeholder="Örn: Yanlış girilmiş müşteri kaydı · Test verisi · Talep üzerine (KVKK)"
                data-testid="delete-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDelDialog({ open:false, ids:[], reason:"" })}>İptal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete} disabled={!delDialog.reason.trim()} data-testid="delete-confirm">
              <Trash2 className="h-4 w-4 mr-1" />Sil ve Çöp Kutusuna Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

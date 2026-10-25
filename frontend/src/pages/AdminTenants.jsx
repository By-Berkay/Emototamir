import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus, Building2, Trash2, Settings2, Copy, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = {
  name:"", subtitle:"YETKİLİ SERVİS & SHOWROOM", address:"", city:"", district:"", phone:"", email:"",
  tax_no:"", bank_name:"", bank_account_name:"", iban:"",
  admin_email:"", admin_password:"", admin_name:"",
  primary_color:"#F97316", secondary_color:"#0F172A", theme:"orange",
  custom_fault_zones: [], custom_moto_images: {},
};

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [cloneSrc, setCloneSrc] = useState(null);
  const [cloneForm, setCloneForm] = useState({ new_name:"", new_slug:"", admin_email:"", admin_password:"", admin_name:"", include_products:true, include_services:true });

  const load = () => api.get("/admin/tenants").then(r=>setTenants(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.admin_email || !form.admin_password) return toast.error("Firma adı, admin e-postası ve şifre zorunlu");
    try {
      await api.post("/admin/tenants", form);
      toast.success("Firma oluşturuldu");
      setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Kayıt başarısız"); }
  };

  const del = async (t) => {
    if (!window.confirm(`${t.name} firmasını TÜM verilerle KALICI silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/admin/tenants/${t.id}?purge=true`);
      toast.success("Firma silindi"); load();
    } catch { toast.error("Silme başarısız"); }
  };

  const openClone = (t) => {
    setCloneSrc(t);
    setCloneForm({ new_name: `${t.name} (Kopya)`, new_slug:"", admin_email:"", admin_password:"", admin_name:"", include_products:true, include_services:true });
  };
  const doClone = async () => {
    if (!cloneForm.new_name || !cloneForm.admin_email || !cloneForm.admin_password || !cloneForm.admin_name)
      return toast.error("Firma adı ve admin bilgileri zorunlu");
    try {
      const { data } = await api.post(`/admin/tenants/${cloneSrc.id}/clone`, cloneForm);
      toast.success(`Klon oluşturuldu · ${data.parts_copied} parça, ${data.services_copied} hizmet kopyalandı`);
      setCloneSrc(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Klonlama başarısız"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">Firma Yönetimi</h1>
          <p className="text-sm text-slate-500 mt-1">{tenants.length} firma · Her firma kendi verilerini ayrı görür</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-500 hover:bg-brand-600" data-testid="btn-new-tenant"><Plus className="h-4 w-4 mr-2" />Yeni Firma</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Yeni Firma Oluştur</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Firma Adı *</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} data-testid="tenant-name" /></div>
              <div className="col-span-2"><Label>Alt Başlık</Label><Input value={form.subtitle} onChange={(e)=>setForm({...form, subtitle:e.target.value})} /></div>
              <div className="col-span-2"><Label>Adres</Label><Textarea rows={2} value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} /></div>
              <div><Label>İl</Label><Input value={form.city} onChange={(e)=>setForm({...form, city:e.target.value})} /></div>
              <div><Label>İlçe</Label><Input value={form.district} onChange={(e)=>setForm({...form, district:e.target.value})} /></div>
              <div><Label>Telefon</Label><Input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} /></div>
              <div><Label>E-posta</Label><Input value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} /></div>
              <div className="col-span-2 pt-3 border-t"><Label className="text-slate-500 uppercase text-xs">Banka Bilgileri</Label></div>
              <div><Label>Banka</Label><Input value={form.bank_name} onChange={(e)=>setForm({...form, bank_name:e.target.value})} /></div>
              <div><Label>Hesap Sahibi</Label><Input value={form.bank_account_name} onChange={(e)=>setForm({...form, bank_account_name:e.target.value})} /></div>
              <div className="col-span-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e)=>setForm({...form, iban:e.target.value})} className="font-mono" /></div>
              <div className="col-span-2 pt-3 border-t"><Label className="text-slate-500 uppercase text-xs">Firma Yönetici Hesabı</Label></div>
              <div className="col-span-2"><Label>Yönetici Ad *</Label><Input value={form.admin_name} onChange={(e)=>setForm({...form, admin_name:e.target.value})} data-testid="tenant-admin-name" /></div>
              <div><Label>Yönetici E-posta *</Label><Input value={form.admin_email} onChange={(e)=>setForm({...form, admin_email:e.target.value})} data-testid="tenant-admin-email" /></div>
              <div><Label>Yönetici Şifre *</Label><Input type="password" value={form.admin_password} onChange={(e)=>setForm({...form, admin_password:e.target.value})} data-testid="tenant-admin-password" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button>
              <Button className="bg-brand-500 hover:bg-brand-600" onClick={save} data-testid="tenant-save">Firmayı Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map(t => {
          const ends = t.subscription_ends_at || t.trial_ends_at;
          const expired = ends && new Date(ends) < new Date();
          const inactive = t.is_active === false;
          return (
          <Card key={t.id} className={`border-slate-200 hover:shadow-md transition-all ${inactive || expired ? "opacity-70" : "hover:border-brand-400"}`}>
            <CardContent className="p-5">
              <Link to={`/admin/tenants/${t.id}`} className="block" data-testid={`tenant-card-${t.id}`}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center"><Building2 className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-semibold truncate">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.city}{t.district?` / ${t.district}`:""}</div>
                  </div>
                </div>
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t.plan || "trial"}</span>
                {inactive && <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1"><ShieldAlert className="h-3 w-3" />Pasif</span>}
                {!inactive && expired && <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">Süresi Doldu</span>}
                {!inactive && !expired && ends && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Bitiş: {new Date(ends).toLocaleDateString("tr-TR")}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-50 rounded p-2"><div className="text-xs text-slate-500">Kullanıcı</div><div className="font-semibold">{t.users_count}</div></div>
                <div className="bg-slate-50 rounded p-2"><div className="text-xs text-slate-500">Servis</div><div className="font-semibold">{t.orders_count}</div></div>
              </div>
              {t.phone && <div className="text-xs text-slate-500 mt-2 font-mono">{t.phone}</div>}
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <Link to={`/admin/tenants/${t.id}`} className="text-xs text-brand-600 font-semibold flex items-center gap-1"><Settings2 className="h-3 w-3" />Firmayı yönet →</Link>
                <div className="flex items-center gap-1">
                  <button onClick={()=>openClone(t)} className="text-slate-500 hover:text-brand-600 p-1" title="Firmayı klonla" data-testid={`clone-tenant-${t.id}`}><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={()=>del(t)} className="text-red-500 hover:text-red-700 p-1" title="Firmayı sil" data-testid={`del-tenant-${t.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </CardContent>
          </Card>
        );})}
        {tenants.length === 0 && <div className="col-span-full text-center py-12 text-slate-500"><Building2 className="h-10 w-10 mx-auto opacity-40 mb-2" />Henüz firma yok. Yeni firma oluşturun.</div>}
      </div>

      {/* Clone dialog */}
      <Dialog open={!!cloneSrc} onOpenChange={(o)=>{ if(!o) setCloneSrc(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Firmayı Klonla — {cloneSrc?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">Tema, PDF şablonu, arıza bölgeleri, banka/adres bilgileri kopyalanır. Müşteri, motosiklet ve servis kayıtları <b>kopyalanmaz</b>.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Yeni Firma Adı *</Label><Input value={cloneForm.new_name} onChange={(e)=>setCloneForm({...cloneForm, new_name:e.target.value})} data-testid="clone-name" /></div>
            <div className="col-span-2"><Label>Yönetici Ad *</Label><Input value={cloneForm.admin_name} onChange={(e)=>setCloneForm({...cloneForm, admin_name:e.target.value})} data-testid="clone-admin-name" /></div>
            <div><Label>Yönetici E-posta *</Label><Input value={cloneForm.admin_email} onChange={(e)=>setCloneForm({...cloneForm, admin_email:e.target.value})} data-testid="clone-admin-email" /></div>
            <div><Label>Yönetici Şifre *</Label><Input type="password" value={cloneForm.admin_password} onChange={(e)=>setCloneForm({...cloneForm, admin_password:e.target.value})} data-testid="clone-admin-password" /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cloneForm.include_products} onChange={(e)=>setCloneForm({...cloneForm, include_products:e.target.checked})} /> Parça kataloğunu kopyala (stoklar sıfırlanır)
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cloneForm.include_services} onChange={(e)=>setCloneForm({...cloneForm, include_services:e.target.checked})} /> Hizmet kataloğunu kopyala
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setCloneSrc(null)}>Vazgeç</Button>
            <Button className="bg-brand-500 hover:bg-brand-600" onClick={doClone} data-testid="clone-save"><Copy className="h-4 w-4 mr-1" />Klonla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

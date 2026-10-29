import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api, { API } from "../lib/api";
import AuthedImage from "../components/AuthedImage";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus, Upload, Trash2, Palette, Building, Users2, MapPin, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const THEMES = [
  { key: "orange", label: "Turuncu (Varsayılan)", primary: "#F97316", secondary: "#0F172A" },
  { key: "blue", label: "Mavi", primary: "#2563EB", secondary: "#0F172A" },
  { key: "red", label: "Kırmızı", primary: "#DC2626", secondary: "#0F172A" },
  { key: "green", label: "Yeşil", primary: "#059669", secondary: "#0F172A" },
  { key: "purple", label: "Mor", primary: "#7C3AED", secondary: "#0F172A" },
  { key: "slate", label: "Slate", primary: "#475569", secondary: "#0F172A" },
];

const MOTO_TYPES = ["Scooter","Maxi Scooter","Naked","Sport","Touring","Adventure","Enduro","Cross","Chopper","Cruiser","Cafe Racer","Elektrikli"];


export default function Settings() {
  const { user, refresh } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tenant, setTenant] = useState(null);
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [faultZones, setFaultZones] = useState([]);
  const [newZone, setNewZone] = useState("");
  const logoRef = useRef(null);

  const [uForm, setUForm] = useState({ email:"", password:"", name:"", role:"service_advisor" });
  const [uOpen, setUOpen] = useState(false);

  const load = async () => {
    if (user?.role === "super_admin") return;
    // /users yalnızca admin rolüne açık; diğer roller için istek atılmaz (aksi halde sayfa yüklenemez)
    const [t, u] = await Promise.all([
      api.get("/tenant/me"),
      isAdmin ? api.get("/users") : Promise.resolve({ data: [] }),
    ]);
    setTenant(t.data); setUsers(u.data);
    setFaultZones(t.data.custom_fault_zones || []);
    // Kişisel profildeki firma bağlantıları firma alanlarını kilitler
    api.get("/profile").then(({ data }) => setProfile(data)).catch(() => setProfile(null));
  };
  useEffect(() => { load().catch(() => toast.error("Ayarlar yüklenemedi")); /* eslint-disable-next-line */ }, [user]);

  if (user?.role === "super_admin") {
    return <div className="max-w-lg"><Card><CardContent className="p-6"><p>Süper Admin panelini kullanın: <Link to="/admin/tenants" className="text-brand-600 underline">Firma Yönetimi</Link></p></CardContent></Card></div>;
  }
  if (!tenant) return <div>Yükleniyor…</div>;

  const saveTenant = async () => {
    try {
      // Abonelik/plan alanları yalnızca Süper Admin tarafından değiştirilir; firma kendi kaydında göndermez
      const payload = { ...tenant, custom_fault_zones: faultZones };
      ["plan", "is_active", "subscription_ends_at", "trial_ends_at", "billing_notes"].forEach((k) => delete payload[k]);
      await api.put("/tenant/me", payload);
      toast.success("Firma bilgileri kaydedildi");
      await refresh?.();
    } catch { toast.error("Kayıt başarısız"); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/tenant/me/logo", fd);
      setTenant({ ...tenant, logo_path: data.logo_path });
      toast.success("Logo yüklendi");
    } catch { toast.error("Yükleme başarısız"); }
  };

  const uploadMotoImage = async (type, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post(`/tenant/me/moto-image/${encodeURIComponent(type)}`, fd);
      const nm = { ...(tenant.custom_moto_images || {}), [type]: data.path };
      setTenant({ ...tenant, custom_moto_images: nm });
      toast.success(`${type} görseli güncellendi`);
    } catch { toast.error("Yükleme başarısız"); }
  };

  const setTheme = (k) => {
    const t = THEMES.find(x => x.key === k);
    if (!t) return;
    setTenant({ ...tenant, theme: k, primary_color: t.primary, secondary_color: t.secondary });
  };

  const addZone = () => {
    if (!newZone.trim()) return;
    setFaultZones([...faultZones, { key: newZone.trim(), cx: 200, cy: 130 }]);
    setNewZone("");
  };


  return (
    <div className="space-y-6">
      <PageHeader title="Ayarlar" />
      <Tabs defaultValue="firma">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="firma"><Building className="h-4 w-4 mr-1" />Firma Bilgileri</TabsTrigger>
          <TabsTrigger value="tema"><Palette className="h-4 w-4 mr-1" />Tema & Görseller</TabsTrigger>
          <TabsTrigger value="ariza"><MapPin className="h-4 w-4 mr-1" />Arıza Bölgeleri</TabsTrigger>
          {isAdmin && <TabsTrigger value="kullanici"><Users2 className="h-4 w-4 mr-1" />Kullanıcılar</TabsTrigger>}
        </TabsList>

        <TabsContent value="firma">
          {(profile?.link_phone || profile?.link_email || profile?.link_address) && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="note" data-testid="firm-lock-warning">
              <p>
                Bazı firma bilgileri kişisel profilinizle bağlı ve kilitli:{" "}
                <span className="font-medium">
                  {[profile.link_phone && "telefon", profile.link_email && "e-posta", profile.link_address && "adres"].filter(Boolean).join(", ")}
                </span>
                . Değiştirmek için önce bağlantıyı kaldırın.
              </p>
              <Link to="/profil" className="shrink-0 font-medium text-amber-900 underline">Profilime git</Link>
            </div>
          )}
          <Card><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center gap-4 pb-4 border-b">
              {tenant.logo_path ? <AuthedImage path={tenant.logo_path} alt="logo" className="h-16 w-16 object-contain border rounded p-1" /> :
                <div className="h-16 w-16 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400"><ImageIcon /></div>}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
              <Button variant="outline" onClick={()=>logoRef.current?.click()} disabled={!isAdmin}><Upload className="h-4 w-4 mr-2" />Logo Yükle</Button>
            </div>
            <div><Label>Firma Adı *</Label><Input value={tenant.name || ""} onChange={(e)=>setTenant({...tenant, name:e.target.value})} disabled={!isAdmin} /></div>
            <div><Label>Alt Başlık</Label><Input value={tenant.subtitle || ""} onChange={(e)=>setTenant({...tenant, subtitle:e.target.value})} disabled={!isAdmin} /></div>
            <div className="md:col-span-2"><Label>Adres {profile?.link_address && <span className="ml-1 text-xs text-amber-700">(profilinizle bağlı)</span>}</Label><Textarea rows={2} value={tenant.address || ""} onChange={(e)=>setTenant({...tenant, address:e.target.value})} disabled={!isAdmin || !!profile?.link_address} /></div>
            <div><Label>İl</Label><Input value={tenant.city || ""} onChange={(e)=>setTenant({...tenant, city:e.target.value})} disabled={!isAdmin || !!profile?.link_address} /></div>
            <div><Label>İlçe</Label><Input value={tenant.district || ""} onChange={(e)=>setTenant({...tenant, district:e.target.value})} disabled={!isAdmin || !!profile?.link_address} /></div>
            <div><Label>GSM/Telefon {profile?.link_phone && <span className="ml-1 text-xs text-amber-700">(profilinizle bağlı)</span>}</Label><Input value={tenant.phone || ""} onChange={(e)=>setTenant({...tenant, phone:e.target.value})} disabled={!isAdmin || !!profile?.link_phone} /></div>
            <div><Label>E-posta {profile?.link_email && <span className="ml-1 text-xs text-amber-700">(profilinizle bağlı)</span>}</Label><Input value={tenant.email || ""} onChange={(e)=>setTenant({...tenant, email:e.target.value})} disabled={!isAdmin || !!profile?.link_email} /></div>
            <div><Label>Vergi No</Label><Input value={tenant.tax_no || ""} onChange={(e)=>setTenant({...tenant, tax_no:e.target.value})} disabled={!isAdmin} /></div>
            <div className="md:col-span-2 pt-4 border-t"><Label className="text-slate-500 text-sm uppercase mb-2 block">Banka Bilgileri</Label></div>
            <div><Label>Banka</Label><Input value={tenant.bank_name || ""} onChange={(e)=>setTenant({...tenant, bank_name:e.target.value})} disabled={!isAdmin} /></div>
            <div><Label>Hesap Sahibi</Label><Input value={tenant.bank_account_name || ""} onChange={(e)=>setTenant({...tenant, bank_account_name:e.target.value})} disabled={!isAdmin} /></div>
            <div className="md:col-span-2"><Label>IBAN</Label><Input value={tenant.iban || ""} onChange={(e)=>setTenant({...tenant, iban:e.target.value})} disabled={!isAdmin} placeholder="TR ..." className="font-mono" /></div>
            {isAdmin && <div className="md:col-span-2"><Button className="bg-brand-500 hover:bg-brand-600" onClick={saveTenant}>Kaydet</Button></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tema">
          <Card><CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-base font-semibold">Renk Teması</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {THEMES.map(t => (
                  <button key={t.key} onClick={()=>setTheme(t.key)} disabled={!isAdmin}
                    className={`p-3 rounded-lg border-2 flex items-center gap-3 transition-colors ${tenant.theme===t.key?"border-slate-900":"border-slate-200 hover:border-slate-400"}`}
                    data-testid={`theme-${t.key}`}>
                    <span className="h-8 w-8 rounded" style={{ backgroundColor: t.primary }}></span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
              {isAdmin && <Button size="sm" className="mt-3" onClick={saveTenant}>Temayı Uygula</Button>}
            </div>
            <div>
              <Label className="text-base font-semibold">Motosiklet Tip Görselleri</Label>
              <p className="text-sm text-slate-500 mb-3">Her tip için özel bir motosiklet görseli yükleyebilirsiniz. Yüklemezseniz varsayılan silüetler kullanılır.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {MOTO_TYPES.map(t => (
                  <MotoTypeSlot key={t} type={t} currentPath={tenant.custom_moto_images?.[t]}
                    onUpload={(f)=>uploadMotoImage(t, f)} disabled={!isAdmin} />
                ))}
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ariza">
          <Card><CardContent className="p-6">
            <Label className="text-base font-semibold">Özel Arıza Bölgeleri</Label>
            <p className="text-sm text-slate-500 mb-3">Servis kabul formuna ek arıza bölgesi ekleyebilirsiniz. Bu bölgeler standart listeye eklenir.</p>
            {isAdmin && <div className="flex gap-2 mb-3 max-w-md">
              <Input placeholder="Örn. Ön Cam Sensörü" value={newZone} onChange={(e)=>setNewZone(e.target.value)} data-testid="new-zone" />
              <Button onClick={addZone} className="bg-brand-500 hover:bg-brand-600"><Plus className="h-4 w-4 mr-1" />Ekle</Button>
            </div>}
            <div className="flex flex-wrap gap-2">
              {faultZones.map((z, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-sm bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                  {z.key}
                  {isAdmin && <button onClick={()=>setFaultZones(faultZones.filter((_,x)=>x!==i))} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                </span>
              ))}
              {faultZones.length === 0 && <EmptyState className="w-full rounded-lg border border-dashed border-slate-300" title="Henüz özel bölge eklenmedi." />}
            </div>
            {isAdmin && <Button size="sm" className="mt-4 bg-brand-500 hover:bg-brand-600" onClick={saveTenant}>Kaydet</Button>}
          </CardContent></Card>
        </TabsContent>

        {isAdmin && (
        <TabsContent value="kullanici">
          <Card>
            <CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">Personel Yönetimi ({users.length})</CardTitle>
              <Dialog open={uOpen} onOpenChange={setUOpen}>
                <DialogTrigger asChild><Button className="bg-brand-500 hover:bg-brand-600"><Plus className="h-4 w-4 mr-1" />Yeni Kullanıcı</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Yeni Kullanıcı</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Ad</Label><Input value={uForm.name} onChange={(e)=>setUForm({...uForm, name:e.target.value})} /></div>
                    <div><Label>E-posta</Label><Input value={uForm.email} onChange={(e)=>setUForm({...uForm, email:e.target.value})} /></div>
                    <div><Label>Şifre</Label><Input type="password" value={uForm.password} onChange={(e)=>setUForm({...uForm, password:e.target.value})} /></div>
                    <div className="col-span-2"><Label>Rol</Label>
                      <Select value={uForm.role} onValueChange={(v)=>setUForm({...uForm, role:v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="service_advisor">Servis Danışmanı</SelectItem>
                          <SelectItem value="technician">Teknisyen</SelectItem>
                          <SelectItem value="accountant">Muhasebe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={async()=>{try{await api.post("/users", uForm); toast.success("Eklendi"); setUOpen(false); const {data}=await api.get("/users"); setUsers(data);}catch{toast.error("Başarısız");}}} className="bg-brand-500 hover:bg-brand-600">Kaydet</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Ad</th><th className="text-left px-4 py-2">E-posta</th><th className="text-left px-4 py-2">Rol</th></tr></thead>
                <tbody>{users.map(u=><tr key={u.id} className="border-t"><td className="px-4 py-2">{u.name}</td><td className="px-4 py-2">{u.email}</td><td className="px-4 py-2"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{u.role}</span></td></tr>)}</tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MotoTypeSlot({ type, currentPath, onUpload, disabled }) {
  const ref = useRef(null);
  return (
    <div className="border border-slate-200 rounded-md p-3 flex flex-col items-center gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">{type}</div>
      {currentPath ? <AuthedImage path={currentPath} className="h-16 object-contain" alt={type} /> :
        <div className="h-16 flex items-center text-slate-400 text-xs">Varsayılan görsel</div>}
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>onUpload(e.target.files?.[0])} />
      <Button size="sm" variant="outline" onClick={()=>ref.current?.click()} disabled={disabled}><Upload className="h-3 w-3 mr-1" />{currentPath?"Değiştir":"Yükle"}</Button>
    </div>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api, { API } from "../lib/api";
import AuthedImage from "../components/AuthedImage";
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
import PageVisual from "../components/PageVisual";
import { Settings as PvIcon } from "lucide-react";
import { Panel, DataTable } from "../components/design/kit";

const THEMES = [
  { key: "orange", label: "Turuncu (Varsayılan)", primary: "#F97316", secondary: "#0F172A" },
  { key: "blue", label: "Mavi", primary: "#2563EB", secondary: "#0F172A" },
  { key: "red", label: "Kırmızı", primary: "#DC2626", secondary: "#0F172A" },
  { key: "green", label: "Yeşil", primary: "#059669", secondary: "#0F172A" },
  { key: "purple", label: "Mor", primary: "#7C3AED", secondary: "#0F172A" },
  { key: "slate", label: "Slate", primary: "#475569", secondary: "#0F172A" },
];

const MOTO_TYPES = ["Scooter","Maxi Scooter","Naked","Sport","Touring","Adventure","Enduro","Cross","Chopper","Cruiser","Cafe Racer","Elektrikli"];

// Koyu tema yardımcı sınıfları (ortak ui bileşenlerinin açık renkli varsayılanlarını ezer)
const FIELD = "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 hover:border-white/20 focus-visible:border-orange-500/60 focus-visible:ring-orange-500/20 disabled:bg-white/[0.02] disabled:text-slate-500";
const LABEL = "text-slate-300";
const OUTLINE_BTN = "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white";
const DIALOG = "border-white/10 bg-[#0e1626] text-white";
const SEL_TRIGGER = "border-white/10 bg-white/[0.04] text-white";
const SEL_CONTENT = "border-white/10 bg-[#0e1626] text-white";
const CHECK = "border-white/25 data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500";
const TAB_LIST = "h-auto w-full flex-row gap-1 overflow-x-auto bg-transparent p-0 md:flex-col md:items-stretch md:overflow-visible md:sticky md:top-6";
const TAB_TRIGGER = "shrink-0 justify-start rounded-xl px-3 py-2.5 text-slate-400 hover:bg-white/5 hover:text-white data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-300 data-[state=active]:ring-1 data-[state=active]:ring-orange-500/30 data-[state=active]:shadow-none md:w-full";
const SUB_TITLE = "text-xs font-semibold uppercase tracking-wider text-slate-400";
const SUB_NOTE = "mb-3 mt-1 text-sm text-slate-400";
const CHIP = "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200";

function DarkEmpty({ title, className = "" }) {
  return (
    <div className={`flex w-full items-center justify-center rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400 ${className}`}>
      {title}
    </div>
  );
}

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
    return (
      <div className="max-w-lg">
        <Panel>
          <p className="text-slate-300">Süper Admin panelini kullanın: <Link to="/admin/tenants" className="font-medium text-orange-400 underline underline-offset-4">Firma Yönetimi</Link></p>
        </Panel>
      </div>
    );
  }
  if (!tenant) return <div className="text-slate-400">Yükleniyor…</div>;

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

  const linkedNote = (flag) => flag && <span className="ml-1 text-xs text-amber-300">(profilinizle bağlı)</span>;

  return (
    <div className="space-y-6">
      <PageHeader visual={<PageVisual icon={PvIcon} />} title="Ayarlar" description="Firma bilgileri, tema, arıza bölgeleri ve personel yönetimi" />
      <Tabs defaultValue="firma" className="grid grid-cols-1 items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="firma" className={TAB_TRIGGER}><Building className="h-4 w-4 mr-1" />Firma Bilgileri</TabsTrigger>
          <TabsTrigger value="tema" className={TAB_TRIGGER}><Palette className="h-4 w-4 mr-1" />Tema & Görseller</TabsTrigger>
          <TabsTrigger value="ariza" className={TAB_TRIGGER}><MapPin className="h-4 w-4 mr-1" />Arıza Bölgeleri</TabsTrigger>
          {isAdmin && <TabsTrigger value="kullanici" className={TAB_TRIGGER}><Users2 className="h-4 w-4 mr-1" />Kullanıcılar</TabsTrigger>}
        </TabsList>

        <div className="min-w-0">
        <TabsContent value="firma" className="mt-0">
          {(profile?.link_phone || profile?.link_email || profile?.link_address) && (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="note" data-testid="firm-lock-warning">
              <p>
                Bazı firma bilgileri kişisel profilinizle bağlı ve kilitli:{" "}
                <span className="font-medium">
                  {[profile.link_phone && "telefon", profile.link_email && "e-posta", profile.link_address && "adres"].filter(Boolean).join(", ")}
                </span>
                . Değiştirmek için önce bağlantıyı kaldırın.
              </p>
              <Link to="/profil" className="shrink-0 font-medium text-amber-200 underline underline-offset-4">Profilime git</Link>
            </div>
          )}
          <Panel title="Firma bilgileri" subtitle="Teklif, servis formu ve PDF'lerde görünen kurumsal bilgiler">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex flex-wrap items-center gap-4 border-b border-white/10 pb-4">
                {tenant.logo_path ? <AuthedImage path={tenant.logo_path} alt="logo" className="h-16 w-16 rounded-xl border border-white/10 bg-white/5 object-contain p-1" /> :
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-white/15 text-slate-400"><ImageIcon /></div>}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                <Button variant="outline" className={OUTLINE_BTN} onClick={()=>logoRef.current?.click()} disabled={!isAdmin}><Upload className="h-4 w-4 mr-2" />Logo Yükle</Button>
              </div>
              <div><Label className={LABEL}>Firma Adı *</Label><Input className={FIELD} value={tenant.name || ""} onChange={(e)=>setTenant({...tenant, name:e.target.value})} disabled={!isAdmin} /></div>
              <div><Label className={LABEL}>Alt Başlık</Label><Input className={FIELD} value={tenant.subtitle || ""} onChange={(e)=>setTenant({...tenant, subtitle:e.target.value})} disabled={!isAdmin} /></div>
              <div className="md:col-span-2"><Label className={LABEL}>Adres {linkedNote(profile?.link_address)}</Label><Textarea className={FIELD} rows={2} value={tenant.address || ""} onChange={(e)=>setTenant({...tenant, address:e.target.value})} disabled={!isAdmin || !!profile?.link_address} /></div>
              <div><Label className={LABEL}>İl</Label><Input className={FIELD} value={tenant.city || ""} onChange={(e)=>setTenant({...tenant, city:e.target.value})} disabled={!isAdmin || !!profile?.link_address} /></div>
              <div><Label className={LABEL}>İlçe</Label><Input className={FIELD} value={tenant.district || ""} onChange={(e)=>setTenant({...tenant, district:e.target.value})} disabled={!isAdmin || !!profile?.link_address} /></div>
              <div><Label className={LABEL}>GSM/Telefon {linkedNote(profile?.link_phone)}</Label><Input className={FIELD} value={tenant.phone || ""} onChange={(e)=>setTenant({...tenant, phone:e.target.value})} disabled={!isAdmin || !!profile?.link_phone} /></div>
              <div><Label className={LABEL}>E-posta {linkedNote(profile?.link_email)}</Label><Input className={FIELD} value={tenant.email || ""} onChange={(e)=>setTenant({...tenant, email:e.target.value})} disabled={!isAdmin || !!profile?.link_email} /></div>
              <div><Label className={LABEL}>Vergi No</Label><Input className={FIELD} value={tenant.tax_no || ""} onChange={(e)=>setTenant({...tenant, tax_no:e.target.value})} disabled={!isAdmin} /></div>
              <div className="md:col-span-2 border-t border-white/10 pt-4"><p className={SUB_TITLE}>Banka Bilgileri</p></div>
              <div><Label className={LABEL}>Banka</Label><Input className={FIELD} value={tenant.bank_name || ""} onChange={(e)=>setTenant({...tenant, bank_name:e.target.value})} disabled={!isAdmin} /></div>
              <div><Label className={LABEL}>Hesap Sahibi</Label><Input className={FIELD} value={tenant.bank_account_name || ""} onChange={(e)=>setTenant({...tenant, bank_account_name:e.target.value})} disabled={!isAdmin} /></div>
              <div className="md:col-span-2"><Label className={LABEL}>IBAN</Label><Input className={`${FIELD} font-mono`} value={tenant.iban || ""} onChange={(e)=>setTenant({...tenant, iban:e.target.value})} disabled={!isAdmin} placeholder="TR ..." /></div>
              {isAdmin && <div className="md:col-span-2"><Button className="bg-brand-500 hover:bg-brand-600" onClick={saveTenant}>Kaydet</Button></div>}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="tema" className="mt-0 space-y-6">
          <Panel title="Renk teması" subtitle="Firma çıktılarında ve menülerde kullanılan ana renk">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {THEMES.map(t => (
                <button key={t.key} onClick={()=>setTheme(t.key)} disabled={!isAdmin}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${tenant.theme===t.key ? "border-orange-500 bg-orange-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                  data-testid={`theme-${t.key}`}>
                  <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-white/15" style={{ backgroundColor: t.primary }}></span>
                  <span className="text-sm font-medium text-slate-200">{t.label}</span>
                </button>
              ))}
            </div>
            {isAdmin && <Button size="sm" className="mt-4 bg-brand-500 hover:bg-brand-600" onClick={saveTenant}>Temayı Uygula</Button>}
          </Panel>
          <Panel title="Motosiklet tip görselleri" subtitle="Her tip için özel görsel yükleyebilirsiniz. Yüklemezseniz varsayılan silüetler kullanılır.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {MOTO_TYPES.map(t => (
                <MotoTypeSlot key={t} type={t} currentPath={tenant.custom_moto_images?.[t]}
                  onUpload={(f)=>uploadMotoImage(t, f)} disabled={!isAdmin} />
              ))}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="ariza" className="mt-0">
          <Panel title="Özel arıza bölgeleri" subtitle="Servis kabul formuna ek arıza bölgesi ekleyebilirsiniz. Bu bölgeler standart listeye eklenir.">
            {isAdmin && <div className="mb-4 flex max-w-md gap-2">
              <Input className={FIELD} placeholder="Örn. Ön Cam Sensörü" value={newZone} onChange={(e)=>setNewZone(e.target.value)} data-testid="new-zone" />
              <Button onClick={addZone} className="bg-brand-500 hover:bg-brand-600"><Plus className="h-4 w-4 mr-1" />Ekle</Button>
            </div>}
            <div className="flex flex-wrap gap-2">
              {faultZones.map((z, i) => (
                <span key={i} className={CHIP}>
                  {z.key}
                  {isAdmin && <button onClick={()=>setFaultZones(faultZones.filter((_,x)=>x!==i))} className="text-rose-400 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>}
                </span>
              ))}
              {faultZones.length === 0 && <DarkEmpty title="Henüz özel bölge eklenmedi." />}
            </div>
            {isAdmin && <Button size="sm" className="mt-4 bg-brand-500 hover:bg-brand-600" onClick={saveTenant}>Kaydet</Button>}
          </Panel>
        </TabsContent>

        {isAdmin && (
        <TabsContent value="kullanici" className="mt-0">
          <Panel
            title={`Personel yönetimi (${users.length})`}
            subtitle="Firmanızdaki kullanıcılar ve rolleri"
            bodyClassName="!p-0"
            action={
              <Dialog open={uOpen} onOpenChange={setUOpen}>
                <DialogTrigger asChild><Button className="bg-brand-500 hover:bg-brand-600"><Plus className="h-4 w-4 mr-1" />Yeni Kullanıcı</Button></DialogTrigger>
                <DialogContent className={DIALOG}><DialogHeader><DialogTitle>Yeni Kullanıcı</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label className={LABEL}>Ad</Label><Input className={FIELD} value={uForm.name} onChange={(e)=>setUForm({...uForm, name:e.target.value})} /></div>
                    <div><Label className={LABEL}>E-posta</Label><Input className={FIELD} value={uForm.email} onChange={(e)=>setUForm({...uForm, email:e.target.value})} /></div>
                    <div><Label className={LABEL}>Şifre</Label><Input className={FIELD} type="password" value={uForm.password} onChange={(e)=>setUForm({...uForm, password:e.target.value})} /></div>
                    <div className="col-span-2"><Label className={LABEL}>Rol</Label>
                      <Select value={uForm.role} onValueChange={(v)=>setUForm({...uForm, role:v})}>
                        <SelectTrigger className={SEL_TRIGGER}><SelectValue /></SelectTrigger>
                        <SelectContent className={SEL_CONTENT}>
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
            }
          >
            <DataTable>
              <thead><tr><th className="px-4 py-2 text-left">Ad</th><th className="px-4 py-2 text-left">E-posta</th><th className="px-4 py-2 text-left">Rol</th></tr></thead>
              <tbody>{users.map(u=><tr key={u.id}><td className="px-4 py-2">{u.name}</td><td className="px-4 py-2 text-slate-300">{u.email}</td><td className="px-4 py-2"><span className="rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300">{u.role}</span></td></tr>)}</tbody>
            </DataTable>
          </Panel>
        </TabsContent>
        )}
        </div>
      </Tabs>
    </div>
  );
}

function MotoTypeSlot({ type, currentPath, onUpload, disabled }) {
  const ref = useRef(null);
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">{type}</div>
      {currentPath ? <AuthedImage path={currentPath} className="h-16 object-contain" alt={type} /> :
        <div className="flex h-16 items-center text-xs text-slate-400">Varsayılan görsel</div>}
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>onUpload(e.target.files?.[0])} />
      <Button size="sm" variant="outline" className={OUTLINE_BTN} onClick={()=>ref.current?.click()} disabled={disabled}><Upload className="h-3 w-3 mr-1" />{currentPath?"Değiştir":"Yükle"}</Button>
    </div>
  );
}

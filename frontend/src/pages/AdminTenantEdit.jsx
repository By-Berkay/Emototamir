import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Upload, ArrowLeft, Save, KeyRound, Trash2, Plus, Building2, Palette, MapPin, Users2, Type, Eye, CreditCard } from "lucide-react";
import { toast } from "sonner";

const THEMES = [
  { key: "orange", label: "Turuncu", primary: "#F97316" },
  { key: "blue", label: "Mavi", primary: "#2563EB" },
  { key: "red", label: "Kırmızı", primary: "#DC2626" },
  { key: "green", label: "Yeşil", primary: "#059669" },
  { key: "purple", label: "Mor", primary: "#7C3AED" },
  { key: "slate", label: "Slate", primary: "#475569" },
];
const FONTS = ["IBM Plex Sans", "Inter", "Roboto", "Open Sans", "Poppins", "Chivo", "Manrope", "Lato"];
const MOTO_TYPES = ["Scooter","Maxi Scooter","Naked","Sport","Touring","Adventure","Enduro","Cross","Chopper","Cruiser","Cafe Racer","Elektrikli"];
const ROLES = [{v:"admin",l:"Admin"},{v:"service_advisor",l:"Servis Danışmanı"},{v:"technician",l:"Teknisyen"},{v:"accountant",l:"Muhasebe"}];

export default function AdminTenantEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState(null);
  const [newZone, setNewZone] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [pwNew, setPwNew] = useState("");
  const [newUser, setNewUser] = useState({ name:"", email:"", password:"", role:"admin" });
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKind, setPreviewKind] = useState("kabul");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const logoRef = useRef(null);

  const load = () => api.get(`/admin/tenants/${id}`).then(r => setT(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  // release object URL when preview modal closes
  useEffect(() => {
    if (!previewOpen && previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  }, [previewOpen]); // eslint-disable-line

  if (!t) return <div>Yükleniyor…</div>;

  const upd = (patch) => setT({ ...t, ...patch });

  const saveTenant = async () => {
    try {
      if (applyAll) {
        // Apply UI/theme fields to all tenants; save this tenant's full data separately
        const globalFields = {
          theme: t.theme, primary_color: t.primary_color, secondary_color: t.secondary_color,
          font_family: t.font_family, custom_labels: t.custom_labels || {},
        };
        await api.put("/admin/apply-global", { fields: globalFields, tenant_ids: null });
        toast.success("Tüm firmalara uygulandı");
      }
      const payload = { ...t };
      delete payload.users; delete payload.stats; delete payload.id; delete payload.created_at;
      await api.put(`/admin/tenants/${id}`, payload);
      toast.success("Firma kaydedildi");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Kayıt başarısız"); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post(`/admin/tenants/${id}/logo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      upd({ logo_path: data.logo_path });
      toast.success("Logo yüklendi");
    } catch { toast.error("Yükleme başarısız"); }
  };

  const uploadMotoImg = async (type, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post(`/admin/tenants/${id}/moto-image/${encodeURIComponent(type)}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      upd({ custom_moto_images: { ...(t.custom_moto_images||{}), [type]: data.path } });
      toast.success(`${type} güncellendi`);
    } catch { toast.error("Yükleme başarısız"); }
  };

  const setTheme = (k) => {
    const th = THEMES.find(x => x.key === k);
    if (th) upd({ theme: k, primary_color: th.primary });
  };

  const resetPassword = async () => {
    if (!pwNew) return toast.error("Yeni şifre girin");
    try {
      await api.put(`/admin/users/${pwUser.id}/password`, { new_password: pwNew });
      toast.success(`${pwUser.email} şifresi güncellendi`);
      setPwUser(null); setPwNew("");
    } catch { toast.error("Şifre değiştirme başarısız"); }
  };

  const delUser = async (u) => {
    if (!window.confirm(`${u.email} kullanıcısı silinsin mi?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    toast.success("Kullanıcı silindi"); load();
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) return toast.error("Tüm alanlar zorunlu");
    try {
      await api.post(`/admin/tenants/${id}/users`, newUser);
      toast.success("Kullanıcı oluşturuldu");
      setNewUserOpen(false); setNewUser({ name:"", email:"", password:"", role:"admin" }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Başarısız"); }
  };

  const openPdfPreview = async (kind) => {
    setPreviewKind(kind); setPreviewOpen(true); setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const payload = { ...t };
      delete payload.users; delete payload.stats;
      const res = await api.post("/admin/pdf-preview", { tenant: payload, kind }, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setPreviewUrl(url);
    } catch { toast.error("Önizleme oluşturulamadı"); }
    finally { setPreviewLoading(false); }
  };

  const token = localStorage.getItem("token");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={()=>nav("/admin/tenants")}><ArrowLeft className="h-4 w-4 mr-1" />Firmalar</Button>
          <h1 className="font-heading text-3xl font-bold text-slate-900 mt-2">{t.name}</h1>
          <p className="text-sm text-slate-500">Süper Admin — tüm ayarlara erişim</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={applyAll} onCheckedChange={setApplyAll} data-testid="apply-all" />
            Tema/font tüm firmalara uygulansın
          </label>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={saveTenant} data-testid="save-tenant"><Save className="h-4 w-4 mr-2" />Kaydet</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Kullanıcı" value={t.stats?.users || t.users?.length} />
        <StatCard label="Müşteri" value={t.stats?.customers} />
        <StatCard label="Motosiklet" value={t.stats?.motorcycles} />
        <StatCard label="Servis" value={t.stats?.orders} />
      </div>

      <Tabs defaultValue="firma">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="firma"><Building2 className="h-4 w-4 mr-1" />Firma</TabsTrigger>
          <TabsTrigger value="pdf"><Type className="h-4 w-4 mr-1" />PDF Şablonu</TabsTrigger>
          <TabsTrigger value="tema"><Palette className="h-4 w-4 mr-1" />Tema & Görsel</TabsTrigger>
          <TabsTrigger value="ariza"><MapPin className="h-4 w-4 mr-1" />Arıza Bölgeleri</TabsTrigger>
          <TabsTrigger value="abonelik"><CreditCard className="h-4 w-4 mr-1" />Abonelik</TabsTrigger>
          <TabsTrigger value="users"><Users2 className="h-4 w-4 mr-1" />Kullanıcılar & Şifre</TabsTrigger>
        </TabsList>

        <TabsContent value="firma">
          <Card><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center gap-4 pb-4 border-b">
              {t.logo_path ? <img src={`${API}/files/${t.logo_path}?auth=${token}`} className="h-16 w-16 object-contain border rounded p-1" alt="logo" /> :
                <div className="h-16 w-16 border-2 border-dashed rounded flex items-center justify-center text-slate-400"><Upload /></div>}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
              <Button variant="outline" onClick={()=>logoRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Logo Değiştir</Button>
            </div>
            <div><Label>Firma Adı</Label><Input value={t.name||""} onChange={(e)=>upd({name:e.target.value})} /></div>
            <div><Label>Alt Başlık</Label><Input value={t.subtitle||""} onChange={(e)=>upd({subtitle:e.target.value})} /></div>
            <div className="md:col-span-2"><Label>Adres</Label><Textarea rows={2} value={t.address||""} onChange={(e)=>upd({address:e.target.value})} /></div>
            <div><Label>İl</Label><Input value={t.city||""} onChange={(e)=>upd({city:e.target.value})} /></div>
            <div><Label>İlçe</Label><Input value={t.district||""} onChange={(e)=>upd({district:e.target.value})} /></div>
            <div><Label>Telefon</Label><Input value={t.phone||""} onChange={(e)=>upd({phone:e.target.value})} /></div>
            <div><Label>E-posta</Label><Input value={t.email||""} onChange={(e)=>upd({email:e.target.value})} /></div>
            <div className="md:col-span-2 pt-4 border-t"><Label className="uppercase text-slate-500 text-xs">Banka</Label></div>
            <div><Label>Banka</Label><Input value={t.bank_name||""} onChange={(e)=>upd({bank_name:e.target.value})} /></div>
            <div><Label>Hesap Sahibi</Label><Input value={t.bank_account_name||""} onChange={(e)=>upd({bank_account_name:e.target.value})} /></div>
            <div className="md:col-span-2"><Label>IBAN</Label><Input value={t.iban||""} onChange={(e)=>upd({iban:e.target.value})} className="font-mono" /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Card><CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-base font-semibold">PDF Şablonu</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=>openPdfPreview("kabul")} data-testid="pdf-preview-kabul"><Eye className="h-3.5 w-3.5 mr-1" />Kabul Önizle</Button>
                <Button variant="outline" size="sm" onClick={()=>openPdfPreview("teslim")} data-testid="pdf-preview-teslim"><Eye className="h-3.5 w-3.5 mr-1" />Teslim Önizle</Button>
              </div>
            </div>
            <div>
              <Label>PDF Başlık Metni (Kabul/Teslim)</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <Input placeholder="Kabul başlığı — örn. SERVİS KABUL FORMU" value={t.pdf_template?.kabul_title||""} onChange={(e)=>upd({pdf_template:{...(t.pdf_template||{}), kabul_title:e.target.value}})} data-testid="pdf-kabul-title" />
                <Input placeholder="Teslim başlığı" value={t.pdf_template?.teslim_title||""} onChange={(e)=>upd({pdf_template:{...(t.pdf_template||{}), teslim_title:e.target.value}})} data-testid="pdf-teslim-title" />
              </div>
            </div>
            <div>
              <Label>PDF Alt Not (Footer)</Label>
              <Textarea rows={2} value={t.pdf_template?.footer_note||""} onChange={(e)=>upd({pdf_template:{...(t.pdf_template||{}), footer_note:e.target.value}})} placeholder="Örn: 15 gün garanti — bu form karşılıklı imzalanmıştır" data-testid="pdf-footer" />
            </div>
            <div className="text-sm text-slate-500 border-t pt-3">
              <p><b>İpucu:</b> Değişiklikleri kaydetmeden <b>Önizle</b> ile canlı PDF görebilirsiniz. Firma adı, adres, telefon, banka ve IBAN <b>Firma</b> sekmesinden; renk teması <b>Tema</b> sekmesinden yönetilir — tümü PDF'e otomatik yansır.</p>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="abonelik">
          <Card><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Plan</Label>
              <Select value={t.plan || "trial"} onValueChange={(v)=>upd({plan:v})}>
                <SelectTrigger data-testid="sub-plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Deneme</SelectItem>
                  <SelectItem value="basic">Temel</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Kurumsal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Durum</Label>
              <Select value={(t.is_active===false)?"passive":"active"} onValueChange={(v)=>upd({is_active: v==="active"})}>
                <SelectTrigger data-testid="sub-active"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="passive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deneme Bitiş</Label>
              <Input type="date" value={(t.trial_ends_at||"").slice(0,10)} onChange={(e)=>upd({trial_ends_at: e.target.value ? new Date(e.target.value+"T23:59:59Z").toISOString() : null})} data-testid="sub-trial-ends" />
            </div>
            <div>
              <Label>Abonelik Bitiş</Label>
              <Input type="date" value={(t.subscription_ends_at||"").slice(0,10)} onChange={(e)=>upd({subscription_ends_at: e.target.value ? new Date(e.target.value+"T23:59:59Z").toISOString() : null})} data-testid="sub-ends" />
            </div>
            <div className="md:col-span-2">
              <Label>Ödeme / Sözleşme Notu</Label>
              <Textarea rows={3} value={t.billing_notes||""} onChange={(e)=>upd({billing_notes:e.target.value})} placeholder="Örn: Aylık 2.500 ₺ — havale ile ödeme, 15 Şubat" data-testid="sub-notes" />
            </div>
            <div className="md:col-span-2 text-sm text-slate-500 border-t pt-3">
              <p><b>Not:</b> Bitiş tarihi geçen firma otomatik <b>Pasif</b> hale gelir ve kullanıcıları giriş yapamaz. Yeni abonelik girildiğinde <b>Aktif</b> yaparak tekrar açabilirsiniz.</p>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tema">
          <Card><CardContent className="p-6 space-y-6">
            <div>
              <Label className="text-base font-semibold">Renk Teması</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {THEMES.map(th => (
                  <button key={th.key} onClick={()=>setTheme(th.key)}
                    className={`p-3 rounded-lg border-2 flex items-center gap-3 ${t.theme===th.key?"border-slate-900":"border-slate-200 hover:border-slate-400"}`}>
                    <span className="h-8 w-8 rounded" style={{ backgroundColor: th.primary }}></span>
                    <span className="text-sm font-medium">{th.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div><Label>Ana Renk (Hex)</Label><Input value={t.primary_color||""} onChange={(e)=>upd({primary_color:e.target.value})} className="font-mono" /></div>
                <div><Label>İkincil Renk (Hex)</Label><Input value={t.secondary_color||""} onChange={(e)=>upd({secondary_color:e.target.value})} className="font-mono" /></div>
              </div>
            </div>
            <div>
              <Label className="text-base font-semibold">Yazı Tipi</Label>
              <Select value={t.font_family||"IBM Plex Sans"} onValueChange={(v)=>upd({font_family:v})}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>{FONTS.map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base font-semibold">Motosiklet Tip Görselleri</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {MOTO_TYPES.map(mt => (
                  <MotoImageSlot key={mt} type={mt} currentPath={t.custom_moto_images?.[mt]} token={token} onUpload={(f)=>uploadMotoImg(mt, f)} />
                ))}
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ariza">
          <Card><CardContent className="p-6">
            <Label>Özel Arıza Bölgeleri</Label>
            <div className="flex gap-2 mb-3 max-w-md mt-2">
              <Input placeholder="Yeni bölge adı" value={newZone} onChange={(e)=>setNewZone(e.target.value)} />
              <Button onClick={()=>{if(!newZone.trim())return; upd({custom_fault_zones:[...(t.custom_fault_zones||[]),{key:newZone.trim(),cx:200,cy:130}]}); setNewZone("");}} className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(t.custom_fault_zones||[]).map((z,i)=>(
                <span key={i} className="inline-flex items-center gap-2 text-sm bg-slate-100 border rounded-full px-3 py-1">
                  {z.key}
                  <button onClick={()=>upd({custom_fault_zones:(t.custom_fault_zones||[]).filter((_,x)=>x!==i)})} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="users">
          <Card><CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">Kullanıcılar</CardTitle>
            <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
              <DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-1" />Yeni Kullanıcı</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Yeni Kullanıcı</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Ad</Label><Input value={newUser.name} onChange={(e)=>setNewUser({...newUser,name:e.target.value})} /></div>
                  <div><Label>E-posta</Label><Input value={newUser.email} onChange={(e)=>setNewUser({...newUser,email:e.target.value})} /></div>
                  <div><Label>Şifre</Label><Input type="password" value={newUser.password} onChange={(e)=>setNewUser({...newUser,password:e.target.value})} /></div>
                  <div className="col-span-2"><Label>Rol</Label>
                    <Select value={newUser.role} onValueChange={(v)=>setNewUser({...newUser,role:v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map(r=><SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={createUser} className="bg-orange-500 hover:bg-orange-600">Oluştur</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Ad</th><th className="text-left px-4 py-2">E-posta</th><th className="text-left px-4 py-2">Rol</th><th className="w-32"></th></tr></thead>
              <tbody>{(t.users||[]).map(u=>(
                <tr key={u.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2">{u.name}</td><td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{u.role}</span></td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={()=>setPwUser(u)} className="text-slate-700" data-testid={`reset-pw-${u.id}`}><KeyRound className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={()=>delUser(u)} className="text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            <div className="p-4 border-t bg-slate-50 text-xs text-slate-600">
              <b>Not:</b> Şifre değiştirme yetkisi yalnızca Süper Admin'de. Firma yöneticileri kendi ekiplerinden şifre değiştiremez.
            </div>
          </CardContent></Card>

          <Dialog open={!!pwUser} onOpenChange={(o)=>{ if(!o){setPwUser(null); setPwNew("");} }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Şifre Sıfırla — {pwUser?.email}</DialogTitle></DialogHeader>
              <Label>Yeni Şifre</Label>
              <Input type="password" value={pwNew} onChange={(e)=>setPwNew(e.target.value)} data-testid="new-password" />
              <DialogFooter>
                <Button variant="outline" onClick={()=>{setPwUser(null); setPwNew("");}}>İptal</Button>
                <Button onClick={resetPassword} className="bg-orange-500 hover:bg-orange-600" data-testid="save-password">Şifreyi Değiştir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* PDF Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>PDF Önizleme — {previewKind === "kabul" ? "Servis Kabul Formu" : "Servis Teslim Formu"}</DialogTitle>
            <p className="text-xs text-slate-500">Örnek servis verisi ile canlı önizleme — kaydetmeden önce kontrol edin.</p>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 overflow-hidden" data-testid="pdf-preview-frame">
            {previewLoading && <div className="h-full flex items-center justify-center text-slate-500">PDF hazırlanıyor…</div>}
            {!previewLoading && previewUrl && (
              <iframe title="preview" src={previewUrl} className="w-full h-full border-0" />
            )}
          </div>
          <DialogFooter className="p-3 border-t">
            <Button variant="outline" onClick={()=>openPdfPreview(previewKind)}>Yenile</Button>
            <Button variant="outline" onClick={()=>setPreviewOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }) {
  return <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">{label}</div><div className="text-2xl font-bold">{value ?? 0}</div></CardContent></Card>;
}

function MotoImageSlot({ type, currentPath, token, onUpload }) {
  const ref = useRef(null);
  return (
    <div className="border border-slate-200 rounded-md p-3 flex flex-col items-center gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">{type}</div>
      {currentPath ? <img src={`${API}/files/${currentPath}?auth=${token}`} className="h-20 object-contain" alt={type} /> :
        <div className="h-20 flex items-center text-slate-400 text-xs">Varsayılan silüet</div>}
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>onUpload(e.target.files?.[0])} />
      <Button size="sm" variant="outline" onClick={()=>ref.current?.click()}><Upload className="h-3 w-3 mr-1" />{currentPath?"Değiştir":"Yükle"}</Button>
    </div>
  );
}

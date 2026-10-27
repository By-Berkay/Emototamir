import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { UserRound, Link2, Link2Off, ShieldAlert, KeyRound } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";

const ROLE_LABELS = {
  super_admin: "Süper Admin",
  admin: "Firma Yöneticisi",
  service_advisor: "Servis Danışmanı",
  technician: "Teknisyen",
  accountant: "Muhasebe",
};

// Her bağlantı anahtarı: kişisel alanlar ve firma alanları ile etiket
const LINKS = {
  phone: { label: "Firma telefonumla aynı", fields: ["phone"], firm: ["phone"], firmLabel: "Firma telefonu" },
  email: { label: "Firma e-postamla aynı", fields: ["contact_email"], firm: ["email"], firmLabel: "Firma e-postası" },
  address: {
    label: "Firma adresimle aynı",
    fields: ["address", "city", "district"],
    firm: ["address", "city", "district"],
    firmLabel: "Firma adresi",
  },
};

const FORM_KEYS = ["name", "phone", "contact_email", "address", "city", "district", "link_phone", "link_email", "link_address"];

function toForm(p) {
  return FORM_KEYS.reduce((acc, k) => ({ ...acc, [k]: p[k] ?? (k.startsWith("link_") ? false : "") }), {});
}

function LinkToggle({ id, checked, onChange, disabled, label }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
        data-testid={`chk-${id}`}
      />
      {checked ? <Link2 className="h-4 w-4 text-brand-600" aria-hidden="true" /> : <Link2Off className="h-4 w-4 text-slate-400" aria-hidden="true" />}
      {label}
    </label>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const isSuper = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    api.get("/profile")
      .then(({ data }) => { setProfile(data); setForm(toForm(data)); })
      .catch(() => toast.error("Profil yüklenemedi"));
  }, []);

  if (!profile || !form) return <div>Yükleniyor…</div>;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const anyLinked = Object.keys(LINKS).some((k) => form[`link_${k}`]);

  // Bağlantıyı açarken firma değeri farklıysa kullanıcıdan onay alınır
  const toggleLink = (key, checked) => {
    const def = LINKS[key];
    if (checked) {
      const typed = def.fields.map((f) => (form[f] || "").trim());
      const firmVals = def.firm.map((f) => profile.firm?.[f === "email" ? "email" : f] || "");
      const hasInput = typed.some(Boolean);
      const differs = typed.some((v, i) => v && v !== firmVals[i]);
      if (hasInput && differs && isAdmin) {
        const shown = typed.filter(Boolean).join(", ");
        if (!window.confirm(`${def.firmLabel} "${shown}" olarak güncellenecek. Onaylıyor musunuz?`)) return;
      }
      if (!hasInput && !firmVals.some(Boolean)) {
        toast.error("Önce bu alanı doldurun");
        return;
      }
    }
    setForm((f) => ({ ...f, [`link_${key}`]: checked }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || form.name.trim().length < 2) {
      toast.error("Ad soyad en az 2 karakter olmalıdır");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put("/profile", form);
      setProfile(data);
      setForm(toForm(data));
      await refresh();
      toast.success("Profil kaydedildi");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Profil kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  // Bağlı bir alan, firma bilgisinden okunur ve düzenlenemez
  const isLocked = (key) => !isSuper && profile.has_firm && !!form[`link_${key}`];
  const hint = (key) =>
    isLocked(key) ? (
      <p className="mt-1 text-xs text-brand-700">Firma bilgisinden alınıyor. Düzenlemek için bağlantıyı kaldırın.</p>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profilim" description="Kişisel bilgilerinizi ve iletişim bilgilerinizi yönetin" />

      <form onSubmit={save} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" /> Hesap</CardTitle>
              <CardDescription>Oturumda görünen adınız ve giriş bilgileriniz</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="p-name">Ad Soyad *</Label>
                <Input id="p-name" value={form.name} onChange={set("name")} data-testid="input-profile-name" />
              </div>
              <div>
                <Label htmlFor="p-login">Giriş e-postası</Label>
                <Input id="p-login" value={profile.email} disabled data-testid="input-profile-login" />
                <p className="mt-1 text-xs text-slate-500">Giriş e-postası Süper Admin tarafından değiştirilir.</p>
              </div>
              <div>
                <Label>Rol</Label>
                <div className="pt-2"><Badge variant="outline">{ROLE_LABELS[profile.role] || profile.role}</Badge></div>
              </div>
              <div className="flex items-end">
                <Button asChild variant="outline" type="button">
                  <Link to="/account/password"><KeyRound className="mr-2 h-4 w-4" />Şifre değiştir</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">İletişim bilgileri</CardTitle>
              <CardDescription>
                {isSuper
                  ? "Süper Admin hesabı firma bilgilerine bağlı değildir."
                  : "Bir alanı firma bilgilerinizle eşitlemek için ilgili kutucuğu işaretleyin."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {anyLinked && (
                <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Bağlı alanlar firma kaydındaki bilgiyi gösterir. Firma bilgilerini Ayarlar &gt; Firma Bilgileri
                    ekranından değiştirmek için önce buradaki bağlantıyı kaldırıp kaydedin.
                  </p>
                </div>
              )}

              {/* Telefon */}
              {!isSuper && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="p-phone">Telefon</Label>
                    <LinkToggle id="link-phone" checked={!!form.link_phone} disabled={!profile.has_firm && !isAdmin}
                      onChange={(c) => toggleLink("phone", c)} label={LINKS.phone.label} />
                  </div>
                  <Input id="p-phone" value={form.phone} onChange={set("phone")} disabled={isLocked("phone")}
                    placeholder="05xx xxx xx xx" data-testid="input-profile-phone" />
                  {hint("phone")}
                </div>
              )}
              {isSuper && (
                <div>
                  <Label htmlFor="p-phone">Telefon</Label>
                  <Input id="p-phone" value={form.phone} onChange={set("phone")} className="mt-2" data-testid="input-profile-phone" />
                </div>
              )}

              {/* E-posta */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="p-cemail">İletişim e-postası</Label>
                  {!isSuper && (
                    <LinkToggle id="link-email" checked={!!form.link_email} disabled={!profile.has_firm && !isAdmin}
                      onChange={(c) => toggleLink("email", c)} label={LINKS.email.label} />
                  )}
                </div>
                <Input id="p-cemail" type="email" value={form.contact_email} onChange={set("contact_email")}
                  disabled={isLocked("email")} data-testid="input-profile-email" />
                {hint("email")}
              </div>

              {/* Adres */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="p-address">Adres</Label>
                  {!isSuper && (
                    <LinkToggle id="link-address" checked={!!form.link_address} disabled={!profile.has_firm && !isAdmin}
                      onChange={(c) => toggleLink("address", c)} label={LINKS.address.label} />
                  )}
                </div>
                <textarea id="p-address" rows={2} value={form.address} onChange={set("address")} disabled={isLocked("address")}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  data-testid="input-profile-address" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="p-city">İl</Label>
                    <Input id="p-city" value={form.city} onChange={set("city")} disabled={isLocked("address")} className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="p-district">İlçe</Label>
                    <Input id="p-district" value={form.district} onChange={set("district")} disabled={isLocked("address")} className="mt-2" />
                  </div>
                </div>
                {hint("address")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!isSuper && profile.has_firm && profile.firm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Firma kaydı (salt okunur)</CardTitle>
                <CardDescription>Firma bilgilerini yalnızca firma yöneticisi değiştirebilir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p><span className="text-slate-500">Telefon:</span> {profile.firm.phone || "—"}</p>
                <p><span className="text-slate-500">E-posta:</span> {profile.firm.email || "—"}</p>
                <p><span className="text-slate-500">Adres:</span> {[profile.firm.address, profile.firm.district, profile.firm.city].filter(Boolean).join(", ") || "—"}</p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link to="/settings">Firma bilgilerine git</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <Button type="submit" disabled={saving} className="w-full" data-testid="btn-profile-save">
            {saving ? "Kaydediliyor…" : "Profili kaydet"}
          </Button>
        </div>
      </form>
    </div>
  );
}

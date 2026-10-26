import React, { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const ICON_NAMES = ["ClipboardList", "Bike", "Users", "BellRing", "FileText", "BarChart3", "Building2", "ShieldCheck", "Wrench"];
const newId = () => `plan-${Math.random().toString(36).slice(2, 8)}`;

/** Süper Admin: ana sayfa (vitrin) içeriği, iletişim ve SaaS planları. */
export default function AdminLanding() {
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/landing").then(({ data }) => setC(data)).catch(() => toast.error("İçerik yüklenemedi"));
  }, []);

  if (!c) return <div className="text-slate-500">Yükleniyor…</div>;

  const set = (path, value) => setC((prev) => {
    const next = structuredClone(prev);
    const keys = path.split(".");
    let node = next;
    keys.slice(0, -1).forEach((k) => { node = node[k]; });
    node[keys[keys.length - 1]] = value;
    return next;
  });

  const setList = (key, idx, field, value) => setC((prev) => {
    const list = prev[key].map((x, i) => (i === idx ? { ...x, [field]: value } : x));
    return { ...prev, [key]: list };
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/landing", c);
      toast.success("Vitrin içeriği yayınlandı");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vitrin & Fiyatlar"
        description="Giriş yapmamış ziyaretçilerin gördüğü ana sayfa: metinler, iletişim, özellikler ve SaaS planları."
        actions={<Button onClick={save} disabled={saving} data-testid="btn-save-landing"><Save className="mr-2 h-4 w-4" />{saving ? "Kaydediliyor…" : "Yayınla"}</Button>}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">İletişim</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Telefon (görünen)</Label><Input value={c.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>WhatsApp numarası (ülke koduyla, +ve boşluk olmadan)</Label><Input value={c.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ana başlık (hero)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Rozet</Label><Input value={c.hero.badge} onChange={(e) => set("hero.badge", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Başlık</Label><Input value={c.hero.title} onChange={(e) => set("hero.title", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Açıklama</Label><Textarea rows={3} value={c.hero.description} onChange={(e) => set("hero.description", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Özellikler
            <Button variant="outline" size="sm" onClick={() => set("features", [...c.features, { icon: "Wrench", title: "", text: "" }])}>
              <Plus className="mr-1 h-4 w-4" /> Ekle
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Bölüm etiketi</Label><Input value={c.features_heading.eyebrow} onChange={(e) => set("features_heading.eyebrow", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bölüm başlığı</Label><Input value={c.features_heading.title} onChange={(e) => set("features_heading.title", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bölüm açıklaması</Label><Input value={c.features_heading.description} onChange={(e) => set("features_heading.description", e.target.value)} /></div>
          </div>
          {c.features.map((f, i) => (
            <div key={i} className="grid items-start gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[140px_1fr_2fr_auto]">
              <select className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm" value={f.icon}
                      onChange={(e) => setList("features", i, "icon", e.target.value)}>
                {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <Input placeholder="Başlık" value={f.title} onChange={(e) => setList("features", i, "title", e.target.value)} />
              <Input placeholder="Açıklama" value={f.text} onChange={(e) => setList("features", i, "text", e.target.value)} />
              <Button variant="ghost" size="icon" onClick={() => set("features", c.features.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Planlar (SaaS)
            <Button variant="outline" size="sm" onClick={() => set("plans", [...c.plans, { id: newId(), name: "", price_text: "", period: "", highlight: false, features: [] }])}>
              <Plus className="mr-1 h-4 w-4" /> Plan ekle
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Bölüm etiketi</Label><Input value={c.pricing_heading.eyebrow} onChange={(e) => set("pricing_heading.eyebrow", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bölüm başlığı</Label><Input value={c.pricing_heading.title} onChange={(e) => set("pricing_heading.title", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bölüm açıklaması</Label><Input value={c.pricing_heading.description} onChange={(e) => set("pricing_heading.description", e.target.value)} /></div>
          </div>
          {c.plans.map((p, i) => (
            <div key={p.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end">
                <div className="space-y-1.5"><Label>Ad</Label><Input value={p.name} onChange={(e) => setList("plans", i, "name", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Fiyat</Label><Input value={p.price_text} onChange={(e) => setList("plans", i, "price_text", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Periyot</Label><Input value={p.period} onChange={(e) => setList("plans", i, "period", e.target.value)} /></div>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.highlight} onChange={(e) => setList("plans", i, "highlight", e.target.checked)} /> Öne çıkar
                </label>
                <Button variant="ghost" size="icon" onClick={() => set("plans", c.plans.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Özellikler (her satıra bir madde)</Label>
                <Textarea rows={4} value={p.features.join("\n")}
                          onChange={(e) => setList("plans", i, "features", e.target.value.split("\n").filter((x) => x.trim()))} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Alt çağrı (CTA)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Başlık</Label><Input value={c.cta.title} onChange={(e) => set("cta.title", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Metin</Label><Input value={c.cta.text} onChange={(e) => set("cta.text", e.target.value)} /></div>
        </CardContent>
      </Card>
    </div>
  );
}

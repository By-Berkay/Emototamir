import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Globe, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import api, { fmtDate } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const MAX_PACKAGES = 12;
const MAX_ITEMS = 300;

// Düzenleme sırasında her satır için kararlı bir React anahtarı.
const uid = () => Math.random().toString(36).slice(2, 10);
const newPackageId = () => `pkg-${Date.now()}`;

const toPkgRow = (p) => ({
  _key: uid(),
  id: p?.id ? String(p.id) : "",
  name: p?.name ?? "",
  price: p?.price == null ? "" : String(p.price),
  unit: p?.unit ?? "",
  highlight: Boolean(p?.highlight),
  features: (Array.isArray(p?.features) ? p.features : []).map((text) => ({ _key: uid(), text: String(text ?? "") })),
});

const toItemRow = (it) => ({
  _key: uid(),
  name: it?.name ?? "",
  description: it?.description ?? "",
  price: it?.price == null ? "" : String(it.price),
  unit: it?.unit ?? "",
});

const newPackage = () => ({ _key: uid(), id: newPackageId(), name: "", price: "", unit: "", highlight: false, features: [] });
const newItem = () => ({ _key: uid(), name: "", description: "", price: "", unit: "" });

// "1.500,50" ve "1500.5" biçimlerini kabul eder. Geçersiz veya negatifse null döner.
const parsePrice = (raw) => {
  let s = String(raw ?? "").trim();
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/** Boş satırları ayıklar, alanları doğrular ve sunucuya gidecek gövdeyi üretir. */
function buildPayload(packages, items) {
  const outPackages = [];
  const seenIds = new Set();
  for (const p of packages) {
    const name = p.name.trim();
    const unit = p.unit.trim();
    const priceRaw = String(p.price).trim();
    const features = p.features.map((f) => f.text.trim()).filter(Boolean);
    if (!name && !unit && !priceRaw && features.length === 0) continue;
    if (!name) return { error: "Paket adı boş bırakılamaz." };
    const price = parsePrice(priceRaw);
    if (price === null) return { error: `"${name}" paketinin fiyatı geçersiz. 0 veya daha büyük bir sayı girin.` };
    const id = p.id.trim() || `${newPackageId()}-${outPackages.length}`;
    if (seenIds.has(id)) return { error: `"${name}" paketinin kimliği başka bir paketle aynı. Kimlikler benzersiz olmalı.` };
    seenIds.add(id);
    outPackages.push({ id, name, price, unit, highlight: p.highlight, features });
  }
  if (outPackages.length > MAX_PACKAGES) return { error: `En fazla ${MAX_PACKAGES} paket tanımlanabilir.` };

  const outItems = [];
  for (const it of items) {
    const name = it.name.trim();
    const description = it.description.trim();
    const unit = it.unit.trim();
    const priceRaw = String(it.price).trim();
    if (!name && !description && !unit && !priceRaw) continue;
    if (!name) return { error: "Kalem adı boş bırakılamaz." };
    const price = parsePrice(priceRaw);
    if (price === null) return { error: `"${name}" kaleminin fiyatı geçersiz. 0 veya daha büyük bir sayı girin.` };
    outItems.push({ name, description, price, unit });
  }
  if (outItems.length > MAX_ITEMS) return { error: `En fazla ${MAX_ITEMS} kalem tanımlanabilir.` };

  return { payload: { packages: outPackages, items: outItems } };
}

export default function AdminPricing() {
  const [packages, setPackages] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ updated_at: null, updated_by: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const applyData = useCallback((data) => {
    setPackages((data?.packages || []).map(toPkgRow));
    setItems((data?.items || []).map(toItemRow));
    setMeta({ updated_at: data?.updated_at ?? null, updated_by: data?.updated_by ?? null });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get("/admin/pricing");
      applyData(data);
    } catch {
      setLoadError(true);
      toast.error("Fiyat listesi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    load();
  }, [load]);

  // Paket düzenleme yardımcıları
  const updatePkg = (key, patch) => setPackages((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));
  const removePkg = (key) => setPackages((prev) => prev.filter((p) => p._key !== key));
  const addPkg = () => {
    if (packages.length >= MAX_PACKAGES) {
      toast.error(`En fazla ${MAX_PACKAGES} paket ekleyebilirsiniz.`);
      return;
    }
    setPackages((prev) => [...prev, newPackage()]);
  };
  const updateFeature = (pkgKey, fKey, text) =>
    setPackages((prev) =>
      prev.map((p) =>
        p._key === pkgKey ? { ...p, features: p.features.map((f) => (f._key === fKey ? { ...f, text } : f)) } : p
      )
    );
  const removeFeature = (pkgKey, fKey) =>
    setPackages((prev) =>
      prev.map((p) => (p._key === pkgKey ? { ...p, features: p.features.filter((f) => f._key !== fKey) } : p))
    );
  const addFeature = (pkgKey) =>
    setPackages((prev) =>
      prev.map((p) => (p._key === pkgKey ? { ...p, features: [...p.features, { _key: uid(), text: "" }] } : p))
    );

  // Kalem düzenleme yardımcıları
  const updateItem = (key, patch) => setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...patch } : it)));
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it._key !== key));
  const addItem = () => {
    if (items.length >= MAX_ITEMS) {
      toast.error(`En fazla ${MAX_ITEMS} kalem ekleyebilirsiniz.`);
      return;
    }
    setItems((prev) => [...prev, newItem()]);
  };

  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const visibleItems = useMemo(() => {
    if (!needle) return items;
    return items.filter((it) => `${it.name} ${it.description}`.toLocaleLowerCase("tr-TR").includes(needle));
  }, [items, needle]);

  const save = async () => {
    const result = buildPayload(packages, items);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put("/admin/pricing", result.payload);
      if (Array.isArray(data?.packages) && Array.isArray(data?.items)) {
        applyData(data);
      } else {
        setMeta((m) => ({
          updated_at: data?.updated_at ?? m.updated_at,
          updated_by: data?.updated_by ?? m.updated_by,
        }));
      }
      toast.success("Fiyat listesi kaydedildi");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Fiyat listesi kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const metaText = meta.updated_at
    ? `Son güncelleme: ${fmtDate(meta.updated_at)}${typeof meta.updated_by === "string" && meta.updated_by ? ` · ${meta.updated_by}` : ""}`
    : "Henüz kaydedilmedi";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiyat Listesi & Paketler"
        description="Ana sayfada görünen paketler ve fiyat listesi buradan yönetilir."
        actions={
          <Button onClick={save} disabled={loading || loadError || saving}>
            {saving ? <RefreshCw className="animate-spin" /> : <Save />}
            Kaydet
          </Button>
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p>
            Bu içerik, giriş yapmamış ziyaretçilerin gördüğü ana sayfada (alan adınızın kök adresi <code className="font-mono">/</code>)
            yayınlanır. Değişiklikler sayfa yenilendiğinde görünür.
          </p>
        </div>
        <span className="shrink-0 text-xs text-sky-700">{metaText}</span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Yükleniyor…</div>
      ) : loadError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="font-semibold text-slate-900">Fiyat listesi yüklenemedi</p>
            <p className="max-w-sm text-sm text-slate-500">
              Veri kaybını önlemek için kaydetme devre dışı. Yüklemeyi tekrar deneyin.
            </p>
            <Button variant="outline" onClick={load}>
              <RefreshCw /> Tekrar dene
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Paketler */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-semibold text-slate-900">Paketler</h2>
                <p className="text-sm text-slate-500">
                  {packages.length} / {MAX_PACKAGES} paket
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addPkg} disabled={packages.length >= MAX_PACKAGES}>
                <Plus /> Paket ekle
              </Button>
            </div>

            {packages.length === 0 ? (
              <Card>
                <EmptyState
                  icon={FileText}
                  title="Henüz paket yok"
                  description="Ana sayfada gösterilecek ilk paketi ekleyin."
                  action={
                    <Button size="sm" onClick={addPkg}>
                      <Plus /> Paket ekle
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {packages.map((p, idx) => (
                  <Card
                    key={p._key}
                    className={p.highlight ? "border-brand-400 ring-1 ring-brand-500/30" : undefined}
                  >
                    <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                      <CardTitle className="text-sm font-medium text-slate-500">Paket {idx + 1}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePkg(p._key)}
                        aria-label="Paketi sil"
                        className="text-slate-500 hover:text-red-600"
                      >
                        <Trash2 />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`pk-name-${p._key}`}>Paket adı</Label>
                        <Input
                          id={`pk-name-${p._key}`}
                          value={p.name}
                          maxLength={80}
                          placeholder="Örn. Temel Bakım"
                          onChange={(e) => updatePkg(p._key, { name: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`pk-price-${p._key}`}>Fiyat (TL)</Label>
                          <Input
                            id={`pk-price-${p._key}`}
                            type="text"
                            inputMode="decimal"
                            value={p.price}
                            placeholder="0"
                            onChange={(e) => updatePkg(p._key, { price: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`pk-unit-${p._key}`}>Birim</Label>
                          <Input
                            id={`pk-unit-${p._key}`}
                            value={p.unit}
                            maxLength={40}
                            placeholder="Örn. / ay"
                            onChange={(e) => updatePkg(p._key, { unit: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`pk-id-${p._key}`}>Kimlik (id)</Label>
                        <Input
                          id={`pk-id-${p._key}`}
                          value={p.id}
                          className="font-mono text-xs"
                          onChange={(e) => updatePkg(p._key, { id: e.target.value })}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                        <Label htmlFor={`pk-hl-${p._key}`} className="cursor-pointer">
                          Öne çıkar (En popüler)
                        </Label>
                        <Switch
                          id={`pk-hl-${p._key}`}
                          checked={p.highlight}
                          onCheckedChange={(v) => updatePkg(p._key, { highlight: v })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Özellikler</Label>
                        {p.features.map((f) => (
                          <div key={f._key} className="flex items-center gap-2">
                            <Input
                              value={f.text}
                              maxLength={120}
                              aria-label="Özellik"
                              placeholder="Örn. Yağ değişimi"
                              onChange={(e) => updateFeature(p._key, f._key, e.target.value)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Özelliği sil"
                              onClick={() => removeFeature(p._key, f._key)}
                              className="shrink-0 text-slate-400 hover:text-red-600"
                            >
                              <X />
                            </Button>
                          </div>
                        ))}
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => addFeature(p._key)}>
                          <Plus /> Özellik ekle
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Fiyat listesi */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-semibold text-slate-900">Fiyat listesi</h2>
                <p className="text-sm text-slate-500">
                  {items.length} / {MAX_ITEMS} kalem
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kalemlerde ara…"
                    aria-label="Fiyat listesinde ara"
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={addItem} disabled={items.length >= MAX_ITEMS}>
                  <Plus /> Kalem ekle
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {items.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Fiyat listesi boş"
                    description="İlk kalemi ekleyerek başlayın."
                    action={
                      <Button size="sm" onClick={addItem}>
                        <Plus /> Kalem ekle
                      </Button>
                    }
                  />
                ) : visibleItems.length === 0 ? (
                  <EmptyState icon={Search} title="Sonuç bulunamadı" description="Arama metnini değiştirin." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Ad</TableHead>
                          <TableHead className="min-w-[220px]">Açıklama</TableHead>
                          <TableHead className="min-w-[120px]">Fiyat (TL)</TableHead>
                          <TableHead className="min-w-[110px]">Birim</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleItems.map((it) => (
                          <TableRow key={it._key}>
                            <TableCell className="p-2 align-top">
                              <Input
                                aria-label="Kalem adı"
                                value={it.name}
                                maxLength={120}
                                onChange={(e) => updateItem(it._key, { name: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Input
                                aria-label="Kalem açıklaması"
                                value={it.description}
                                maxLength={300}
                                onChange={(e) => updateItem(it._key, { description: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Input
                                aria-label="Fiyat"
                                type="text"
                                inputMode="decimal"
                                value={it.price}
                                placeholder="0"
                                onChange={(e) => updateItem(it._key, { price: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Input
                                aria-label="Birim"
                                value={it.unit}
                                maxLength={40}
                                onChange={(e) => updateItem(it._key, { unit: e.target.value })}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Kalemi sil"
                                onClick={() => removeItem(it._key)}
                                className="text-slate-500 hover:text-red-600"
                              >
                                <Trash2 />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

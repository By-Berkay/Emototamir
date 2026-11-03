import React, { useEffect, useMemo, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import BulkVatDialog from "../components/BulkVatDialog";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import { useAuth } from "../context/AuthContext";
import EmptyState from "../components/EmptyState";
import { Plus, Search, AlertTriangle, Pencil, Trash2, Package, Boxes, Layers } from "lucide-react";
import { toast } from "sonner";
import { HeroBanner, KpiCard, Panel, StatusBadge, DataTable, toneOf } from "../components/design/kit";
import { cn } from "../lib/utils";

const CATS = ["Motor Yağı", "Filtre", "Fren", "Elektrik", "Lastik", "Zincir", "Dişli", "Akü", "Buji", "Süspansiyon", "Kaporta", "Motor", "Egzoz", "Diğer"];
const EMPTY = { code: "", name: "", brand: "", category: "Motor Yağı", cost_price: 0, sale_price: 0, stock: 0, min_stock: 5, unit: "Adet", description: "", vat: 20, price_mode: "incl" };

// Koyu tema için ortak sınıflar (ui bileşenlerindeki açık zemin değerlerini ezer)
const BTN_PRIMARY = "bg-orange-500 text-white shadow-sm hover:bg-orange-600";
const BTN_OUTLINE = "border-white/10 bg-white/5 text-slate-200 shadow-none hover:bg-white/10 hover:text-white";
const BTN_GHOST = "text-slate-400 hover:bg-white/10 hover:text-white";
const BTN_DELETE = "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300";
const INPUT_CLS = "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-orange-500/40 [color-scheme:dark]";
const LABEL_CLS = "text-slate-300";
const TRIGGER_CLS = "border-white/10 bg-white/5 text-white focus:ring-orange-500/40";
const CONTENT_CLS = "border-white/10 bg-slate-950 text-white";
const DIALOG_CLS = "max-w-2xl border-white/10 bg-slate-950 text-white";

const isCritical = (p) => Number(p.stock) <= Number(p.min_stock);

function Field({ label, className = "", children }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className={LABEL_CLS}>{label}</Label>
      {children}
    </div>
  );
}

function RowActions({ onEdit, onDelete, testId }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className={BTN_GHOST} onClick={onEdit} aria-label="Parçayı düzenle" data-testid={`edit-product-${testId}`}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Parçayı sil"
        className={BTN_DELETE}
        data-testid={`delete-product-${testId}`}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setItems(data);
    } catch {
      toast.error("Parçalar yüklenemedi");
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const categories = useMemo(
    () => Array.from(new Set([...CATS, ...items.map((i) => i.category).filter(Boolean)])),
    [items]
  );
  const criticalCount = items.filter(isCritical).length;
  const inStockCount = items.filter((p) => Number(p.stock) > 0).length;
  const visible = items.filter(
    (p) => (cat === "all" || p.category === cat) && (!onlyCritical || isCritical(p))
  );

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...EMPTY, ...p }); setOpen(true); };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (!form.code || !form.name) return toast.error("Kod ve ad zorunlu");
    const payload = {
      ...form,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/products/${editing.id}`, payload);
      else await api.post("/products", payload);
      toast.success(editing ? "Parça güncellendi" : "Parça eklendi");
      setOpen(false);
      load();
    } catch {
      toast.error("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`${p.name} silinsin mi?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Parça silindi");
      load();
    } catch {
      toast.error("Silme başarısız");
    }
  };

  return (
    <div className="space-y-6 text-white">
      <HeroBanner
        eyebrow="Katalog"
        title="Parçalar"
        subtitle={`${items.length} parça${criticalCount ? ` · ${criticalCount} kritik stok` : ""}`}
        actions={
          <>
            {isAdmin && <BulkVatDialog onDone={load} />}
            <Button onClick={openNew} className={BTN_PRIMARY} data-testid="btn-new-product">
              <Plus />
              Yeni parça
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon={Package} label="Toplam parça" tone="orange" value={items.length} testId="kpi-products-total" />
        <KpiCard icon={AlertTriangle} label="Kritik stok" tone="red" value={criticalCount} delta={criticalCount ? "Dikkat" : "Sorun yok"} deltaTone={criticalCount ? "down" : "up"} testId="kpi-products-critical" />
        <KpiCard icon={Boxes} label="Stokta olan" tone="green" value={inStockCount} testId="kpi-products-instock" />
        <KpiCard icon={Layers} label="Kategori" tone="violet" value={categories.length} testId="kpi-products-categories" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Kod, ad veya marka ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn("pl-9", INPUT_CLS)}
            aria-label="Parça ara"
            data-testid="product-search"
          />
        </div>
        <div className="flex gap-3 sm:ml-auto">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className={cn("flex-1 sm:w-56", TRIGGER_CLS)} aria-label="Kategori filtresi" data-testid="product-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={CONTENT_CLS}>
              <SelectItem value="all">Tüm kategoriler</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className={cn(onlyCritical ? "border-rose-500/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30" : BTN_OUTLINE)}
            onClick={() => setOnlyCritical((v) => !v)}
            aria-pressed={onlyCritical}
            data-testid="product-critical-toggle"
          >
            <AlertTriangle />
            Kritik stok
          </Button>
        </div>
      </div>

      {!loaded ? (
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      ) : visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Package}
            title={items.length === 0 ? "Henüz parça yok" : "Filtreye uyan parça yok"}
            description={
              items.length === 0
                ? "İlk parçayı ekleyerek stok ve satış fiyatı takibini başlatın."
                : "Arama veya filtreleri temizleyip tekrar deneyin."
            }
            action={items.length === 0 ? <Button className={BTN_PRIMARY} onClick={openNew}><Plus />Yeni parça</Button> : null}
          />
        </Panel>
      ) : (
        <Panel
          bodyClassName="p-0"
          title="Parça listesi"
          subtitle={`${visible.length} parça gösteriliyor`}
          testId="panel-products"
        >
          <div className="hidden p-5 md:block">
            <DataTable>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Parça</th>
                  <th>Kategori</th>
                  <th className="text-right">Alış</th>
                  <th className="text-right">Satış</th>
                  <th className="text-right">Stok</th>
                  <th className="w-24"><span className="sr-only">İşlemler</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const crit = isCritical(p);
                  return (
                    <tr key={p.id} data-testid={`product-row-${p.id}`}>
                      <td className="font-mono text-xs text-slate-400">{p.code}</td>
                      <td>
                        <div className="font-medium text-white">{p.name}</div>
                        {p.brand && <div className="text-xs text-slate-400">{p.brand}</div>}
                      </td>
                      <td><StatusBadge tone="neutral">{p.category}</StatusBadge></td>
                      <td className="text-right tabular-nums text-slate-400">{fmtMoney(p.cost_price)}</td>
                      <td className="text-right font-medium tabular-nums text-white">{fmtMoney(p.sale_price)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {crit && <StatusBadge tone="danger">Kritik</StatusBadge>}
                          <span className={`tabular-nums ${crit ? "font-semibold text-rose-300" : "text-slate-200"}`}>{p.stock}</span>
                          <span className="text-xs text-slate-400">/ {p.min_stock}</span>
                        </div>
                      </td>
                      <td>
                        <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} testId={p.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>

          <ul className="divide-y divide-white/10 md:hidden">
            {visible.map((p) => {
              const crit = isCritical(p);
              return (
                <li key={p.id} className="flex items-start gap-3 p-4" data-testid={`product-card-${p.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-slate-400">{p.code}</p>
                    <p className="truncate font-medium text-white">{p.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone="neutral">{p.category}</StatusBadge>
                      {crit && <StatusBadge tone="danger">Kritik · {p.stock}/{p.min_stock}</StatusBadge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums text-white">{fmtMoney(p.sale_price)}</span>
                    <span className="text-xs text-slate-400">Stok {p.stock}</span>
                    <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} testId={`m-${p.id}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={DIALOG_CLS}>
          <DialogHeader>
            <DialogTitle className="font-heading text-white">{editing ? "Parça düzenle" : "Yeni parça"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Kod *">
              <Input value={form.code ?? ""} onChange={set("code")} className={INPUT_CLS} data-testid="input-product-code" />
            </Field>
            <Field label="Ad *">
              <Input value={form.name ?? ""} onChange={set("name")} className={INPUT_CLS} data-testid="input-product-name" />
            </Field>
            <Field label="Marka">
              <Input value={form.brand ?? ""} onChange={set("brand")} className={INPUT_CLS} />
            </Field>
            <Field label="Kategori">
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className={TRIGGER_CLS}><SelectValue /></SelectTrigger>
                <SelectContent className={CONTENT_CLS}>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Alış fiyatı (₺)">
              <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={set("cost_price")} className={INPUT_CLS} />
            </Field>
            <Field label="Satış fiyatı (₺)">
              <Input type="number" min="0" step="0.01" value={form.sale_price} onChange={set("sale_price")} className={INPUT_CLS} />
            </Field>
            <Field label="Fiyat tipi">
              <PriceModeSelect value={form.price_mode} onChange={(v) => setForm((f) => ({ ...f, price_mode: v }))} testId="product-price-mode" />
            </Field>
            <Field label="KDV">
              <VatSelect value={form.vat} onChange={(v) => setForm((f) => ({ ...f, vat: v }))} testId="product-vat" />
            </Field>
            <Field label="Stok">
              <Input type="number" min="0" value={form.stock} onChange={set("stock")} className={INPUT_CLS} />
            </Field>
            <Field label="Minimum stok">
              <Input type="number" min="0" value={form.min_stock} onChange={set("min_stock")} className={INPUT_CLS} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className={BTN_OUTLINE} onClick={() => setOpen(false)}>İptal</Button>
            <Button className={BTN_PRIMARY} onClick={save} disabled={saving} data-testid="btn-save-product">
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

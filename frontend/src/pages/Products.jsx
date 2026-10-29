import React, { useEffect, useMemo, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import PageHeader from "../components/PageHeader";
import BulkVatDialog from "../components/BulkVatDialog";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import { useAuth } from "../context/AuthContext";
import EmptyState from "../components/EmptyState";
import { Plus, Search, AlertTriangle, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

const CATS = ["Motor Yağı", "Filtre", "Fren", "Elektrik", "Lastik", "Zincir", "Dişli", "Akü", "Buji", "Süspansiyon", "Kaporta", "Motor", "Egzoz", "Diğer"];
const EMPTY = { code: "", name: "", brand: "", category: "Motor Yağı", cost_price: 0, sale_price: 0, stock: 0, min_stock: 5, unit: "Adet", description: "", vat: 20, price_mode: "incl" };

const isCritical = (p) => Number(p.stock) <= Number(p.min_stock);

function Field({ label, className = "", children }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RowActions({ onEdit, onDelete, testId }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Parçayı düzenle" data-testid={`edit-product-${testId}`}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Parçayı sil"
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Katalog"
        title="Parçalar"
        description={`${items.length} parça${criticalCount ? ` · ${criticalCount} kritik stok` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <BulkVatDialog onDone={load} />}
          <Button onClick={openNew} data-testid="btn-new-product">
            <Plus />
            Yeni parça
          </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Kod, ad veya marka ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Parça ara"
            data-testid="product-search"
          />
        </div>
        <div className="flex gap-3 sm:ml-auto">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="flex-1 sm:w-56" aria-label="Kategori filtresi" data-testid="product-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm kategoriler</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={onlyCritical ? "dark" : "outline"}
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
        <div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={items.length === 0 ? "Henüz parça yok" : "Filtreye uyan parça yok"}
            description={
              items.length === 0
                ? "İlk parçayı ekleyerek stok ve satış fiyatı takibini başlatın."
                : "Arama veya filtreleri temizleyip tekrar deneyin."
            }
            action={items.length === 0 ? <Button onClick={openNew}><Plus />Yeni parça</Button> : null}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Parça</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Alış</TableHead>
                  <TableHead className="text-right">Satış</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="w-24"><span className="sr-only">İşlemler</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => {
                  const crit = isCritical(p);
                  return (
                    <TableRow key={p.id} data-testid={`product-row-${p.id}`}>
                      <TableCell className="font-mono text-xs text-slate-600">{p.code}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{p.name}</div>
                        {p.brand && <div className="text-xs text-slate-500">{p.brand}</div>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{fmtMoney(p.cost_price)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-900">{fmtMoney(p.sale_price)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {crit && <Badge variant="destructive">Kritik</Badge>}
                          <span className={`tabular-nums ${crit ? "font-semibold text-red-600" : "text-slate-700"}`}>{p.stock}</span>
                          <span className="text-xs text-slate-400">/ {p.min_stock}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} testId={p.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {visible.map((p) => {
              const crit = isCritical(p);
              return (
                <li key={p.id} className="flex items-start gap-3 p-4" data-testid={`product-card-${p.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-slate-500">{p.code}</p>
                    <p className="truncate font-medium text-slate-900">{p.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{p.category}</Badge>
                      {crit && <Badge variant="destructive">Kritik · {p.stock}/{p.min_stock}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums text-slate-900">{fmtMoney(p.sale_price)}</span>
                    <span className="text-xs text-slate-500">Stok {p.stock}</span>
                    <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} testId={`m-${p.id}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Parça düzenle" : "Yeni parça"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Kod *">
              <Input value={form.code ?? ""} onChange={set("code")} data-testid="input-product-code" />
            </Field>
            <Field label="Ad *">
              <Input value={form.name ?? ""} onChange={set("name")} data-testid="input-product-name" />
            </Field>
            <Field label="Marka">
              <Input value={form.brand ?? ""} onChange={set("brand")} />
            </Field>
            <Field label="Kategori">
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Alış fiyatı (₺)">
              <Input type="number" min="0" step="0.01" value={form.cost_price} onChange={set("cost_price")} />
            </Field>
            <Field label="Satış fiyatı (₺)">
              <Input type="number" min="0" step="0.01" value={form.sale_price} onChange={set("sale_price")} />
            </Field>
            <Field label="Fiyat tipi">
              <PriceModeSelect value={form.price_mode} onChange={(v) => setForm((f) => ({ ...f, price_mode: v }))} testId="product-price-mode" />
            </Field>
            <Field label="KDV">
              <VatSelect value={form.vat} onChange={(v) => setForm((f) => ({ ...f, vat: v }))} testId="product-vat" />
            </Field>
            <Field label="Stok">
              <Input type="number" min="0" value={form.stock} onChange={set("stock")} />
            </Field>
            <Field label="Minimum stok">
              <Input type="number" min="0" value={form.min_stock} onChange={set("min_stock")} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save} disabled={saving} data-testid="btn-save-product">
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

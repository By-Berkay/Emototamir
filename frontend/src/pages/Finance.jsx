import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Users, Search } from "lucide-react";
import api, { fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { ArrowLeftRight as PvIcon } from "lucide-react";
import Money from "../components/Money";
import EmptyState from "../components/EmptyState";
import Tilt3D from "../components/Tilt3D";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { cn } from "../lib/utils";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { type: "expense", category: "", amount: "", date: today(), description: "", payee: "", payment_method: "nakit" };

const METHOD_LABEL = { nakit: "Nakit", kart: "Kart", havale: "Havale / EFT", çek: "Çek", diğer: "Diğer" };

function StatTile({ icon: Icon, label, children, tone = "cyan" }) {
  const ring = tone === "orange" ? "from-orange-400/20 text-orange-300" : tone === "red" ? "from-red-400/20 text-red-300" : tone === "emerald" ? "from-emerald-400/20 text-emerald-300" : "from-cyan-400/20 text-cyan-300";
  return (
    <Tilt3D max={5} lift={4} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br to-transparent", ring)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="font-heading mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{children}</div>
    </Tilt3D>
  );
}

export default function Finance() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState({ income_categories: [], expense_categories: [], payment_methods: [] });
  const [typeFilter, setTypeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, e] = await Promise.all([
        api.get("/finance/summary", { params: { month } }),
        api.get("/finance/entries", { params: { month } }),
      ]);
      setSummary(s.data);
      setEntries(e.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gelir-gider verisi yüklenemedi");
    }
  };

  useEffect(() => {
    api.get("/finance/meta").then((r) => setMeta(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const visible = useMemo(() => entries.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return [e.description, e.payee, e.category].some((v) => (v || "").toLowerCase().includes(t));
  }), [entries, typeFilter, q]);

  const maxCat = Math.max(1, ...(summary?.by_category || []).map((c) => c.amount));
  const categoriesFor = (type) => (type === "income" ? meta.income_categories : meta.expense_categories);

  const openNew = (type = "expense") => {
    setEditing(null);
    setForm({ ...EMPTY, type, category: categoriesFor(type)[0] || "", date: month === currentMonth() ? today() : `${month}-01` });
    setOpen(true);
  };
  const openEdit = (e) => {
    setEditing(e);
    setForm({ type: e.type, category: e.category, amount: String(e.amount), date: e.date, description: e.description || "", payee: e.payee || "", payment_method: e.payment_method || "nakit" });
    setOpen(true);
  };

  const save = async (ev) => {
    ev.preventDefault();
    const payload = { ...form, amount: Number(String(form.amount).replace(",", ".")) };
    if (!payload.amount || payload.amount <= 0) { toast.error("Tutar sıfırdan büyük olmalı"); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/finance/entries/${editing.id}`, payload);
      else await api.post("/finance/entries", payload);
      toast.success(editing ? "Kayıt güncellendi" : "Kayıt eklendi");
      setOpen(false);
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Kayıt kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e) => {
    if (!window.confirm("Bu kayıt silinsin mi?")) return;
    try {
      await api.delete(`/finance/entries/${e.id}`);
      toast.success("Kayıt silindi");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Kayıt silinemedi");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        eyebrow="Muhasebe"
        title="Gelir & Gider"
        description="Aylık gelir, gider ve masraf kayıtları. Personel maaşları Personel & Maaş ekranından işlenir."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/finance/staff"><Users className="mr-2 h-4 w-4" />Personel & Maaş</Link></Button>
            <Button variant="outline" onClick={() => openNew("income")}><TrendingUp className="mr-2 h-4 w-4" />Gelir ekle</Button>
            <Button onClick={() => openNew("expense")} data-testid="btn-new-expense"><Plus className="mr-2 h-4 w-4" />Gider / masraf ekle</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="fin-month" className="text-sm">Ay</Label>
        <Input id="fin-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile icon={TrendingUp} label="Gelir" tone="emerald"><Money value={summary?.income} /></StatTile>
        <StatTile icon={TrendingDown} label="Gider" tone="red"><Money value={summary?.expense} /></StatTile>
        <StatTile icon={Wallet} label="Net" tone={summary && summary.net < 0 ? "red" : "cyan"}><Money value={summary?.net} /></StatTile>
        <StatTile icon={Users} label="Bordro bekleyen" tone="orange">
          <Money value={summary?.payroll_due} />
          <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
            {summary ? `${summary.employees_paid}/${summary.employees_active} personel ödendi` : ""}
          </span>
        </StatTile>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardContent className="p-5">
            <p className="font-heading mb-4 text-sm font-semibold text-slate-900 dark:text-white">Kategori dağılımı</p>
            {(summary?.by_category || []).length === 0 ? (
              <p className="text-sm text-slate-500">Bu ay için kayıt yok.</p>
            ) : (
              <ul className="space-y-3">
                {summary.by_category.map((c) => (
                  <li key={c.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">
                        <span className={c.type === "income" ? "text-emerald-600" : "text-red-500"}>{c.type === "income" ? "Gelir" : "Gider"}</span> · {c.category}
                      </span>
                      <Money value={c.amount} className="font-medium text-slate-900 dark:text-white" />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div className={cn("h-full rounded-full", c.type === "income" ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-gradient-to-r from-orange-400 to-red-500")}
                           style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Açıklama, ödeyen veya kategori ara" className="pl-9" aria-label="Kayıtlarda ara" />
              </div>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5" role="group" aria-label="Tür filtresi">
                {[["all", "Tümü"], ["income", "Gelir"], ["expense", "Gider"]].map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={typeFilter === v} onClick={() => setTypeFilter(v)}
                          className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", typeFilter === v ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState icon={Wallet} title="Kayıt bulunamadı" description="Bu ay için gelir veya gider eklemek için yukarıdaki düğmeleri kullanın." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold">Tarih</th>
                      <th className="px-4 py-3 font-semibold">Kategori</th>
                      <th className="px-4 py-3 font-semibold">Açıklama</th>
                      <th className="hidden px-4 py-3 font-semibold md:table-cell">Ödeme</th>
                      <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                      <th className="px-4 py-3 text-right font-semibold"><span className="sr-only">İşlemler</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-orange-50/60 dark:border-white/5 dark:hover:bg-orange-500/5">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{fmtDate(e.date)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", e.type === "income" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300")}>
                            {e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          <span className="block">{e.description || "—"}</span>
                          {e.payee && <span className="text-xs text-slate-500 dark:text-slate-400">{e.payee}</span>}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell dark:text-slate-300">{METHOD_LABEL[e.payment_method] || e.payment_method}</td>
                        <td className={cn("whitespace-nowrap px-4 py-3 text-right font-semibold", e.type === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300")}>
                          {e.type === "income" ? "+" : "−"}<Money value={e.amount} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {e.salary_payment_id ? (
                            <span className="text-xs text-slate-400">Personelden</span>
                          ) : (
                            <span className="inline-flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(e)} aria-label="Kaydı düzenle"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => remove(e)} aria-label="Kaydı sil"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Kaydı düzenle" : form.type === "income" ? "Gelir ekle" : "Gider / masraf ekle"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-type">Tür</Label>
              <select id="f-type" className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category: categoriesFor(e.target.value)[0] || "" })}>
                <option value="expense">Gider / masraf</option>
                <option value="income">Gelir</option>
              </select>
            </div>
            <div>
              <Label htmlFor="f-cat">Kategori</Label>
              <select id="f-cat" className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categoriesFor(form.type).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f-amount">Tutar (₺)</Label>
              <Input id="f-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="f-date">Tarih</Label>
              <Input id="f-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="f-method">Ödeme yöntemi</Label>
              <select id="f-method" className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f-payee">Ödeyen / alan</Label>
              <Input id="f-payee" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="f-desc">Açıklama</Label>
              <Input id="f-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
              <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

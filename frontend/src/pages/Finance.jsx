import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Users, Search } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend } from "recharts";
import api, { fmtDate } from "../lib/api";
import Money from "../components/Money";
import EmptyState from "../components/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { cn } from "../lib/utils";
import { LockedChart, GlassTooltip, AXIS_TICK, GRID_STROKE, compact } from "../components/reports/ReportKit";
import { usePrivacy } from "../context/PrivacyContext";
import { HeroBanner, KpiCard, Panel, DataTable, FilterChips } from "../components/design/kit";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { type: "expense", category: "", amount: "", date: today(), description: "", payee: "", payment_method: "nakit" };

const METHOD_LABEL = { nakit: "Nakit", kart: "Kart", havale: "Havale / EFT", çek: "Çek", diğer: "Diğer" };

// Koyu tema için ortak sınıflar (ui bileşenlerindeki açık zemin değerlerini ezer)
const BTN_PRIMARY = "bg-orange-500 text-white shadow-sm hover:bg-orange-600";
const BTN_OUTLINE = "border-white/10 bg-white/5 text-slate-200 shadow-none hover:bg-white/10 hover:text-white";
const BTN_GHOST = "text-slate-400 hover:bg-white/10 hover:text-white";
const INPUT_CLS = "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-orange-500/40 [color-scheme:dark]";
const LABEL_CLS = "text-slate-300";
const SELECT_CLS = "mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40";
const DIALOG_CLS = "max-w-lg border-white/10 bg-slate-950 text-white";

export default function Finance() {
  const { unlocked } = usePrivacy();
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

  // Seçili ayın günlük gelir/gider serisi (mevcut kayıtlardan hesaplanır)
  const dailySeries = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const n = y && m ? new Date(y, m, 0).getDate() : 31;
    const rows = Array.from({ length: n }, (_, i) => ({ day: String(i + 1), income: 0, expense: 0 }));
    entries.forEach((e) => {
      const row = rows[Number((e.date || "").slice(8, 10)) - 1];
      if (!row) return;
      row[e.type === "income" ? "income" : "expense"] += Number(e.amount) || 0;
    });
    return rows;
  }, [entries, month]);

  const sparkIncome = useMemo(() => (entries.length ? dailySeries.map((d) => d.income) : undefined), [dailySeries, entries]);
  const sparkExpense = useMemo(() => (entries.length ? dailySeries.map((d) => d.expense) : undefined), [dailySeries, entries]);
  const sparkNet = useMemo(() => {
    if (!entries.length) return undefined;
    let acc = 0;
    return dailySeries.map((d) => (acc += d.income - d.expense));
  }, [dailySeries, entries]);

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
    <div className="space-y-6 text-white">
      <HeroBanner
        eyebrow="Muhasebe"
        title="Gelir & Gider"
        subtitle="Aylık gelir, gider ve masraf kayıtları. Personel maaşları Personel & Maaş ekranından işlenir."
        actions={
          <>
            <Button asChild variant="outline" className={BTN_OUTLINE}><Link to="/finance/staff"><Users className="mr-2 h-4 w-4" />Personel & Maaş</Link></Button>
            <Button variant="outline" className={BTN_OUTLINE} onClick={() => openNew("income")}><TrendingUp className="mr-2 h-4 w-4" />Gelir ekle</Button>
            <Button className={BTN_PRIMARY} onClick={() => openNew("expense")} data-testid="btn-new-expense"><Plus className="mr-2 h-4 w-4" />Gider / masraf ekle</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="fin-month" className={cn("text-sm", LABEL_CLS)}>Ay</Label>
        <Input id="fin-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={cn("w-auto", INPUT_CLS)} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Gelir" tone="green" value={<Money value={summary?.income} />} spark={sparkIncome} testId="kpi-income" />
        <KpiCard icon={TrendingDown} label="Gider" tone="red" value={<Money value={summary?.expense} />} spark={sparkExpense} testId="kpi-expense" />
        <KpiCard
          icon={Wallet}
          label="Net"
          tone={summary && summary.net < 0 ? "red" : "orange"}
          deltaTone={summary && summary.net < 0 ? "down" : "up"}
          delta={summary ? (summary.net < 0 ? "Açık" : "Artı") : undefined}
          value={<Money value={summary?.net} />}
          spark={sparkNet}
          testId="kpi-net"
        />
        <KpiCard
          icon={Users}
          label="Bordro bekleyen"
          tone="amber"
          deltaTone="neutral"
          delta={summary ? `${summary.employees_paid}/${summary.employees_active} ödendi` : undefined}
          value={<Money value={summary?.payroll_due} />}
          testId="kpi-payroll"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Gelir / gider karşılaştırması"
          subtitle="Seçili ayın günlük gelir ve gider toplamları"
          testId="panel-chart"
        >
          {!unlocked ? (
            <LockedChart height={256} />
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Bu ay için kayıt yok.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
                  <RTooltip content={<GlassTooltip labelFormatter={(l) => `${l}. gün`} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                  <RBar dataKey="income" name="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <RBar dataKey="expense" name="Gider" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Kategori dağılımı" subtitle="Bu ayın gelir ve gider kırılımı" testId="panel-categories">
          {(summary?.by_category || []).length === 0 ? (
            <p className="text-sm text-slate-400">Bu ay için kayıt yok.</p>
          ) : (
            <ul className="space-y-3">
              {summary.by_category.map((c) => (
                <li key={c.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-slate-300">
                      <span className={c.type === "income" ? "text-emerald-400" : "text-rose-400"}>{c.type === "income" ? "Gelir" : "Gider"}</span> · {c.category}
                    </span>
                    <Money value={c.amount} className="shrink-0 font-medium text-white" />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn("h-full rounded-full", c.type === "income" ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-gradient-to-r from-orange-400 to-red-500")}
                         style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Kayıtlar"
        subtitle={`${visible.length} kayıt listeleniyor`}
        action={
          <FilterChips
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: "all", label: "Tümü" }, { value: "income", label: "Gelir" }, { value: "expense", label: "Gider" }]}
          />
        }
        testId="panel-entries"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Açıklama, ödeyen veya kategori ara" className={cn("pl-9", INPUT_CLS)} aria-label="Kayıtlarda ara" />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={Wallet} title="Kayıt bulunamadı" description="Bu ay için gelir veya gider eklemek için yukarıdaki düğmeleri kullanın." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kategori</th>
                <th>Açıklama</th>
                <th className="hidden md:table-cell">Ödeme</th>
                <th className="text-right">Tutar</th>
                <th className="text-right"><span className="sr-only">İşlemler</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-slate-300">{fmtDate(e.date)}</td>
                  <td>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", e.type === "income" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-rose-500/15 text-rose-300 ring-rose-500/30")}>
                      {e.category}
                    </span>
                  </td>
                  <td>
                    <span className="block text-white">{e.description || "—"}</span>
                    {e.payee && <span className="text-xs text-slate-400">{e.payee}</span>}
                  </td>
                  <td className="hidden text-slate-300 md:table-cell">{METHOD_LABEL[e.payment_method] || e.payment_method}</td>
                  <td className={cn("whitespace-nowrap text-right font-semibold", e.type === "income" ? "text-emerald-300" : "text-rose-300")}>
                    {e.type === "income" ? "+" : "−"}<Money value={e.amount} />
                  </td>
                  <td className="text-right">
                    {e.salary_payment_id ? (
                      <span className="text-xs text-slate-400">Personelden</span>
                    ) : (
                      <span className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" className={BTN_GHOST} onClick={() => openEdit(e)} aria-label="Kaydı düzenle"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className={BTN_GHOST} onClick={() => remove(e)} aria-label="Kaydı sil"><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={DIALOG_CLS}>
          <DialogHeader><DialogTitle className="font-heading text-white">{editing ? "Kaydı düzenle" : form.type === "income" ? "Gelir ekle" : "Gider / masraf ekle"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="f-type" className={LABEL_CLS}>Tür</Label>
              <select id="f-type" className={SELECT_CLS}
                      value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category: categoriesFor(e.target.value)[0] || "" })}>
                <option value="expense">Gider / masraf</option>
                <option value="income">Gelir</option>
              </select>
            </div>
            <div>
              <Label htmlFor="f-cat" className={LABEL_CLS}>Kategori</Label>
              <select id="f-cat" className={SELECT_CLS}
                      value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categoriesFor(form.type).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f-amount" className={LABEL_CLS}>Tutar (₺)</Label>
              <Input id="f-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="f-date" className={LABEL_CLS}>Tarih</Label>
              <Input id="f-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="f-method" className={LABEL_CLS}>Ödeme yöntemi</Label>
              <select id="f-method" className={SELECT_CLS}
                      value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="f-payee" className={LABEL_CLS}>Ödeyen / alan</Label>
              <Input id="f-payee" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="f-desc" className={LABEL_CLS}>Açıklama</Label>
              <Input id="f-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" className={BTN_OUTLINE} onClick={() => setOpen(false)}>Vazgeç</Button>
              <Button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

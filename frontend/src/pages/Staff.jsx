import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, UserX, Banknote, History, ArrowLeft } from "lucide-react";
import api, { fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import Money from "../components/Money";
import EmptyState from "../components/EmptyState";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { cn } from "../lib/utils";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const METHOD_LABEL = { nakit: "Nakit", kart: "Kart", havale: "Havale / EFT", çek: "Çek", diğer: "Diğer" };
const EMPTY_EMP = { name: "", role: "", phone: "", monthly_salary: "", start_date: "", active: true };

export default function Staff() {
  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState([]);
  const [paidMap, setPaidMap] = useState({});
  const [empOpen, setEmpOpen] = useState(false);
  const [empEditing, setEmpEditing] = useState(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP);
  const [payFor, setPayFor] = useState(null);
  const [payForm, setPayForm] = useState({ month: currentMonth(), amount: "", paid_on: today(), payment_method: "havale", note: "" });
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data: list } = await api.get("/finance/employees");
      setEmployees(list);
      // Her personelin ödeme geçmişi; seçili ay "ödendi" durumu buradan hesaplanır
      const pairs = await Promise.all(
        list.map((emp) => api.get(`/finance/employees/${emp.id}/salary-payments`).then((r) => [emp.id, r.data]).catch(() => [emp.id, []]))
      );
      const map = {};
      pairs.forEach(([id, rows]) => { map[id] = rows; });
      setPaidMap(map);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Personel verisi yüklenemedi");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const isPaid = (emp) => (paidMap[emp.id] || []).some((p) => p.month === month);

  const openNewEmp = () => { setEmpEditing(null); setEmpForm(EMPTY_EMP); setEmpOpen(true); };
  const openEditEmp = (emp) => {
    setEmpEditing(emp);
    setEmpForm({ name: emp.name, role: emp.role || "", phone: emp.phone || "", monthly_salary: String(emp.monthly_salary), start_date: emp.start_date || "", active: emp.active });
    setEmpOpen(true);
  };

  const saveEmp = async (ev) => {
    ev.preventDefault();
    const payload = { ...empForm, monthly_salary: Number(String(empForm.monthly_salary).replace(",", ".")) || 0 };
    setSaving(true);
    try {
      if (empEditing) await api.put(`/finance/employees/${empEditing.id}`, payload);
      else await api.post("/finance/employees", payload);
      toast.success(empEditing ? "Personel güncellendi" : "Personel eklendi");
      setEmpOpen(false);
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Personel kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (emp) => {
    if (!window.confirm(`${emp.name} pasife alınsın mı? Geçmiş maaş kayıtları korunur.`)) return;
    try {
      await api.delete(`/finance/employees/${emp.id}`);
      toast.success("Personel pasife alındı");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "İşlem yapılamadı");
    }
  };

  const openPay = (emp) => {
    setPayFor(emp);
    setPayForm({ month, amount: String(emp.monthly_salary || ""), paid_on: month === currentMonth() ? today() : `${month}-28`, payment_method: "havale", note: "" });
  };

  const paySalary = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    try {
      await api.post(`/finance/employees/${payFor.id}/salary-payments`, {
        ...payForm,
        amount: payForm.amount ? Number(String(payForm.amount).replace(",", ".")) : null,
      });
      toast.success("Maaş ödemesi kaydedildi ve gider olarak işlendi");
      setPayFor(null);
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Maaş ödemesi kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const undoPayment = async (p) => {
    if (!window.confirm("Bu maaş ödemesi iptal edilsin mi? Gider kaydı da silinir.")) return;
    try {
      await api.delete(`/finance/salary-payments/${p.id}`);
      toast.success("Maaş ödemesi iptal edildi");
      setHistory(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "İptal edilemedi");
    }
  };

  const active = employees.filter((e) => e.active);
  const inactive = employees.filter((e) => !e.active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Muhasebe"
        title="Personel & Maaş"
        description="Personel kartları, aylık maaş ödemeleri ve geçmiş. Ödenen maaş gider olarak Gelir & Gider'e yansır."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/finance"><ArrowLeft className="mr-2 h-4 w-4" />Gelir & Gider</Link></Button>
            <Button onClick={openNewEmp} data-testid="btn-new-employee"><Plus className="mr-2 h-4 w-4" />Personel ekle</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="staff-month" className="text-sm">Maaş ayı</Label>
        <Input id="staff-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
      </div>

      {active.length === 0 ? (
        <EmptyState icon={Banknote} title="Henüz personel yok" description="Personel ekleyerek aylık maaş ödemelerini takip edin." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((emp) => {
            const paid = isPaid(emp);
            const hist = paidMap[emp.id] || [];
            return (
              <Card key={emp.id} className="relative overflow-hidden">
                <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", paid ? "bg-emerald-500" : "bg-orange-500")} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading truncate text-base font-semibold text-slate-900 dark:text-white">{emp.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{emp.role || "Pozisyon belirtilmedi"}{emp.phone ? ` · ${emp.phone}` : ""}</p>
                    </div>
                    <Badge variant={paid ? "success" : "warning"}>{paid ? "Ödendi" : "Bekliyor"}</Badge>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Aylık maaş</p>
                  <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white"><Money value={emp.monthly_salary} /></p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {hist.length ? `Son ödeme: ${hist[0].month} · ${fmtDate(hist[0].paid_on)}` : "Henüz ödeme yok"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openPay(emp)} disabled={paid} data-testid={`btn-pay-${emp.id}`}>
                      <Banknote className="mr-1.5 h-3.5 w-3.5" />{paid ? "Bu ay ödendi" : "Maaş öde"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setHistory(emp)}><History className="mr-1.5 h-3.5 w-3.5" />Geçmiş</Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditEmp(emp)} aria-label={`${emp.name} düzenle`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deactivate(emp)} aria-label={`${emp.name} pasife al`}><UserX className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {inactive.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Pasif personel: {inactive.map((e) => e.name).join(", ")}</p>
      )}

      {/* Personel ekle / düzenle */}
      <Dialog open={empOpen} onOpenChange={setEmpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{empEditing ? "Personeli düzenle" : "Personel ekle"}</DialogTitle></DialogHeader>
          <form onSubmit={saveEmp} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="e-name">Ad soyad *</Label>
              <Input id="e-name" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-role">Pozisyon</Label>
              <Input id="e-role" value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-phone">Telefon</Label>
              <Input id="e-phone" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-salary">Aylık maaş (₺)</Label>
              <Input id="e-salary" inputMode="decimal" value={empForm.monthly_salary} onChange={(e) => setEmpForm({ ...empForm, monthly_salary: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-start">İşe başlama</Label>
              <Input id="e-start" type="date" value={empForm.start_date} onChange={(e) => setEmpForm({ ...empForm, start_date: e.target.value })} className="mt-1.5" />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEmpOpen(false)}>Vazgeç</Button>
              <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Maaş öde */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Maaş öde · {payFor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={paySalary} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-month">Maaş ayı</Label>
              <Input id="p-month" type="month" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-amount">Tutar (₺)</Label>
              <Input id="p-amount" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-date">Ödeme tarihi</Label>
              <Input id="p-date" type="date" value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="p-method">Yöntem</Label>
              <select id="p-method" className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}>
                {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-note">Not</Label>
              <Input id="p-note" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} className="mt-1.5" />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setPayFor(null)}>Vazgeç</Button>
              <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Ödemeyi kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Geçmiş */}
      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Maaş geçmişi · {history?.name}</DialogTitle></DialogHeader>
          {(paidMap[history?.id] || []).length === 0 ? (
            <p className="text-sm text-slate-500">Henüz maaş ödemesi yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {(paidMap[history?.id] || []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{p.month}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(p.paid_on)} · {METHOD_LABEL[p.payment_method] || p.payment_method}{p.note ? ` · ${p.note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={p.amount} className="font-semibold" />
                    <Button size="sm" variant="ghost" onClick={() => undoPayment(p)} aria-label="Ödemeyi iptal et"><UserX className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

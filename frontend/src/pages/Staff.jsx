import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, UserX, Banknote, History, ArrowLeft, Users } from "lucide-react";
import api, { fmtDate } from "../lib/api";
import Money from "../components/Money";
import EmptyState from "../components/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { cn } from "../lib/utils";
import { HeroBanner, KpiCard, Panel, StatusBadge, DataTable } from "../components/design/kit";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const METHOD_LABEL = { nakit: "Nakit", kart: "Kart", havale: "Havale / EFT", çek: "Çek", diğer: "Diğer" };
const EMPTY_EMP = { name: "", role: "", phone: "", monthly_salary: "", start_date: "", active: true };

// Koyu tema için ortak sınıflar (ui bileşenlerindeki açık zemin değerlerini ezer)
const BTN_PRIMARY = "bg-orange-500 text-white shadow-sm hover:bg-orange-600";
const BTN_OUTLINE = "border-white/10 bg-white/5 text-slate-200 shadow-none hover:bg-white/10 hover:text-white";
const BTN_GHOST = "text-slate-400 hover:bg-white/10 hover:text-white";
const INPUT_CLS = "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-orange-500/40 [color-scheme:dark]";
const LABEL_CLS = "text-slate-300";
const SELECT_CLS = "mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40";
const DIALOG_CLS = "max-w-lg border-white/10 bg-slate-950 text-white";

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

  // Seçili ay için ödenen toplam ve kalan bakiye (avans/kısmi ödemeler birikir)
  const monthPaid = (emp) => (paidMap[emp.id] || []).filter((p) => p.month === month).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remainingOf = (emp) => Math.max(0, Number(emp.monthly_salary || 0) - monthPaid(emp));

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
    setPayForm({ month, amount: String(remainingOf(emp) || ""), paid_on: month === currentMonth() ? today() : `${month}-28`, payment_method: "havale", note: "" });
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

  // KPI'lar mevcut personel ve ödeme verilerinden türetilir
  const payrollTotal = active.reduce((sum, e) => sum + Number(e.monthly_salary || 0), 0);
  const paidTotal = active.reduce((sum, e) => sum + monthPaid(e), 0);
  const remainingTotal = active.reduce((sum, e) => sum + remainingOf(e), 0);
  const paidCount = active.filter((e) => remainingOf(e) <= 0).length;

  return (
    <div className="space-y-6 text-white">
      <HeroBanner
        eyebrow="Muhasebe"
        title="Personel & Maaş"
        subtitle="Personel kartları, aylık maaş ödemeleri ve geçmiş. Ödenen maaş gider olarak Gelir & Gider'e yansır."
        actions={
          <>
            <Button asChild variant="outline" className={BTN_OUTLINE}><Link to="/finance"><ArrowLeft className="mr-2 h-4 w-4" />Gelir & Gider</Link></Button>
            <Button className={BTN_PRIMARY} onClick={openNewEmp} data-testid="btn-new-employee"><Plus className="mr-2 h-4 w-4" />Personel ekle</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="staff-month" className={cn("text-sm", LABEL_CLS)}>Maaş ayı</Label>
        <Input id="staff-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={cn("w-auto", INPUT_CLS)} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon={Users} label="Aktif personel" tone="orange" value={active.length} delta={`${paidCount}/${active.length} ödendi`} deltaTone="neutral" testId="kpi-staff-active" />
        <KpiCard icon={Banknote} label="Aylık bordro" tone="violet" value={<Money value={payrollTotal} />} testId="kpi-staff-payroll" />
        <KpiCard icon={Banknote} label="Bu ay ödenen" tone="green" value={<Money value={paidTotal} />} testId="kpi-staff-paid" />
        <KpiCard icon={Banknote} label="Bu ay kalan" tone={remainingTotal > 0 ? "amber" : "green"} value={<Money value={remainingTotal} />} testId="kpi-staff-remaining" />
      </div>

      <Panel
        title="Personel listesi"
        subtitle={`${month} maaş dönemi`}
        action={inactive.length > 0 ? <span className="text-xs text-slate-400">Pasif: {inactive.map((e) => e.name).join(", ")}</span> : null}
      >
        {active.length === 0 ? (
          <EmptyState icon={Banknote} title="Henüz personel yok" description="Personel ekleyerek aylık maaş ödemelerini takip edin." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Personel</th>
                <th className="text-right">Aylık maaş</th>
                <th className="hidden text-right md:table-cell">Bu ay ödenen</th>
                <th className="text-right">Kalan</th>
                <th>Durum</th>
                <th className="hidden lg:table-cell">Son ödeme</th>
                <th className="text-right"><span className="sr-only">İşlemler</span></th>
              </tr>
            </thead>
            <tbody>
              {active.map((emp) => {
                const paidSum = monthPaid(emp);
                const remaining = remainingOf(emp);
                const done = remaining <= 0;
                const partial = !done && paidSum > 0;
                const hist = paidMap[emp.id] || [];
                const tone = done ? "success" : partial ? "info" : "warning";
                return (
                  <tr key={emp.id}>
                    <td>
                      <p className="font-medium text-white">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.role || "Pozisyon belirtilmedi"}{emp.phone ? ` · ${emp.phone}` : ""}</p>
                    </td>
                    <td className="whitespace-nowrap text-right font-semibold text-white"><Money value={emp.monthly_salary} /></td>
                    <td className="hidden whitespace-nowrap text-right text-slate-300 md:table-cell"><Money value={paidSum} /></td>
                    <td className="whitespace-nowrap text-right text-slate-300"><Money value={remaining} /></td>
                    <td>
                      <StatusBadge tone={tone}>{done ? "Ödendi" : partial ? "Kısmi" : "Bekliyor"}</StatusBadge>
                    </td>
                    <td className="hidden text-xs text-slate-400 lg:table-cell">
                      {hist.length ? `${hist[0].month} · ${fmtDate(hist[0].paid_on)}` : "Henüz ödeme yok"}
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" className={BTN_PRIMARY} onClick={() => openPay(emp)} disabled={done} data-testid={`btn-pay-${emp.id}`}>
                          <Banknote className="mr-1.5 h-3.5 w-3.5" />{done ? "Ödendi" : partial ? "Kalanı öde" : "Maaş öde"}
                        </Button>
                        <Button size="sm" variant="outline" className={BTN_OUTLINE} onClick={() => setHistory(emp)}><History className="mr-1.5 h-3.5 w-3.5" />Geçmiş</Button>
                        <Button size="sm" variant="ghost" className={BTN_GHOST} onClick={() => openEditEmp(emp)} aria-label={`${emp.name} düzenle`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className={BTN_GHOST} onClick={() => deactivate(emp)} aria-label={`${emp.name} pasife al`}><UserX className="h-3.5 w-3.5 text-rose-400" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Panel>

      {/* Personel ekle / düzenle */}
      <Dialog open={empOpen} onOpenChange={setEmpOpen}>
        <DialogContent className={DIALOG_CLS}>
          <DialogHeader><DialogTitle className="font-heading text-white">{empEditing ? "Personeli düzenle" : "Personel ekle"}</DialogTitle></DialogHeader>
          <form onSubmit={saveEmp} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="e-name" className={LABEL_CLS}>Ad soyad *</Label>
              <Input id="e-name" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} required className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="e-role" className={LABEL_CLS}>Pozisyon</Label>
              <Input id="e-role" value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="e-phone" className={LABEL_CLS}>Telefon</Label>
              <Input id="e-phone" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="e-salary" className={LABEL_CLS}>Aylık maaş (₺)</Label>
              <Input id="e-salary" inputMode="decimal" value={empForm.monthly_salary} onChange={(e) => setEmpForm({ ...empForm, monthly_salary: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="e-start" className={LABEL_CLS}>İşe başlama</Label>
              <Input id="e-start" type="date" value={empForm.start_date} onChange={(e) => setEmpForm({ ...empForm, start_date: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" className={BTN_OUTLINE} onClick={() => setEmpOpen(false)}>Vazgeç</Button>
              <Button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Maaş öde */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-md border-white/10 bg-slate-950 text-white">
          <DialogHeader><DialogTitle className="font-heading text-white">Maaş öde · {payFor?.name}</DialogTitle></DialogHeader>
          {payFor && (
            <p className="text-sm text-slate-400">
              Aylık maaş <Money value={payFor.monthly_salary} /> · {month} için kalan <Money value={remainingOf(payFor)} />
            </p>
          )}
          <form onSubmit={paySalary} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-month" className={LABEL_CLS}>Maaş ayı</Label>
              <Input id="p-month" type="month" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} required className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="p-amount" className={LABEL_CLS}>Tutar (₺) · avans veya kısmi ödeme için düzenleyin</Label>
              <Input id="p-amount" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="p-date" className={LABEL_CLS}>Ödeme tarihi</Label>
              <Input id="p-date" type="date" value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} required className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <div>
              <Label htmlFor="p-method" className={LABEL_CLS}>Yöntem</Label>
              <select id="p-method" className={SELECT_CLS}
                      value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}>
                {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-note" className={LABEL_CLS}>Not</Label>
              <Input id="p-note" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} className={cn("mt-1.5", INPUT_CLS)} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" className={BTN_OUTLINE} onClick={() => setPayFor(null)}>Vazgeç</Button>
              <Button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? "Kaydediliyor…" : "Ödemeyi kaydet"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Geçmiş */}
      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="max-w-lg border-white/10 bg-slate-950 text-white">
          <DialogHeader><DialogTitle className="font-heading text-white">Maaş geçmişi · {history?.name}</DialogTitle></DialogHeader>
          {(paidMap[history?.id] || []).length === 0 ? (
            <p className="text-sm text-slate-400">Henüz maaş ödemesi yok.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {(paidMap[history?.id] || []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-white">{p.month}</p>
                    <p className="text-xs text-slate-400">{fmtDate(p.paid_on)} · {METHOD_LABEL[p.payment_method] || p.payment_method}{p.note ? ` · ${p.note}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={p.amount} className="font-semibold text-white" />
                    <Button size="sm" variant="ghost" className={BTN_GHOST} onClick={() => undoPayment(p)} aria-label="Ödemeyi iptal et"><UserX className="h-3.5 w-3.5 text-rose-400" /></Button>
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

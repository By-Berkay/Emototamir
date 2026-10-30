import React, { useEffect, useState } from "react";
import api, { fmtMoney, fmtDate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { HandCoins as PvIcon } from "lucide-react";
import Money from "../components/Money";
import { KpiTile, ChartPanel, Donut, Bar, PALETTE, LockedChart } from "../components/reports/ReportKit";
import { Wallet, Receipt, Gauge, CreditCard } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const METHODS = [
  { v: "cash", l: "Nakit" }, { v: "card", l: "Kredi Kartı" },
  { v: "transfer", l: "Havale/EFT" }, { v: "other", l: "Diğer" },
];
const methodLabel = (m) => METHODS.find(x => x.v === m)?.l || m;

export default function Payments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: "", service_order_id: "none", amount: "", method: "cash", note: "" });

  const load = () => api.get("/payments").then(r => setItems(r.data));
  useEffect(() => { load(); api.get("/customers").then(r=>setCustomers(r.data)); }, []);

  useEffect(() => {
    if (!form.customer_id) { setOrders([]); return; }
    let active = true;
    // İptal edilmiş servislere tahsilat kaydedilmez; eski müşteri yanıtı yeni listeyi ezmez
    api.get(`/service-orders?customer_id=${form.customer_id}`)
      .then(r => { if (active) setOrders(r.data.filter(o => o.status !== "cancelled")); });
    return () => { active = false; };
  }, [form.customer_id]);

  const total = items.reduce((s,p)=>s+p.amount, 0);

  const openNew = () => {
    setEditing(null);
    setForm({ customer_id: "", service_order_id: "none", amount: "", method: "cash", note: "" });
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ customer_id: p.customer_id, service_order_id: p.service_order_id || "none",
             amount: String(p.amount), method: p.method, note: p.note || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.customer_id) return toast.error("Müşteri seçin");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Geçerli bir tutar girin");
    if (saving) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/payments/${editing.id}`, { amount: amt, method: form.method, note: form.note });
        toast.success("Tahsilat güncellendi");
      } else {
        await api.post("/payments", {
          customer_id: form.customer_id,
          service_order_id: form.service_order_id === "none" ? null : form.service_order_id,
          amount: amt, method: form.method, note: form.note,
        });
        toast.success("Tahsilat kaydedildi");
      }
      setOpen(false); load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "İşlem başarısız");
    } finally { setSaving(false); }
  };

  const del = async (p) => {
    if (!window.confirm("Bu tahsilatı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/payments/${p.id}`);
      toast.success("Tahsilat silindi");
      load();
    } catch { toast.error("Silme başarısız"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        title="Tahsilatlar"
        actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-brand-500 hover:bg-brand-600" data-testid="btn-new-payment"><Plus className="h-4 w-4 mr-2" />Yeni Tahsilat</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Tahsilat Düzenle" : "Yeni Tahsilat"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Müşteri *</Label>
                <Select value={form.customer_id} onValueChange={(v)=>setForm({...form, customer_id:v, service_order_id:"none"})} disabled={!!editing}>
                  <SelectTrigger data-testid="pay-customer"><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
                  <SelectContent>{customers.map(c=><SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!editing && (
                <div><Label>Servis (opsiyonel — boş bırakılırsa harici tahsilat)</Label>
                  <Select value={form.service_order_id} onValueChange={(v)=>setForm({...form, service_order_id:v})} disabled={!form.customer_id}>
                    <SelectTrigger data-testid="pay-service"><SelectValue placeholder="Servis seç (opsiyonel)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Harici Tahsilat (servis yok) —</SelectItem>
                      {orders.map(o => <SelectItem key={o.id} value={o.id}>{o.service_no} · {fmtMoney(o.grand_total)} · Kalan: {fmtMoney(o.grand_total - o.paid_total)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Tutar (₺) *</Label><Input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} data-testid="pay-amount" /></div>
              <div><Label>Ödeme Yöntemi</Label>
                <Select value={form.method} onValueChange={(v)=>setForm({...form, method:v})}>
                  <SelectTrigger data-testid="pay-method"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m=><SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Açıklama</Label><Textarea rows={2} value={form.note} onChange={(e)=>setForm({...form, note:e.target.value})} data-testid="pay-note" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button>
              <Button className="bg-brand-500 hover:bg-brand-600" onClick={save} disabled={saving} data-testid="pay-save">{editing ? "Güncelle" : "Kaydet"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      {(() => {
        const split = METHODS.map((m, i) => {
          const rows = items.filter((x) => x.method === m.v);
          return { name: m.l, value: rows.reduce((a, b) => a + (Number(b.amount) || 0), 0), count: rows.length, color: PALETTE[i] };
        }).filter((x) => x.count > 0);
        const splitTotal = split.reduce((a, b) => a + b.value, 0);
        const top = split.reduce((m, x) => (x.value > (m?.value || 0) ? x : m), null);
        const masked = items.some((x) => x.amount === null || x.amount === undefined);
        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
              <KpiTile testId="pay-total" label="Toplam tahsilat" icon={Wallet} tone="emerald" value={<Money value={total} />} hint={`${items.length} tahsilat kaydı`} />
              <KpiTile testId="pay-avg" label="Ortalama tahsilat" icon={Gauge} tone="cyan" value={<Money value={items.length ? total / items.length : 0} />} hint="Kayıt başına" />
              <KpiTile testId="pay-top" label="En çok kullanılan" icon={CreditCard} tone="violet" value={top ? top.name : "—"} hint={top ? `${top.count} işlem` : "Henüz tahsilat yok"} />
              <KpiTile testId="pay-count" label="Yöntem sayısı" icon={Receipt} tone="orange" value={split.length} hint="Kullanılan ödeme tipi" />
            </div>
            <ChartPanel title="Yönteme göre dağılım" description="Tahsilat tutarının payı">
              {masked ? <LockedChart height={180} /> : split.length ? (
                <>
                  <Donut data={split} centerLabel="Toplam" centerValue={fmtMoney(splitTotal)} height={180} />
                  <ul className="space-y-2.5">
                    {split.map((x) => (
                      <li key={x.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.name}</span>
                          <span className="font-medium">%{splitTotal ? Math.round((x.value / splitTotal) * 100) : 0}</span>
                        </div>
                        <div className="mt-1.5"><Bar value={x.value} max={splitTotal || 1} color={x.color} /></div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="py-10 text-center text-sm text-slate-500">Tahsilat kaydı yok</p>}
            </ChartPanel>
          </div>
        );
      })()}

      <Card className="border-slate-200"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
              <th className="text-left px-4 py-3">Tarih</th>
              <th className="text-left px-4 py-3">Tahsilat No</th>
              <th className="text-left px-4 py-3">Servis</th>
              <th className="text-left px-4 py-3">Yöntem</th>
              <th className="text-left px-4 py-3">Açıklama</th>
              <th className="text-right px-4 py-3">Tutar</th>
              {isAdmin && <th className="text-right px-4 py-3 w-24">İşlem</th>}
            </tr></thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-t hover:bg-slate-50" data-testid={`payment-row-${p.id}`}>
                  <td className="px-4 py-3">{fmtDate(p.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.payment_no}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{p.service_order_id ? "Servise Bağlı" : <span className="text-brand-600 font-semibold">Harici</span>}</td>
                  <td className="px-4 py-3">{methodLabel(p.method)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{p.note || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600"><Money value={p.amount} /></td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={()=>openEdit(p)} data-testid={`pay-edit-${p.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={()=>del(p)} data-testid={`pay-del-${p.id}`} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={isAdmin?7:6}><EmptyState title="Tahsilat kaydı yok" /></td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

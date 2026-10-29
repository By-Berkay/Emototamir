import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { BellRing as PvIcon } from "lucide-react";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { BellRing, Download, MessageCircle, RefreshCw, AlertCircle, CheckSquare, Square } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function Reminders() {
  const [data, setData] = useState({ due: [], overdue: [], upcoming: [], policy: {} });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [tab, setTab] = useState("due");
  const [waOpen, setWaOpen] = useState(false);
  const [waTemplate, setWaTemplate] = useState("");
  const [waLinks, setWaLinks] = useState([]);
  const [waLoading, setWaLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get("/reminders"); setData(r.data); }
    catch { toast.error("Hatırlatmalar yüklenemedi"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = data[tab] || [];
  const anySelected = Object.values(selected).some(Boolean);
  const allSelected = rows.length > 0 && rows.every(r => selected[r.motorcycle_id]);
  const toggleAll = () => {
    const next = { ...selected };
    if (allSelected) rows.forEach(r => delete next[r.motorcycle_id]);
    else rows.forEach(r => next[r.motorcycle_id] = true);
    setSelected(next);
  };

  const downloadCsv = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/api/reminders/export.csv?scope=${tab}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("csv");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hatirlatmalar_${tab}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV indirildi");
    } catch { toast.error("CSV indirilemedi"); }
  };

  const openWhatsApp = () => {
    const ids = Object.entries(selected).filter(([,v])=>v).map(([k])=>k);
    if (!ids.length) return toast.error("En az bir müşteri seçin");
    setWaLinks([]); setWaOpen(true);
  };
  const prepareLinks = async () => {
    const ids = Object.entries(selected).filter(([,v])=>v).map(([k])=>k);
    setWaLoading(true);
    try {
      const r = await api.post("/reminders/whatsapp-batch", { motorcycle_ids: ids, template: waTemplate });
      setWaLinks(r.data.links);
      if (r.data.skipped_no_phone) toast.warning(`${r.data.skipped_no_phone} müşteri telefonu olmadığı için atlandı`);
      else toast.success(`${r.data.links.length} WhatsApp linki hazırlandı`);
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    finally { setWaLoading(false); }
  };
  const openAllLinks = () => { waLinks.forEach((l, i) => setTimeout(() => window.open(l.url, "_blank"), i * 300)); };

  const policy = data.policy || {};
  return (
    <div className="space-y-6">
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        title={<span className="flex items-center gap-2"><BellRing className="h-7 w-7 text-brand-500" />Bakım Hatırlatmaları</span>}
        description={
          <>Kural: son servisten sonra <b>{policy.reminder_km || 5000} km</b> {policy.reminder_mode === "and" ? "ve" : "veya"} <b>{policy.reminder_months || 6} ay</b> geçen motosikletler.</>
        }
        actions={
          <>
            <Button variant="outline" onClick={load} data-testid="reminders-refresh"><RefreshCw className={`h-4 w-4 mr-1 ${loading?"animate-spin":""}`} />Yenile</Button>
            <Button variant="outline" onClick={downloadCsv} data-testid="reminders-csv"><Download className="h-4 w-4 mr-1" />CSV İndir</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!anySelected} onClick={openWhatsApp} data-testid="reminders-whatsapp"><MessageCircle className="h-4 w-4 mr-1" />WhatsApp Yayını</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={()=>{ setTab("due"); setSelected({}); }} className={`block w-full text-left rounded-xl transition-all ${tab==="due"?"ring-2 ring-brand-500":"hover:ring-1 hover:ring-slate-300"}`} data-testid="tab-due">
          <StatCard label="Vadesi Doldu" value={data.due.length} hint="Politika koşulu sağlanan" tone="brand" />
        </button>
        <button onClick={()=>{ setTab("overdue"); setSelected({}); }} className={`block w-full text-left rounded-xl transition-all ${tab==="overdue"?"ring-2 ring-red-500":"hover:ring-1 hover:ring-slate-300"}`} data-testid="tab-overdue">
          <StatCard label="Gecikmiş (Tarih)" value={data.overdue.length} hint="Bakım tarihi geçmiş" tone="red" />
        </button>
        <button onClick={()=>{ setTab("upcoming"); setSelected({}); }} className={`block w-full text-left rounded-xl transition-all ${tab==="upcoming"?"ring-2 ring-amber-500":"hover:ring-1 hover:ring-slate-300"}`} data-testid="tab-upcoming">
          <StatCard label="30 Gün İçinde" value={data.upcoming.length} hint="Yaklaşan bakım" tone="amber" />
        </button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Liste ({rows.length})</CardTitle>
          <button onClick={toggleAll} className="text-sm text-slate-600 hover:text-brand-600 flex items-center gap-1" data-testid="toggle-all">
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Tümünü Seç
          </button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 w-8"></th>
                <th className="text-left px-3 py-2">Müşteri</th>
                <th className="text-left px-3 py-2">Motosiklet</th>
                <th className="text-left px-3 py-2">Plaka</th>
                <th className="text-right px-3 py-2">Son KM</th>
                <th className="text-right px-3 py-2">Şu Anki KM</th>
                <th className="text-left px-3 py-2">Son Servis</th>
                <th className="text-left px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const c = r.customer || {};
                return (
                  <tr key={r.motorcycle_id} className="border-t hover:bg-slate-50" data-testid={`reminder-row-${r.motorcycle_id}`}>
                    <td className="px-3 py-2"><input type="checkbox" checked={!!selected[r.motorcycle_id]} onChange={()=>setSelected({...selected, [r.motorcycle_id]: !selected[r.motorcycle_id]})} data-testid={`reminder-check-${r.motorcycle_id}`} /></td>
                    <td className="px-3 py-2">{c.first_name} {c.last_name} <span className="text-xs text-slate-500 block font-mono">{c.phone || "—"}</span></td>
                    <td className="px-3 py-2">{r.brand} {r.model}</td>
                    <td className="px-3 py-2 font-mono">{r.plate}</td>
                    <td className="px-3 py-2 text-right">{(r.last_km || 0).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-right">{(r.current_km || 0).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 text-xs">{r.last_service_date ? new Date(r.last_service_date).toLocaleDateString("tr-TR") : "—"}</td>
                    <td className="px-3 py-2">
                      {r.km_over && <span className="mr-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">KM+</span>}
                      {r.date_over && <span className="mr-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">Tarih</span>}
                      {r.days_left !== null && r.days_left !== undefined && !r.date_over && <span className="text-xs text-slate-500">{r.days_left} gün</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={8}><EmptyState icon={AlertCircle} title="Bu sekmede kayıt yok." /></td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>WhatsApp Toplu Hatırlatma</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Şablonda kullanılabilecek değişkenler: <code className="bg-slate-100 px-1 rounded">{"{{name}}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{{plate}}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{{brand_model}}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{{km}}"}</code>. Boş bırakırsanız firma varsayılan mesajı kullanılır.</p>
          <Label>Mesaj Şablonu</Label>
          <Textarea rows={4} value={waTemplate} onChange={(e)=>setWaTemplate(e.target.value)} placeholder={"Merhaba {{name}}, {{brand_model}} ({{plate}}) motosikletinizin bakım zamanı yaklaşıyor…"} data-testid="wa-template" />
          {waLinks.length === 0 ? (
            <DialogFooter>
              <Button variant="outline" onClick={()=>setWaOpen(false)}>Vazgeç</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={prepareLinks} disabled={waLoading} data-testid="wa-prepare">{waLoading?"Hazırlanıyor…":"Linkleri Hazırla"}</Button>
            </DialogFooter>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto border rounded">
                <table className="min-w-full text-sm">
                  <tbody>
                    {waLinks.map(l => (
                      <tr key={l.motorcycle_id} className="border-b">
                        <td className="px-3 py-2 w-1/3">{l.name} <span className="text-xs text-slate-500 block font-mono">{l.phone}</span></td>
                        <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-md" title={l.message}>{l.message}</td>
                        <td className="px-3 py-2 text-right"><a href={l.url} target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold text-xs hover:underline" data-testid={`wa-link-${l.motorcycle_id}`}>Aç →</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={()=>setWaOpen(false)}>Kapat</Button>
                <Button onClick={openAllLinks} className="bg-emerald-600 hover:bg-emerald-700" data-testid="wa-open-all">Tümünü Aç ({waLinks.length})</Button>
              </DialogFooter>
              <p className="text-xs text-amber-600">Tarayıcınız popup engelliyorsa tek tek "Aç" butonuyla açın.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

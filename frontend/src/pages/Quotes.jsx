import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { FileText, Plus, ExternalLink, Copy, Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = {
  draft: { label: "Taslak", cls: "bg-slate-100 text-slate-700" },
  sent: { label: "Gönderildi", cls: "bg-blue-100 text-blue-700" },
  approved: { label: "Onaylandı", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Reddedildi", cls: "bg-red-100 text-red-700" },
  expired: { label: "Süresi Doldu", cls: "bg-amber-100 text-amber-700" },
  converted: { label: "İş Emrine Dönüştü", cls: "bg-indigo-100 text-indigo-700" },
};

export default function Quotes() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const load = () => {
    const s = status === "all" ? "" : status;
    api.get(`/quotes${s ? "?status=" + s : ""}`).then(r => setRows(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const filtered = rows.filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return r.quote_no?.toLowerCase().includes(s) || r.customer_name?.toLowerCase().includes(s) || r.motorcycle_label?.toLowerCase().includes(s);
  });

  const copyLink = (token) => {
    const url = `${window.location.origin}/q/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Paylaşım linki kopyalandı");
  };
  const send = async (id) => {
    try { await api.post(`/quotes/${id}/send`); toast.success("Gönderildi olarak işaretlendi"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };
  const convert = async (id) => {
    if (!window.confirm("Bu teklif iş emrine dönüştürülsün mü?")) return;
    try {
      const r = await api.post(`/quotes/${id}/convert`);
      toast.success(`İş emri oluşturuldu: ${r.data.service_no}`);
      nav(`/service-orders/${r.data.service_order_id}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };
  const del = async (id) => {
    if (!window.confirm("Teklif silinsin mi?")) return;
    try { await api.delete(`/quotes/${id}`); toast.success("Silindi"); load(); } catch { toast.error("Silme başarısız"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-2"><FileText className="h-7 w-7 text-brand-500" />Fiyat Teklifleri</span>}
        description="Servisten önce müşteriye teklif gönderin — link ile onayladığında iş emrine dönüşür."
        actions={<Link to="/quotes/new"><Button className="bg-brand-500 hover:bg-brand-600" data-testid="quote-new"><Plus className="h-4 w-4 mr-1" />Yeni Teklif</Button></Link>}
      />

      <div className="flex gap-3 items-center flex-wrap">
        <Input placeholder="Ara (no, müşteri, motosiklet)" value={q} onChange={(e)=>setQ(e.target.value)} className="max-w-xs" data-testid="quote-search" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" data-testid="quote-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="draft">Taslak</SelectItem>
            <SelectItem value="sent">Gönderildi</SelectItem>
            <SelectItem value="approved">Onaylandı</SelectItem>
            <SelectItem value="rejected">Reddedildi</SelectItem>
            <SelectItem value="converted">Dönüştürüldü</SelectItem>
            <SelectItem value="expired">Süresi Doldu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Teklif No</th>
              <th className="text-left px-4 py-2">Müşteri</th>
              <th className="text-left px-4 py-2">Motosiklet</th>
              <th className="text-right px-4 py-2">Tutar</th>
              <th className="text-left px-4 py-2">Durum</th>
              <th className="text-left px-4 py-2">Tarih</th>
              <th className="text-right px-4 py-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const st = STATUS_LABEL[r.status] || { label: r.status, cls: "bg-slate-100" };
              return (
                <tr key={r.id} className="border-t hover:bg-slate-50" data-testid={`quote-row-${r.id}`}>
                  <td className="px-4 py-2"><Link to={`/quotes/${r.id}`} className="font-mono hover:underline">{r.quote_no}</Link></td>
                  <td className="px-4 py-2">{r.customer_name}</td>
                  <td className="px-4 py-2 text-xs">{r.motorcycle_label}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtMoney(r.grand_total)}</td>
                  <td className="px-4 py-2"><span className={`text-[10px] uppercase font-semibold px-2 py-1 rounded ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2 text-xs">{new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button title="Paylaşım linkini kopyala" onClick={()=>copyLink(r.share_token)} className="p-1.5 hover:bg-slate-100 rounded" data-testid={`quote-copy-${r.id}`}><Copy className="h-3.5 w-3.5" /></button>
                      <a title="Müşteri linkini aç" href={`/q/${r.share_token}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-100 rounded" data-testid={`quote-open-${r.id}`}><ExternalLink className="h-3.5 w-3.5" /></a>
                      {(r.status === "draft" || r.status === "rejected") && <button title="Gönderildi olarak işaretle" onClick={()=>send(r.id)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600" data-testid={`quote-send-${r.id}`}><Send className="h-3.5 w-3.5" /></button>}
                      {(r.status === "approved" || r.status === "sent" || r.status === "draft") && <button title="İş Emrine Dönüştür" onClick={()=>convert(r.id)} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700" data-testid={`quote-convert-${r.id}`}>Dönüştür</button>}
                      {r.status !== "converted" && <button title="Sil" onClick={()=>del(r.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600">×</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7}><EmptyState icon={FileText} title="Teklif bulunamadı." /></td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

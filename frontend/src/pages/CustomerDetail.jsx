import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import StatusBadge from "../components/StatusBadge";
import { Bike, Phone, MapPin, Mail, StickyNote, Trash2, PencilLine, Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

function fmtDT(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("tr-TR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return iso; }
}

export const TAG_META = {
  vip:     { label: "VIP",     cls: "bg-amber-100 text-amber-800 border-amber-300",     dot: "bg-amber-500" },
  borclu:  { label: "Borçlu",  cls: "bg-red-100 text-red-800 border-red-300",           dot: "bg-red-500" },
  sorunlu: { label: "Sorunlu", cls: "bg-purple-100 text-purple-800 border-purple-300",  dot: "bg-purple-500" },
};

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const { user } = useAuth();
  const [noteText, setNoteText] = useState("");
  const [noteTag, setNoteTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editTag, setEditTag] = useState("");
  const load = () => api.get(`/customers/${id}`).then((r) => setC(r.data));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!c) return <div>Yükleniyor…</div>;

  const canEdit = (note) => user?.role === "admin" || user?.role === "super_admin" || note.author === user?.email;
  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/customers/${id}/notes`, { text: noteText, tag: noteTag });
      toast.success("Not eklendi"); setNoteText(""); setNoteTag(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Not eklenemedi"); }
  };
  const saveEdit = async (nid) => {
    if (!editText.trim()) return;
    try {
      await api.put(`/customers/${id}/notes/${nid}`, { text: editText, tag: editTag });
      toast.success("Not güncellendi"); setEditingId(null); setEditText(""); setEditTag(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Güncellenemedi"); }
  };
  const removeNote = async (nid) => {
    if (!window.confirm("Not silinsin mi?")) return;
    try {
      await api.delete(`/customers/${id}/notes/${nid}`);
      toast.success("Not silindi"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Silinemedi"); }
  };
  const notes = [...(c.note_entries || [])].sort((a,b) => (b.at || "").localeCompare(a.at || ""));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-bold">
          {c.first_name?.[0]}{c.last_name?.[0]}
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900">{c.first_name} {c.last_name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-1">
            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone}</span>
            {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
            {c.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.city}{c.district?` / ${c.district}`:""}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Toplam Servis</div><div className="text-2xl font-bold">{c.total_services}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Toplam Harcama</div><div className="text-2xl font-bold">{fmtMoney(c.total_spent)}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Toplam Tahsilat</div><div className="text-2xl font-bold text-emerald-600">{fmtMoney(c.total_paid)}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs uppercase text-slate-500">Bakiye (Borç)</div><div className={`text-2xl font-bold ${c.balance>0.01?"text-red-600":"text-emerald-600"}`}>{fmtMoney(c.balance)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="motorcycles">
        <TabsList>
          <TabsTrigger value="motorcycles">Motosikletler ({c.motorcycles.length})</TabsTrigger>
          <TabsTrigger value="services">Servis Geçmişi ({c.service_orders.length})</TabsTrigger>
          <TabsTrigger value="transactions">Cari Hareketler</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">Notlar ({notes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="motorcycles">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.motorcycles.map((m) => (
              <Link to={`/motorcycles/${m.id}`} key={m.id}>
                <Card className="border-slate-200 hover:border-orange-400 transition-colors duration-150">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-md bg-slate-900 text-white flex items-center justify-center"><Bike className="h-5 w-5" /></div>
                      <div>
                        <div className="font-heading font-semibold">{m.brand} {m.model}</div>
                        <div className="text-xs text-slate-500">{m.type} · {m.year}</div>
                      </div>
                    </div>
                    <div className="font-mono text-sm bg-slate-100 rounded px-2 py-1 inline-block">{m.plate}</div>
                    <div className="text-xs text-slate-500 mt-2">{m.km?.toLocaleString("tr-TR")} km</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {c.motorcycles.length === 0 && <div className="text-slate-500 col-span-full">Motosiklet bulunamadı.</div>}
          </div>
        </TabsContent>
        <TabsContent value="services">
          <Card className="border-slate-200"><CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="text-left px-4 py-2">Servis No</th><th className="text-left px-4 py-2">Tarih</th><th className="text-left px-4 py-2">Motosiklet</th><th className="text-left px-4 py-2">Durum</th><th className="text-right px-4 py-2">Tutar</th></tr>
              </thead>
              <tbody>
                {c.service_orders.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2"><Link to={`/service-orders/${o.id}`} className="font-mono hover:underline">{o.service_no}</Link></td>
                    <td className="px-4 py-2">{fmtDateShort(o.created_at)}</td>
                    <td className="px-4 py-2">{o.brand} {o.model} <span className="font-mono text-xs text-slate-500">({o.plate})</span></td>
                    <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2 text-right font-medium">{fmtMoney(o.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card className="border-slate-200"><CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Tarih</th><th className="text-left px-4 py-2">Tür</th><th className="text-left px-4 py-2">Açıklama</th><th className="text-right px-4 py-2">Tutar</th></tr></thead>
              <tbody>
                {c.transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2">{fmtDateShort(t.created_at)}</td>
                    <td className="px-4 py-2">{t.type === "charge" ? "Borç" : t.type === "payment" ? "Tahsilat" : "Düzeltme"}</td>
                    <td className="px-4 py-2">{t.description}</td>
                    <td className={`px-4 py-2 text-right font-medium ${t.amount>0?"text-red-600":"text-emerald-600"}`}>{fmtMoney(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="notes">
          <Card className="border-slate-200">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4 text-orange-500" />Zaman Damgalı Notlar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-2">
                <Textarea rows={2} value={noteText} onChange={(e)=>setNoteText(e.target.value)} placeholder="Yeni not… (Örn: Bir sonraki servis öncesi ara.)" data-testid="note-input" className="flex-1" />
                <div className="flex md:flex-col gap-2">
                  <select value={noteTag} onChange={(e)=>setNoteTag(e.target.value)} className="border rounded-md px-2 py-1 text-sm" data-testid="note-tag">
                    <option value="">— Etiket yok —</option>
                    <option value="vip">⭐ VIP</option>
                    <option value="borclu">💰 Borçlu</option>
                    <option value="sorunlu">⚠ Sorunlu</option>
                  </select>
                  <Button onClick={addNote} className="bg-orange-500 hover:bg-orange-600" data-testid="note-add">Ekle</Button>
                </div>
              </div>
              {notes.length === 0 && <div className="text-sm text-slate-500 text-center py-6">Henüz not eklenmemiş.</div>}
              <div className="space-y-3">
                {notes.map((n)=>{
                  const meta = TAG_META[n.tag];
                  return (
                  <div key={n.id} className={`border rounded-md p-3 ${meta ? "border-l-4" : "border-slate-200"}`} style={meta ? { borderLeftColor: meta.dot.includes("amber") ? "#F59E0B" : meta.dot.includes("red") ? "#EF4444" : "#A855F7" } : {}} data-testid={`note-${n.id}`}>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {meta && <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>}
                        <span className="font-semibold text-slate-700">{n.author_name || n.author}</span>
                        <span>·</span>
                        <span>{fmtDT(n.at)}</span>
                        {n.updated_at && <span className="italic">(düzenlendi {fmtDT(n.updated_at)})</span>}
                      </div>
                      {canEdit(n) && editingId !== n.id && (
                        <div className="flex gap-1">
                          <button onClick={()=>{ setEditingId(n.id); setEditText(n.text); setEditTag(n.tag || ""); }} className="text-slate-500 hover:text-orange-600 p-1" data-testid={`note-edit-${n.id}`}><PencilLine className="h-3.5 w-3.5" /></button>
                          <button onClick={()=>removeNote(n.id)} className="text-slate-500 hover:text-red-600 p-1" data-testid={`note-del-${n.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                    {editingId === n.id ? (
                      <div className="flex flex-col md:flex-row gap-2">
                        <Textarea rows={2} value={editText} onChange={(e)=>setEditText(e.target.value)} data-testid={`note-edit-input-${n.id}`} className="flex-1" />
                        <div className="flex md:flex-col gap-2">
                          <select value={editTag} onChange={(e)=>setEditTag(e.target.value)} className="border rounded-md px-2 py-1 text-sm" data-testid={`note-edit-tag-${n.id}`}>
                            <option value="">— Etiket yok —</option>
                            <option value="vip">⭐ VIP</option>
                            <option value="borclu">💰 Borçlu</option>
                            <option value="sorunlu">⚠ Sorunlu</option>
                          </select>
                          <div className="flex gap-1">
                            <Button size="icon" variant="outline" onClick={()=>saveEdit(n.id)} data-testid={`note-save-${n.id}`}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="outline" onClick={()=>{ setEditingId(null); setEditText(""); setEditTag(""); }}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-800 whitespace-pre-wrap">{n.text}</div>
                    )}
                  </div>
                );})}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

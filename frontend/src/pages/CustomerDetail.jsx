import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { fmtMoney, fmtDateShort } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { UserRound as PvIcon } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { Bike, Phone, MapPin, Mail, StickyNote, Trash2, PencilLine, Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

function fmtDT(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

// Müşteri etiketleri; Customers listesi de bu tanımı kullanır.
export const TAG_META = {
  vip:     { label: "VIP",     cls: "bg-amber-100 text-amber-800 border-amber-300",     dot: "bg-amber-500", stripe: "#F59E0B" },
  borclu:  { label: "Borçlu",  cls: "bg-red-100 text-red-800 border-red-300",           dot: "bg-red-500", stripe: "#EF4444" },
  sorunlu: { label: "Sorunlu", cls: "bg-purple-100 text-purple-800 border-purple-300",  dot: "bg-purple-500", stripe: "#A855F7" },
};

const TAG_OPTIONS = [
  { value: "", label: "Etiket yok" },
  { value: "vip", label: "VIP" },
  { value: "borclu", label: "Borçlu" },
  { value: "sorunlu", label: "Sorunlu" },
];

const selectCls =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-slate-300 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20";

const TRANSACTION_LABEL = { charge: "Borç", payment: "Tahsilat", cancel: "İptal", adjust: "Düzeltme" };

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const { user } = useAuth();
  const [noteText, setNoteText] = useState("");
  const [noteTag, setNoteTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editTag, setEditTag] = useState("");
  const load = () => api.get(`/customers/${id}`).then((r) => setC(r.data))
    .catch(() => toast.error("Müşteri bilgileri yüklenemedi"));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!c) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

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
  const notes = [...(c.note_entries || [])].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const initials = `${c.first_name?.[0] || ""}${c.last_name?.[0] || ""}`;
  const tagMeta = c.top_tag ? TAG_META[c.top_tag] : null;

  return (
    <div className="space-y-8">
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        eyebrow="Müşteri kartı"
        title={`${c.first_name} ${c.last_name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-mono"><Phone className="h-3.5 w-3.5" />{c.phone}</span>
            {c.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
            {c.city && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.city}{c.district ? ` / ${c.district}` : ""}</span>}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            {tagMeta && <Badge variant="warning" className={tagMeta.cls}>{tagMeta.label}</Badge>}
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 font-heading text-base font-bold text-white">
              {initials}
            </span>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Bike} label="Toplam servis" value={c.total_services} tone="slate" />
        <StatCard label="Toplam harcama" value={fmtMoney(c.total_spent)} tone="slate" />
        <StatCard label="Toplam tahsilat" value={fmtMoney(c.total_paid)} tone="emerald" />
        <StatCard label="Bakiye (borç)" value={fmtMoney(c.balance)} tone={c.balance > 0.01 ? "red" : "emerald"} />
      </section>

      <Tabs defaultValue="motorcycles">
        <TabsList>
          <TabsTrigger value="motorcycles">Motosikletler ({c.motorcycles.length})</TabsTrigger>
          <TabsTrigger value="services">Servis geçmişi ({c.service_orders.length})</TabsTrigger>
          <TabsTrigger value="transactions">Cari hareketler</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">Notlar ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="motorcycles" className="mt-6">
          {c.motorcycles.length === 0 ? (
            <Card><EmptyState icon={Bike} title="Motosiklet bulunamadı" description="Bu müşteriye bağlı motosiklet yok." className="py-12" /></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {c.motorcycles.map((m) => (
                <Link key={m.id} to={`/motorcycles/${m.id}`} className="group block">
                  <Card className="h-full transition-[border-color,box-shadow] duration-150 group-hover:border-brand-300 group-hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                            <Bike className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-heading font-semibold text-slate-900">{m.brand} {m.model}</div>
                            <div className="text-xs text-slate-500">{m.type} · {m.year}</div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-800">{m.plate}</span>
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 tabular-nums">
                        {m.km?.toLocaleString("tr-TR")} km
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {c.service_orders.length === 0 ? (
                <EmptyState title="Servis kaydı yok" description="Bu müşterinin henüz iş emri bulunmuyor." className="py-12" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Servis no</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Motosiklet</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.service_orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link to={`/service-orders/${o.id}`} className="font-mono font-medium text-slate-900 hover:text-brand-600 hover:underline">{o.service_no}</Link>
                        </TableCell>
                        <TableCell>{fmtDateShort(o.created_at)}</TableCell>
                        <TableCell>
                          {o.brand} {o.model} <span className="ml-1 font-mono text-xs text-slate-500">({o.plate})</span>
                        </TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{fmtMoney(o.grand_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {c.transactions.length === 0 ? (
                <EmptyState title="Cari hareket yok" description="Borç ve tahsilat hareketleri burada listelenir." className="py-12" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Tarih</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Açıklama</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDateShort(t.created_at)}</TableCell>
                        <TableCell>{TRANSACTION_LABEL[t.type] || "Düzeltme"}</TableCell>
                        <TableCell className="text-slate-600">{t.description}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${t.amount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {fmtMoney(t.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="h-4 w-4 text-brand-600" />Zaman damgalı notlar
              </CardTitle>
              <CardDescription>Müşteriyle ilgili kısa notlar ve isteğe bağlı etiketler.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-2 md:flex-row">
                <Textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Yeni not… (Örn: Bir sonraki servis öncesi ara.)"
                  data-testid="note-input"
                  className="flex-1"
                />
                <div className="flex gap-2 md:flex-col">
                  <select value={noteTag} onChange={(e) => setNoteTag(e.target.value)} className={selectCls} data-testid="note-tag" aria-label="Not etiketi">
                    {TAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <Button onClick={addNote} data-testid="note-add">Ekle</Button>
                </div>
              </div>

              {notes.length === 0 && (
                <EmptyState icon={StickyNote} title="Henüz not eklenmemiş" description="Müşteriyle ilgili ilk notu yukarıdan ekleyin." className="py-8" />
              )}

              <div className="space-y-3">
                {notes.map((n) => {
                  const meta = TAG_META[n.tag];
                  return (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                      style={meta ? { borderLeft: `4px solid ${meta.stripe}` } : undefined}
                      data-testid={`note-${n.id}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3 text-xs text-slate-500">
                        <div className="flex flex-wrap items-center gap-2">
                          {meta && <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.cls}`}>{meta.label}</span>}
                          <span className="font-semibold text-slate-700">{n.author_name || n.author}</span>
                          <span aria-hidden="true">·</span>
                          <span>{fmtDT(n.at)}</span>
                          {n.updated_at && <span className="italic">(düzenlendi {fmtDT(n.updated_at)})</span>}
                        </div>
                        {canEdit(n) && editingId !== n.id && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => { setEditingId(n.id); setEditText(n.text); setEditTag(n.tag || ""); }}
                              className="rounded-md p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-brand-600"
                              aria-label="Notu düzenle"
                              data-testid={`note-edit-${n.id}`}
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => removeNote(n.id)}
                              className="rounded-md p-1.5 text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                              aria-label="Notu sil"
                              data-testid={`note-del-${n.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {editingId === n.id ? (
                        <div className="flex flex-col gap-2 md:flex-row">
                          <Textarea
                            rows={2}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            data-testid={`note-edit-input-${n.id}`}
                            className="flex-1"
                          />
                          <div className="flex gap-2 md:flex-col">
                            <select value={editTag} onChange={(e) => setEditTag(e.target.value)} className={selectCls} data-testid={`note-edit-tag-${n.id}`} aria-label="Etiketi düzenle">
                              {TAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <div className="flex gap-1.5">
                              <Button size="icon" variant="outline" onClick={() => saveEdit(n.id)} data-testid={`note-save-${n.id}`} aria-label="Kaydet">
                                <Check />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => { setEditingId(null); setEditText(""); setEditTag(""); }}
                                aria-label="Vazgeç"
                              >
                                <X />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{n.text}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

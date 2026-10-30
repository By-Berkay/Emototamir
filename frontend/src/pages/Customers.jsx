import React, { useEffect, useState } from "react";
import { CountStrip } from "../components/reports/ReportKit";
import { Mail, MapPin, CircleCheck } from "lucide-react";
import api, { fmtMoney } from "../lib/api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Users, Search, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TAG_META } from "./CustomerDetail";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { Users as PvIcon } from "lucide-react";
import EmptyState from "../components/EmptyState";

const empty = { first_name: "", last_name: "", phone: "", alt_phone: "", email: "", tc_no: "", address: "", city: "", district: "", notes: "" };

const initials = (c) => `${c.first_name?.[0] || ""}${c.last_name?.[0] || ""}`;

function TagBadge({ tag, testId }) {
  if (!tag || !TAG_META[tag]) return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TAG_META[tag].cls}`}
      data-testid={testId}
    >
      {TAG_META[tag].label}
    </span>
  );
}

export default function Customers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState({});
  const [delDialog, setDelDialog] = useState({ open: false, ids: [], reason: "" });
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "super_admin";

  const load = async () => {
    const { data } = await api.get(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setItems(data);
  };
  // Arama değişince seçimi temizle (görünmeyen kayıtlar toplu silmeye girmesin); eski yanıt yeni listeyi ezmesin
  useEffect(() => {
    let active = true;
    setSelected({});
    api.get(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(({ data }) => { if (active) setItems(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [q]);

  const save = async () => {
    if (!form.first_name || !form.last_name || !form.phone) return toast.error("Ad, soyad ve telefon zorunlu");
    try {
      await api.post("/customers", form);
      toast.success("Müşteri eklendi");
      setOpen(false); setForm(empty); load();
    } catch (e) {
      toast.error("Kayıt başarısız");
    }
  };

  const del = async (c) => {
    setDelDialog({ open: true, ids: [c.id], reason: "" });
  };

  const confirmDelete = async () => {
    const { ids, reason } = delDialog;
    if (!reason.trim()) return toast.error("Silme sebebi zorunlu");
    try {
      if (ids.length === 1) {
        // Açık servis kaydı varsa backend silmeyi engeller; kullanıcı onaylarsa force ile tekrar denenir
        let res;
        try {
          res = await api.delete(`/customers/${ids[0]}`, { data: { reason, force: false } });
        } catch (err) {
          const detail = err.response?.data?.detail || "";
          if (err.response?.status !== 400 || !detail.includes("açık servis")) throw err;
          if (!window.confirm(`${detail}\n\nYine de silinsin mi? Açık servis kayıtları da çöp kutusuna alınır.`)) return;
          res = await api.delete(`/customers/${ids[0]}`, { data: { reason, force: true } });
        }
        const parts = Object.entries(res.data.counts || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
        toast.success(`Silindi · Çöp kutusuna alındı${parts.length ? ` · ${parts.join(", ")}` : ""}`);
      } else {
        const { data } = await api.post("/customers/bulk-delete", { ids, reason, force: false });
        let deleted = data.deleted;
        const blocked = data.results.filter((r) => !r.ok).map((r) => r.id);
        if (blocked.length && window.confirm(`${blocked.length} müşterinin açık servis kaydı var.\n\nBu müşteriler servis kayıtlarıyla birlikte çöp kutusuna alınsın mı?`)) {
          const { data: forced } = await api.post("/customers/bulk-delete", { ids: blocked, reason, force: true });
          deleted += forced.deleted;
        }
        toast.success(`${deleted}/${data.total} müşteri çöp kutusuna alındı`);
      }
      setDelDialog({ open: false, ids: [], reason: "" });
      setSelected({});
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Silme başarısız");
    }
  };

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allSelected = items.length > 0 && items.every((c) => selected[c.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else {
      const s = {}; items.forEach((c) => { s[c.id] = true; }); setSelected(s);
    }
  };
  const toggleOne = (id) => setSelected({ ...selected, [id]: !selected[id] });

  return (
    <div className="space-y-6">
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        eyebrow="Müşteri kayıtları"
        title="Müşteriler"
        description={`${items.length} müşteri`}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-customer">
                <Plus /> Yeni Müşteri
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Yeni Müşteri</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Ad *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="input-first-name" /></div>
                <div className="space-y-1.5"><Label>Soyad *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="input-last-name" /></div>
                <div className="space-y-1.5"><Label>Telefon *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" /></div>
                <div className="space-y-1.5"><Label>Alternatif telefon</Label><Input value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>E-posta</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>TC Kimlik No</Label><Input value={form.tc_no} onChange={(e) => setForm({ ...form, tc_no: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>İl</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>İlçe</Label><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Adres</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Notlar</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                <Button onClick={save} data-testid="btn-save-customer">Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <CountStrip items={[
        { label: "Toplam müşteri", value: items.length, hint: "Kayıtlı müşteri", icon: Users, tone: "orange", testId: "cust-total" },
        { label: "E-posta kayıtlı", value: items.filter((c) => c.email).length, hint: "İletişim bilgisi tam", icon: Mail, tone: "cyan", testId: "cust-email" },
        { label: "Şehir sayısı", value: new Set(items.map((c) => c.city).filter(Boolean)).size, hint: "Farklı il", icon: MapPin, tone: "violet", testId: "cust-cities" },
        { label: "Notlu müşteri", value: items.filter((c) => (c.notes || "").trim()).length, hint: "Not eklenmiş", icon: CircleCheck, tone: "emerald", testId: "cust-notes" },
      ]} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="İsim veya telefon ile ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            data-testid="customer-search"
            aria-label="Müşteri ara"
          />
        </div>
        {canDelete && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800" data-testid="bulk-bar">
            <span className="font-semibold">{selectedIds.length} seçili</span>
            <Button size="sm" variant="outline" onClick={() => setSelected({})}>Temizle</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDelDialog({ open: true, ids: selectedIds, reason: "" })}
              data-testid="bulk-delete"
            >
              <Trash2 />Seçileni Sil ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Müşteri bulunamadı"
            description="Arama ifadesini değiştirin ya da yeni bir müşteri ekleyin."
            className="py-16"
          />
        </Card>
      ) : (
        <>
          {/* Masaüstü: tablo */}
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {canDelete && (
                      <TableHead className="w-10">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} data-testid="check-all" aria-label="Tümünü seç" />
                      </TableHead>
                    )}
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Şehir</TableHead>
                    <TableHead className="text-right">Servis</TableHead>
                    <TableHead className="text-right">Toplam harcama</TableHead>
                    <TableHead className="text-right">Bakiye</TableHead>
                    {canDelete && <TableHead className="w-16 text-right">İşlem</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id} data-state={selected[c.id] ? "selected" : undefined}>
                      {canDelete && (
                        <TableCell>
                          <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleOne(c.id)} data-testid={`check-customer-${c.id}`} aria-label="Müşteriyi seç" />
                        </TableCell>
                      )}
                      <TableCell>
                        <Link to={`/customers/${c.id}`} className="group flex items-center gap-3" data-testid={`customer-row-${c.id}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 font-heading text-xs font-bold text-white">
                            {initials(c)}
                          </span>
                          <span className="font-medium text-slate-900 group-hover:text-brand-600 group-hover:underline">
                            {c.first_name} {c.last_name}
                          </span>
                          <TagBadge tag={c.top_tag} testId={`customer-tag-${c.id}`} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 font-mono text-slate-700"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}</span>
                      </TableCell>
                      <TableCell className="text-slate-600">{c.city || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.total_services}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(c.total_spent)}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${c.balance > 0.01 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmtMoney(c.balance)}
                      </TableCell>
                      {canDelete && (
                        <TableCell className="text-right">
                          <button
                            onClick={() => del(c)}
                            className="rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                            title="Müşteriyi sil"
                            aria-label="Müşteriyi sil"
                            data-testid={`del-customer-${c.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobil: kart listesi */}
          <div className="space-y-3 md:hidden">
            {items.map((c) => (
              <Card key={c.id} className={selected[c.id] ? "border-red-200 bg-red-50/40" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {canDelete && (
                      <input
                        type="checkbox"
                        className="mt-2.5"
                        checked={!!selected[c.id]}
                        onChange={() => toggleOne(c.id)}
                        aria-label="Müşteriyi seç"
                      />
                    )}
                    <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3" data-testid={`customer-card-${c.id}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 font-heading text-xs font-bold text-white">
                        {initials(c)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{c.first_name} {c.last_name}</span>
                          <TagBadge tag={c.top_tag} />
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-xs text-slate-500">
                          <Phone className="h-3 w-3" />{c.phone}
                        </span>
                      </span>
                    </Link>
                    {canDelete && (
                      <button
                        onClick={() => del(c)}
                        className="rounded-md p-2 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                        aria-label="Müşteriyi sil"
                        data-testid={`del-customer-mobile-${c.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Servis</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{c.total_services}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Harcama</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmtMoney(c.total_spent)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Bakiye</dt>
                      <dd className={`mt-0.5 font-semibold tabular-nums ${c.balance > 0.01 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmtMoney(c.balance)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Silme sebebi dialogu */}
      <Dialog open={delDialog.open} onOpenChange={(o) => { if (!o) setDelDialog({ open: false, ids: [], reason: "" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {delDialog.ids.length === 1 ? "Müşteriyi Sil" : `${delDialog.ids.length} Müşteriyi Sil`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Silinen kayıtlar <b>çöp kutusuna</b> alınır ve <b>30 gün</b> içinde geri yüklenebilir. 30 gün sonra kalıcı olarak silinir.
            </p>
            <div className="space-y-1.5">
              <Label>Silme Sebebi * <span className="text-xs font-normal text-slate-400">(denetim kaydına yazılır)</span></Label>
              <Textarea
                rows={3}
                value={delDialog.reason}
                onChange={(e) => setDelDialog({ ...delDialog, reason: e.target.value })}
                placeholder="Örn: Yanlış girilmiş müşteri kaydı · Test verisi · Talep üzerine (KVKK)"
                data-testid="delete-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelDialog({ open: false, ids: [], reason: "" })}>İptal</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!delDialog.reason.trim()} data-testid="delete-confirm">
              <Trash2 />Sil ve Çöp Kutusuna Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

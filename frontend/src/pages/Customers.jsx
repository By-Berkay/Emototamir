import React, { useEffect, useState } from "react";
import api, { fmtMoney } from "../lib/api";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Plus, Users, Search, Phone, Trash2, Mail, UserCheck, CalendarPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { TAG_META } from "./CustomerDetail";
import { useAuth } from "../context/AuthContext";
import { HeroBanner, KpiCard, Panel, StatusBadge, DataTable, FilterChips } from "../components/design/kit";

const empty = { first_name: "", last_name: "", phone: "", alt_phone: "", email: "", tc_no: "", address: "", city: "", district: "", notes: "" };

const initials = (c) => `${c.first_name?.[0] || ""}${c.last_name?.[0] || ""}`;

const INPUT_CLS = "border-white/10 bg-white/5 text-white placeholder:text-slate-500 hover:border-white/20 focus-visible:border-orange-500 focus-visible:ring-orange-500/20";
const LABEL_CLS = "text-slate-300";
const DIALOG_CLS = "!bg-slate-950 border-white/10 text-white";
const GHOST_BTN = "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white";
const PRIMARY_BTN = "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600";
const ICON_BTN = "flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 ring-1 ring-white/10 transition-colors duration-150 hover:bg-rose-500/15 hover:text-rose-300 hover:ring-rose-500/30";

const balanceOf = (c) => Number(c.balance || 0);
const isThisMonth = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
};

// Durum: bakiye > 0 ise Borçlu, servisi olan Aktif, diğerleri Pasif (yüklü veriden hesaplanır)
const statusOf = (c) => {
  if (balanceOf(c) > 0.01) return { key: "borclu", label: "Borçlu", tone: "danger" };
  if (Number(c.total_services || 0) > 0) return { key: "aktif", label: "Aktif", tone: "success" };
  return { key: "pasif", label: "Pasif", tone: "neutral" };
};

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

function Empty({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="font-heading text-base font-semibold text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
    </div>
  );
}

export default function Customers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  // Durum filtresi istemci tarafında uygulanır; filtre değişince seçim temizlenir
  const visible = items.filter((c) => statusFilter === "all" || statusOf(c).key === statusFilter);
  const statusCounts = { aktif: 0, borclu: 0, pasif: 0 };
  items.forEach((c) => { statusCounts[statusOf(c).key] += 1; });
  const openBalance = items.reduce((sum, c) => sum + Math.max(balanceOf(c), 0), 0);
  const newThisMonth = items.filter((c) => isThisMonth(c.created_at)).length;
  const emailCount = items.filter((c) => c.email).length;
  const cityCount = new Set(items.map((c) => c.city).filter(Boolean)).size;
  const notesCount = items.filter((c) => (c.notes || "").trim()).length;
  const pct = (n) => (items.length ? `${Math.round((n / items.length) * 100)}%` : "0%");

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allSelected = visible.length > 0 && visible.every((c) => selected[c.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else {
      const s = {}; visible.forEach((c) => { s[c.id] = true; }); setSelected(s);
    }
  };
  const toggleOne = (id) => setSelected({ ...selected, [id]: !selected[id] });
  const changeFilter = (v) => { setStatusFilter(v); setSelected({}); };

  const filterOptions = [
    { value: "all", label: `Tümü (${items.length})` },
    { value: "aktif", label: `Aktif (${statusCounts.aktif})` },
    { value: "borclu", label: `Borçlu (${statusCounts.borclu})` },
    { value: "pasif", label: `Pasif (${statusCounts.pasif})` },
  ];

  return (
    <div className="space-y-6">
      <HeroBanner
        testId="customers-hero"
        eyebrow="Müşteri kayıtları"
        title="Müşteriler"
        subtitle={`${items.length} müşteri kayıtlı · ${newThisMonth} yeni müşteri bu ay`}
        slot="customers_hero"
        fallback={null}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button className={PRIMARY_BTN} data-testid="btn-new-customer">
                <Plus /> Yeni müşteri
              </Button>
            </DialogTrigger>
            <DialogContent className={`max-w-2xl ${DIALOG_CLS}`}>
              <DialogHeader><DialogTitle>Yeni Müşteri</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className={LABEL_CLS}>Ad *</Label><Input className={INPUT_CLS} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="input-first-name" /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>Soyad *</Label><Input className={INPUT_CLS} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="input-last-name" /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>Telefon *</Label><Input className={INPUT_CLS} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>Alternatif telefon</Label><Input className={INPUT_CLS} value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>E-posta</Label><Input className={INPUT_CLS} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>TC Kimlik No</Label><Input className={INPUT_CLS} value={form.tc_no} onChange={(e) => setForm({ ...form, tc_no: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>İl</Label><Input className={INPUT_CLS} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className={LABEL_CLS}>İlçe</Label><Input className={INPUT_CLS} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className={LABEL_CLS}>Adres</Label><Textarea className={INPUT_CLS} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className={LABEL_CLS}>Notlar</Label><Textarea className={INPUT_CLS} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" className={GHOST_BTN} onClick={() => setOpen(false)}>İptal</Button>
                <Button className={PRIMARY_BTN} onClick={save} data-testid="btn-save-customer">Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <KpiCard icon={Users} label="Toplam müşteri" value={items.length} delta={`+${newThisMonth} bu ay`} deltaTone="neutral" tone="orange" testId="cust-total" />
        <KpiCard icon={UserCheck} label="Aktif müşteri" value={statusCounts.aktif} delta={pct(statusCounts.aktif)} deltaTone="up" tone="green" testId="cust-active" />
        <KpiCard icon={CalendarPlus} label="Bu ay yeni" value={newThisMonth} delta={newThisMonth ? "Yeni kayıt" : "Kayıt yok"} deltaTone={newThisMonth ? "up" : "neutral"} tone="blue" testId="cust-new-month" />
        <KpiCard icon={Wallet} label="Açık bakiye" value={fmtMoney(openBalance)} delta={`${statusCounts.borclu} borçlu`} deltaTone={statusCounts.borclu ? "down" : "neutral"} tone="amber" testId="cust-balance" />
        <KpiCard icon={Mail} label="E-posta kayıtlı" value={emailCount} delta={pct(emailCount)} deltaTone="neutral" tone="violet" testId="cust-email" />
      </section>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="İsim veya telefon ile ara"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${INPUT_CLS} pl-9`}
              data-testid="customer-search"
              aria-label="Müşteri ara"
            />
          </div>
          {canDelete && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-200" data-testid="bulk-bar">
              <span className="font-semibold">{selectedIds.length} seçili</span>
              <Button size="sm" variant="outline" className={GHOST_BTN} onClick={() => setSelected({})}>Temizle</Button>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips options={filterOptions} value={statusFilter} onChange={changeFilter} />
          <p className="text-xs text-slate-400">
            <span data-testid="cust-cities">{cityCount} il</span>
            <span aria-hidden="true"> · </span>
            <span data-testid="cust-notes">{notesCount} notlu müşteri</span>
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <Panel>
          <Empty
            icon={Users}
            title="Müşteri bulunamadı"
            description="Arama ifadesini veya filtreyi değiştirin ya da yeni bir müşteri ekleyin."
          />
        </Panel>
      ) : (
        <>
          {/* Masaüstü: tablo */}
          <Panel
            title="Müşteri listesi"
            subtitle={`${visible.length} kayıt gösteriliyor`}
            className="hidden overflow-hidden md:block"
            bodyClassName="!p-0"
          >
            <DataTable>
              <thead>
                <tr>
                  {canDelete && (
                    <th className="w-10">
                      <input type="checkbox" className="accent-orange-500" checked={allSelected} onChange={toggleAll} data-testid="check-all" aria-label="Tümünü seç" />
                    </th>
                  )}
                  <th>Müşteri</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Şehir</th>
                  <th className="text-right">Servis</th>
                  <th className="text-right">Toplam harcama</th>
                  <th className="text-right">Bakiye</th>
                  <th>Durum</th>
                  {canDelete && <th className="w-16 text-right">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const st = statusOf(c);
                  const bal = balanceOf(c);
                  return (
                    <tr key={c.id} data-state={selected[c.id] ? "selected" : undefined}>
                      {canDelete && (
                        <td>
                          <input type="checkbox" className="accent-orange-500" checked={!!selected[c.id]} onChange={() => toggleOne(c.id)} data-testid={`check-customer-${c.id}`} aria-label="Müşteriyi seç" />
                        </td>
                      )}
                      <td>
                        <Link to={`/customers/${c.id}`} className="group flex items-center gap-3" data-testid={`customer-row-${c.id}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 font-heading text-xs font-bold text-white ring-1 ring-orange-400/30">
                            {initials(c)}
                          </span>
                          <span className="font-medium text-white transition-colors group-hover:text-orange-400">
                            {c.first_name} {c.last_name}
                          </span>
                          <TagBadge tag={c.top_tag} testId={`customer-tag-${c.id}`} />
                        </Link>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 font-mono text-slate-300"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}</span>
                      </td>
                      <td className="text-slate-400">{c.email || "-"}</td>
                      <td className="text-slate-400">{c.city || "-"}</td>
                      <td className="text-right tabular-nums text-slate-200">{c.total_services}</td>
                      <td className="text-right tabular-nums text-slate-200">{fmtMoney(c.total_spent)}</td>
                      <td className={`text-right font-semibold tabular-nums ${bal > 0.01 ? "text-rose-400" : "text-emerald-400"}`}>
                        {fmtMoney(c.balance)}
                      </td>
                      <td>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </td>
                      {canDelete && (
                        <td className="text-right">
                          <button
                            onClick={() => del(c)}
                            className={`ml-auto ${ICON_BTN}`}
                            title="Müşteriyi sil"
                            aria-label="Müşteriyi sil"
                            data-testid={`del-customer-${c.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </Panel>

          {/* Mobil: kart listesi */}
          <div className="space-y-3 md:hidden">
            {visible.map((c) => {
              const st = statusOf(c);
              const bal = balanceOf(c);
              return (
                <div
                  key={c.id}
                  className={`emt-glass-dark rounded-2xl border p-4 text-white ${selected[c.id] ? "border-rose-500/40 bg-rose-500/10" : "border-white/10"}`}
                >
                  <div className="flex items-start gap-3">
                    {canDelete && (
                      <input
                        type="checkbox"
                        className="mt-2.5 accent-orange-500"
                        checked={!!selected[c.id]}
                        onChange={() => toggleOne(c.id)}
                        aria-label="Müşteriyi seç"
                      />
                    )}
                    <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3" data-testid={`customer-card-${c.id}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 font-heading text-xs font-bold text-white ring-1 ring-orange-400/30">
                        {initials(c)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-white">{c.first_name} {c.last_name}</span>
                          <TagBadge tag={c.top_tag} />
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-xs text-slate-400">
                          <Phone className="h-3 w-3" />{c.phone}
                        </span>
                      </span>
                    </Link>
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    {canDelete && (
                      <button
                        onClick={() => del(c)}
                        className={ICON_BTN}
                        aria-label="Müşteriyi sil"
                        data-testid={`del-customer-mobile-${c.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-xs">
                    <div>
                      <dt className="text-slate-400">Servis</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-white">{c.total_services}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Harcama</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-white">{fmtMoney(c.total_spent)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Bakiye</dt>
                      <dd className={`mt-0.5 font-semibold tabular-nums ${bal > 0.01 ? "text-rose-400" : "text-emerald-400"}`}>
                        {fmtMoney(c.balance)}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Silme sebebi dialogu */}
      <Dialog open={delDialog.open} onOpenChange={(o) => { if (!o) setDelDialog({ open: false, ids: [], reason: "" }); }}>
        <DialogContent className={DIALOG_CLS}>
          <DialogHeader>
            <DialogTitle>
              {delDialog.ids.length === 1 ? "Müşteriyi Sil" : `${delDialog.ids.length} Müşteriyi Sil`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Silinen kayıtlar <b>çöp kutusuna</b> alınır ve <b>30 gün</b> içinde geri yüklenebilir. 30 gün sonra kalıcı olarak silinir.
            </p>
            <div className="space-y-1.5">
              <Label className={LABEL_CLS}>Silme Sebebi * <span className="text-xs font-normal text-slate-400">(denetim kaydına yazılır)</span></Label>
              <Textarea
                className={INPUT_CLS}
                rows={3}
                value={delDialog.reason}
                onChange={(e) => setDelDialog({ ...delDialog, reason: e.target.value })}
                placeholder="Örn: Yanlış girilmiş müşteri kaydı · Test verisi · Talep üzerine (KVKK)"
                data-testid="delete-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className={GHOST_BTN} onClick={() => setDelDialog({ open: false, ids: [], reason: "" })}>İptal</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!delDialog.reason.trim()} data-testid="delete-confirm">
              <Trash2 />Sil ve Çöp Kutusuna Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

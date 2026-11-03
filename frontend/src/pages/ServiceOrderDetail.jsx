import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FileDown, MessageCircle, Pencil, Trash2, Copy, Bike, Gauge, Fuel, Wallet } from "lucide-react";
import api, { openAuthedPdf, fmtDate, fmtDateShort, STATUS_META, STATUS_LIST } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { HeroBanner, Panel, StatusBadge, DataTable } from "../components/design/kit";
import Money from "../components/Money";
import SignaturePad from "../components/SignaturePad";
import PhotoUploader from "../components/PhotoUploader";
import { documentTotals, lineAmounts, DEFAULT_VAT } from "../lib/pricing";
import { toast } from "sonner";

/* Durum -> rozet tonu eşlemesi (yalnızca sunumda kullanılır). */
const STATUS_TONE = {
  new: "info",
  diagnosed: "violet",
  pricing: "neutral",
  awaiting_approval: "warning",
  approved: "success",
  in_repair: "brand",
  parts_waiting: "warning",
  completed: "success",
  awaiting_delivery: "info",
  delivered: "success",
  cancelled: "danger",
};

const OUTLINE_BTN = "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white";

/* Ad soyaddan avatar baş harfleri. */
const initialsOf = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

/* Tek satırlık "anahtar / değer" özet satırı. */
const SumRow = ({ label, value, className = "" }) => (
  <div className={`flex items-center justify-between gap-4 text-sm ${className}`}>
    <span className="text-slate-400">{label}</span>
    <span className="tabular-nums text-white">{value}</span>
  </div>
);

/* Kalem tablosu (hizmet / parça). */
const ItemsTable = ({ rows, emptyText }) => (
  <DataTable>
    <thead>
      <tr>
        <th>Açıklama</th>
        <th className="text-right">Adet</th>
        <th className="text-right">Birim</th>
        <th className="text-right">Toplam</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((it) => (
        <tr key={it.id}>
          <td>
            <div className="text-white">{it.name}</div>
            <div className="text-[11px] text-slate-400">
              {it.price_mode === "excl" ? "KDV hariç" : "KDV dahil"} · %{it.vat ?? DEFAULT_VAT}
            </div>
          </td>
          <td className="text-right tabular-nums">{it.qty}</td>
          <td className="text-right"><Money value={it.unit_price} /></td>
          <td className="text-right font-semibold"><Money value={lineAmounts(it).gross} /></td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr>
          <td colSpan={4} className="px-4 py-6 text-center text-slate-400">{emptyText}</td>
        </tr>
      )}
    </tbody>
  </DataTable>
);

export default function ServiceOrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [o, setO] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payOpen, setPayOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waData, setWaData] = useState(null);
  const [paying, setPaying] = useState(false);

  const load = () => api.get(`/service-orders/${id}`).then(r => setO(r.data))
    .catch(() => toast.error("Servis kaydı yüklenemedi"));
  useEffect(() => { load(); }, [id]);

  if (!o) return <div className="text-slate-300">Yükleniyor…</div>;
  const remaining = (o.grand_total || 0) - (o.paid_total || 0);
  const token = localStorage.getItem("token");

  const items = o.items || [];
  const serviceItems = items.filter((it) => it.kind !== "part");
  const partItems = items.filter((it) => it.kind === "part");
  const t = documentTotals({
    items,
    labor_total: o.labor_total,
    labor_price_mode: o.labor_price_mode || "incl",
    labor_vat: o.labor_vat ?? DEFAULT_VAT,
    discount: o.discount,
  });
  const timeline = [
    { key: "created", at: o.created_at, label: "Kayıt oluşturuldu" },
    ...(o.status_history || []).map((h, i) => ({
      key: `h-${i}`,
      at: h.at,
      label: STATUS_META[h.status]?.label || h.status,
      by: h.by,
      note: h.note,
    })),
  ];
  const approvalTone = o.approval_status === "approved" ? "success" : o.approval_status === "rejected" ? "danger" : "warning";
  const approvalLabel = o.approval_status === "approved" ? "Onayladı" : o.approval_status === "rejected" ? "Reddetti" : "Beklemede";

  const changeStatus = async (s) => {
    try {
      await api.post(`/service-orders/${id}/status`, { status: s });
      toast.success("Durum güncellendi");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Durum güncellenemedi"); }
  };

  const doPayment = async () => {
    if (paying) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast.error("Tutar giriniz");
    setPaying(true);
    try {
      await api.post("/payments", { customer_id: o.customer_id, service_order_id: o.id, amount: amt, method: payMethod });
      toast.success("Tahsilat kaydedildi");
      setPayOpen(false); setPayAmount(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Tahsilat kaydedilemedi"); }
    finally { setPaying(false); }
  };

  const saveSignature = async (dataUrl) => {
    try {
      await api.post(`/service-orders/${id}/signature`, { signature: dataUrl });
      toast.success(dataUrl ? "İmza kaydedildi" : "İmza temizlendi");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "İmza kaydedilemedi"); }
  };

  const openWhatsApp = async () => {
    try {
      const { data } = await api.post(`/service-orders/${id}/approval-link`);
      setWaData(data);
      setWaOpen(true);
    } catch (e) { toast.error(e.response?.data?.detail || "Onay bağlantısı oluşturulamadı"); }
  };

  const copyLink = () => {
    if (!waData?.approval_url) return;
    navigator.clipboard.writeText(waData.approval_url);
    toast.success("Bağlantı kopyalandı");
  };

  const del = async () => {
    if (!window.confirm(`${o.service_no} numaralı servis kaydını KALICI olarak silmek istediğinize emin misiniz? Tüm bağlı tahsilat ve cari hareketler de silinecek.`)) return;
    try {
      await api.delete(`/service-orders/${id}?hard=true`);
      toast.success("Servis kaydı silindi");
      nav("/service-orders");
    } catch { toast.error("Silme başarısız"); }
  };

  return (
    <div className="space-y-6 text-white">
      <HeroBanner
        eyebrow="Servis kaydı"
        title={`İş Emri #${o.service_no}`}
        slot="service_detail_hero"
        fallback={null}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-300 ring-1 ring-orange-500/30">
              {initialsOf(o.customer_name)}
            </span>
            <Link to={`/customers/${o.customer_id}`} className="font-semibold text-white hover:underline">{o.customer_name}</Link>
            {o.customer_phone && <span className="font-mono text-xs text-slate-400">{o.customer_phone}</span>}
          </span>
        }
        actions={
          <>
            <Link
              to={`/motorcycles/${o.motorcycle_id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
            >
              <Bike className="h-3.5 w-3.5 text-orange-400" />
              {o.brand} {o.model}
              <span className="font-mono text-slate-400">· {o.plate}</span>
            </Link>
            <span data-testid={`status-badge-${o.status}`}>
              <StatusBadge tone={STATUS_TONE[o.status] || "neutral"}>{STATUS_META[o.status]?.label || o.status}</StatusBadge>
            </span>
            {o.approval_status && (
              <StatusBadge tone={approvalTone}>Müşteri: {approvalLabel}</StatusBadge>
            )}
            <span className="self-center text-xs text-slate-400">{fmtDate(o.created_at)}</span>
          </>
        }
        children={
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
            <Select value={o.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-48 border-white/10 bg-white/5 text-white" data-testid="change-status"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_LIST.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" className={OUTLINE_BTN} onClick={() => openAuthedPdf(`/service-orders/${id}/pdf/kabul`)} data-testid="btn-pdf-kabul"><FileDown className="h-4 w-4 mr-1" />Kabul PDF</Button>
            <Button variant="outline" className={OUTLINE_BTN} onClick={() => openAuthedPdf(`/service-orders/${id}/pdf/teslim`)} data-testid="btn-pdf-teslim"><FileDown className="h-4 w-4 mr-1" />Teslim PDF</Button>
            <Button variant="outline" className={OUTLINE_BTN} onClick={openWhatsApp} data-testid="btn-whatsapp"><MessageCircle className="h-4 w-4 mr-1 text-emerald-400" />WhatsApp Onay</Button>
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="btn-collect">₺ Tahsilat Yap</Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-slate-900 text-white">
                <DialogHeader><DialogTitle>Tahsilat</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="text-sm text-slate-300">Kalan: <span className="font-bold text-rose-300"><Money value={remaining} /></span></div>
                  <div><Label className="text-slate-300">Tutar</Label><Input type="number" value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} className="border-white/10 bg-white/5 text-white" data-testid="pay-amount" /></div>
                  <div><Label className="text-slate-300">Ödeme Yöntemi</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Nakit</SelectItem>
                        <SelectItem value="card">Kredi Kartı</SelectItem>
                        <SelectItem value="transfer">Havale/EFT</SelectItem>
                        <SelectItem value="other">Diğer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" className={OUTLINE_BTN} onClick={()=>setPayOpen(false)}>İptal</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={doPayment} disabled={paying} data-testid="pay-submit">Kaydet</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {isAdmin && (
              <>
                <Button variant="outline" className={OUTLINE_BTN} onClick={()=>nav(`/service-orders/${id}/edit`)} data-testid="btn-edit-order"><Pencil className="h-4 w-4 mr-1" />Düzenle</Button>
                <Button variant="outline" onClick={del} className="border-rose-500/30 bg-transparent text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" data-testid="btn-delete-order"><Trash2 className="h-4 w-4 mr-1" />Sil</Button>
              </>
            )}
          </div>
        }
      />

      {/* WhatsApp dialog */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="max-w-lg border-white/10 bg-slate-900 text-white">
          <DialogHeader><DialogTitle>WhatsApp Onay Bağlantısı</DialogTitle></DialogHeader>
          {waData && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Onay Bağlantısı</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={waData.approval_url} readOnly className="font-mono text-xs border-white/10 bg-white/5 text-white" data-testid="approval-link" />
                  <Button variant="outline" className={OUTLINE_BTN} onClick={copyLink} data-testid="btn-copy-approval"><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-slate-300">WhatsApp Mesajı (önizleme)</Label>
                <div className="text-sm bg-white/5 border border-white/10 rounded-md p-3 whitespace-pre-wrap text-slate-200">{waData.message}</div>
              </div>
              <a href={waData.whatsapp_url} target="_blank" rel="noreferrer">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11" data-testid="btn-open-whatsapp">
                  <MessageCircle className="h-4 w-4 mr-2" />WhatsApp'ta Aç
                </Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Sol kolon (2/3): arıza, yapılan işlemler, parçalar */}
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Arıza / talep" subtitle="Müşteri şikayeti ve tespit edilen arıza">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Müşteri Şikayeti</h4>
                <p className="whitespace-pre-line text-sm text-slate-200">{o.complaint || "-"}</p>
              </div>
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Arıza Tespiti</h4>
                <p className="whitespace-pre-line text-sm text-slate-200">{o.diagnosis || "-"}</p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Yapılan işlemler"
            subtitle={`${serviceItems.length} hizmet kalemi`}
            action={isAdmin && (
              <Button variant="outline" className={OUTLINE_BTN} onClick={()=>nav(`/service-orders/${id}/edit`)}><Pencil className="h-4 w-4 mr-1" />Yapılan İşleri Düzenle</Button>
            )}
          >
            {o.operations && <p className="mb-4 whitespace-pre-line text-sm text-slate-200">{o.operations}</p>}
            <ItemsTable rows={serviceItems} emptyText="Hizmet kalemi eklenmedi" />
          </Panel>

          <Panel title="Kullanılan parçalar" subtitle={`${partItems.length} parça kalemi`}>
            <ItemsTable rows={partItems} emptyText="Parça eklenmedi" />
          </Panel>
        </div>

        {/* Sağ kolon (1/3): özet, teknik durum, notlar, süreç */}
        <div className="space-y-6">
          <Panel title="Özet">
            <div className="space-y-2.5">
              <SumRow label="Parça toplamı" value={<Money value={t.parts_total} />} />
              <SumRow label="Hizmet toplamı" value={<Money value={t.services_total} />} />
              <SumRow label="İşçilik" value={<Money value={t.labor_gross} />} />
              <div className="space-y-2.5 border-t border-white/10 pt-2.5">
                <SumRow label="Ara toplam (KDV dahil)" value={<Money value={t.subtotal} />} />
                {Number(t.discount) > 0 && <SumRow label="İskonto" value={<span className="text-rose-300">-<Money value={t.discount} /></span>} />}
              </div>
              <div className="space-y-2.5 border-t border-white/10 pt-2.5">
                <SumRow label="KDV toplamı" value={<Money value={t.vat_total} />} />
                <SumRow label="KDV hariç tutar" value={<Money value={t.net_total} />} />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="font-semibold text-white">Genel toplam</span>
                <span className="font-heading text-xl font-bold text-orange-400"><Money value={t.grand_total} /></span>
              </div>
              <div className="space-y-2.5 border-t border-white/10 pt-2.5">
                <SumRow label="Tahsil edilen" value={<span className="text-emerald-300"><Money value={o.paid_total} /></span>} />
                <SumRow label="Kalan" value={<span className={remaining > 0.01 ? "font-semibold text-rose-300" : "text-emerald-300"}><Money value={Math.max(0, remaining)} /></span>} />
              </div>
            </div>
          </Panel>

          <Panel title="Teknik durum" subtitle="Araç bilgileri ve arıza bölgeleri">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><Gauge className="h-3.5 w-3.5" />Kilometre</div>
                  <div className="mt-1 font-semibold text-white">{o.km != null ? `${o.km.toLocaleString("tr-TR")} km` : "-"}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><Fuel className="h-3.5 w-3.5" />Yakıt</div>
                  <div className="mt-1 font-semibold text-white">{o.fuel_level || "-"}</div>
                </div>
              </div>
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Aksesuarlar</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(o.accessories || []).map((a) => (
                    <span key={a} className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-200 ring-1 ring-white/10">{a}</span>
                  ))}
                  {(!o.accessories || o.accessories.length === 0) && <span className="text-xs text-slate-400">-</span>}
                </div>
              </div>
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Arızalı bölgeler</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(o.fault_zones || []).map((f) => (
                    <span key={f} className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs text-rose-300 ring-1 ring-rose-500/30">{f}</span>
                  ))}
                  {(!o.fault_zones || o.fault_zones.length === 0) && <span className="text-xs text-slate-400">-</span>}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Servis notları">
            <p className="whitespace-pre-line text-sm text-slate-200">{o.notes || "-"}</p>
          </Panel>

          <Panel title="Süreç" subtitle="Durum geçmişi">
            <ol className="relative ml-2 space-y-5 border-l border-white/10 pl-6">
              {timeline.map((step) => (
                <li key={step.key} className="relative">
                  <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-orange-500 ring-4 ring-slate-900" aria-hidden="true" />
                  <div className="text-sm font-medium text-white">{step.label}</div>
                  <div className="text-xs text-slate-400">
                    {step.at ? fmtDate(step.at) : "-"}{step.by ? ` · ${step.by}` : ""}
                  </div>
                  {step.note && <div className="mt-0.5 text-xs italic text-slate-400">"{step.note}"</div>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {/* Alt sekmeler: fotoğraf, imza, tahsilatlar */}
      <Tabs defaultValue="photos">
        <TabsList className="flex h-auto flex-wrap border border-white/10 bg-white/5">
          <TabsTrigger value="photos" data-testid="tab-photos">Fotoğraflar ({o.photos?.length || 0})</TabsTrigger>
          <TabsTrigger value="signature" data-testid="tab-signature">İmza</TabsTrigger>
          <TabsTrigger value="payments">Ödemeler ({o.payments?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="photos">
          <div className="emt-glass-dark rounded-2xl border border-white/10 p-5">
            <PhotoUploader serviceOrderId={id} photos={o.photos || []} onChange={(photos)=>setO({...o, photos})} />
          </div>
        </TabsContent>

        <TabsContent value="signature">
          <div className="emt-glass-dark rounded-2xl border border-white/10 p-5">
            <SignaturePad initial={o.customer_signature || ""} onSave={saveSignature} />
            {o.signed_at && o.customer_signature && <div className="mt-3 text-xs text-slate-400">İmzalandı: {fmtDate(o.signed_at)}</div>}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <DataTable>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tahsilat No</th>
                <th>Yöntem</th>
                <th className="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {(o.payments || []).map((p) => (
                <tr key={p.id}>
                  <td className="text-slate-300">{fmtDateShort(p.created_at)}</td>
                  <td className="font-mono text-xs text-slate-300">{p.payment_no}</td>
                  <td className="text-slate-300">{p.method}</td>
                  <td className="text-right font-semibold text-emerald-300"><Money value={p.amount} /></td>
                </tr>
              ))}
              {(!o.payments || o.payments.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Henüz tahsilat yok</td></tr>
              )}
            </tbody>
          </DataTable>
        </TabsContent>
      </Tabs>
    </div>
  );
}

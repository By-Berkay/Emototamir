import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { openAuthedPdf, fmtMoney, fmtDate, fmtDateShort, STATUS_META, STATUS_LIST } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { Wrench as PvIcon } from "lucide-react";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import SignaturePad from "../components/SignaturePad";
import PhotoUploader from "../components/PhotoUploader";
import { documentTotals, lineAmounts, DEFAULT_VAT } from "../lib/pricing";
import DocumentTotals from "../components/DocumentTotals";
import { toast } from "sonner";
import { FileDown, MessageCircle, Pencil, Trash2, Copy } from "lucide-react";

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

  if (!o) return <div>Yükleniyor…</div>;
  const remaining = (o.grand_total || 0) - (o.paid_total || 0);
  const token = localStorage.getItem("token");

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
    <div className="space-y-6">
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono">{o.service_no}</span>
            <StatusBadge status={o.status} />
            {o.approval_status && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${o.approval_status==="approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : o.approval_status==="rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                Müşteri: {o.approval_status === "approved" ? "Onayladı" : o.approval_status === "rejected" ? "Reddetti" : "Beklemede"}
              </span>
            )}
          </span>
        }
        description={fmtDate(o.created_at)}
        actions={
        <div className="flex gap-2 flex-wrap">
          <Select value={o.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-48" data-testid="change-status"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_LIST.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => openAuthedPdf(`/service-orders/${id}/pdf/kabul`)} variant="outline" data-testid="btn-pdf-kabul"><FileDown className="h-4 w-4 mr-1" />Kabul PDF</Button>
          <Button onClick={() => openAuthedPdf(`/service-orders/${id}/pdf/teslim`)} variant="outline" data-testid="btn-pdf-teslim"><FileDown className="h-4 w-4 mr-1" />Teslim PDF</Button>
          <Button variant="outline" onClick={openWhatsApp} data-testid="btn-whatsapp"><MessageCircle className="h-4 w-4 mr-1 text-emerald-600" />WhatsApp Onay</Button>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-collect">₺ Tahsilat Yap</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tahsilat</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="text-sm text-slate-600">Kalan: <span className="font-bold text-red-600">{fmtMoney(remaining)}</span></div>
                <div><Label>Tutar</Label><Input type="number" value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} data-testid="pay-amount" /></div>
                <div><Label>Ödeme Yöntemi</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Button variant="outline" onClick={()=>setPayOpen(false)}>İptal</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={doPayment} disabled={paying} data-testid="pay-submit">Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={()=>nav(`/service-orders/${id}/edit`)} data-testid="btn-edit-order"><Pencil className="h-4 w-4 mr-1" />Düzenle</Button>
              <Button variant="outline" onClick={del} className="text-red-600 hover:text-red-700 border-red-200" data-testid="btn-delete-order"><Trash2 className="h-4 w-4 mr-1" />Sil</Button>
            </>
          )}
        </div>
        }
      />

      {/* WhatsApp dialog */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>WhatsApp Onay Bağlantısı</DialogTitle></DialogHeader>
          {waData && (
            <div className="space-y-4">
              <div>
                <Label>Onay Bağlantısı</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={waData.approval_url} readOnly className="font-mono text-xs" data-testid="approval-link" />
                  <Button variant="outline" onClick={copyLink} data-testid="btn-copy-approval"><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <Label>WhatsApp Mesajı (önizleme)</Label>
                <div className="text-sm bg-slate-50 border rounded-md p-3 whitespace-pre-wrap">{waData.message}</div>
              </div>
              <a href={waData.whatsapp_url} target="_blank" rel="noreferrer">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-11" data-testid="btn-open-whatsapp">
                  <MessageCircle className="h-4 w-4 mr-2" />WhatsApp'ta Aç
                </Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200"><CardContent className="p-5">
          <div className="text-xs uppercase text-slate-500">Müşteri</div>
          <Link to={`/customers/${o.customer_id}`} className="font-semibold hover:underline">{o.customer_name}</Link>
          <div className="text-sm text-slate-600 font-mono">{o.customer_phone}</div>
        </CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5">
          <div className="text-xs uppercase text-slate-500">Motosiklet</div>
          <Link to={`/motorcycles/${o.motorcycle_id}`} className="font-semibold hover:underline">{o.brand} {o.model}</Link>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{o.plate}</span>
            <span>{o.km?.toLocaleString("tr-TR")} km</span>
          </div>
        </CardContent></Card>
        <StatCard
          label="Ödeme Durumu"
          value={fmtMoney(o.grand_total)}
          hint={<>Ödenen: {fmtMoney(o.paid_total)} · Kalan: <span className={remaining>0.01?"text-red-600 font-bold":"text-emerald-600"}>{fmtMoney(remaining)}</span></>}
          tone={remaining>0.01?"red":"emerald"}
        />
      </div>

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="details">Genel</TabsTrigger>
          <TabsTrigger value="items">Yapılan İşler ({o.items?.length || 0})</TabsTrigger>
          <TabsTrigger value="photos" data-testid="tab-photos">Fotoğraflar ({o.photos?.length || 0})</TabsTrigger>
          <TabsTrigger value="signature" data-testid="tab-signature">İmza</TabsTrigger>
          <TabsTrigger value="payments">Ödemeler ({o.payments?.length || 0})</TabsTrigger>
          <TabsTrigger value="history">Durum Geçmişi</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card className="border-slate-200"><CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Müşteri Şikayeti</h4><p className="text-sm">{o.complaint || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Arıza Tespiti</h4><p className="text-sm">{o.diagnosis || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Yapılan İşlemler</h4><p className="text-sm">{o.operations || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Notlar</h4><p className="text-sm">{o.notes || "-"}</p></div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Yakıt / Aksesuarlar</h4>
              <p className="text-sm">Yakıt: {o.fuel_level}</p>
              <div className="flex flex-wrap gap-1 mt-1">{(o.accessories||[]).map(a=><span key={a} className="text-xs bg-slate-100 px-2 py-0.5 rounded">{a}</span>)}</div>
            </div>
            <div><h4 className="font-semibold mb-1 text-sm uppercase text-slate-500">Arızalı Bölgeler</h4>
              <div className="flex flex-wrap gap-1">{(o.fault_zones||[]).map(f=><span key={f} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">{f}</span>)}</div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="items">
          <Card className="border-slate-200"><CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Tür</th><th className="text-left px-4 py-2">Ad</th><th className="text-right px-4 py-2">Adet</th><th className="text-right px-4 py-2">Birim</th><th className="text-right px-4 py-2">Toplam</th></tr></thead>
              <tbody>
                {o.items.map(it=>(
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded ${it.kind==="part"?"bg-blue-50 text-blue-700":"bg-emerald-50 text-emerald-700"}`}>{it.kind==="part"?"Parça":"Hizmet"}</span></td>
                    <td className="px-4 py-2">{it.name}</td>
                    <td className="px-4 py-2 text-right">{it.qty}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(it.unit_price)}<div className="text-[11px] text-slate-400">{it.price_mode === "excl" ? "KDV hariç" : "KDV dahil"} · %{it.vat ?? DEFAULT_VAT}</div></td>
                    <td className="px-4 py-2 text-right font-medium">{fmtMoney(lineAmounts(it).gross)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-slate-50"><td colSpan={5} className="px-4 py-3">
                  <div className="ml-auto max-w-sm"><DocumentTotals paid={o.paid_total} t={documentTotals({ items: o.items, labor_total: o.labor_total, labor_price_mode: o.labor_price_mode || "incl", labor_vat: o.labor_vat ?? DEFAULT_VAT, discount: o.discount })} /></div>
                </td></tr>
              </tbody>
            </table>
            </div>
            {isAdmin && (
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <Button variant="outline" onClick={()=>nav(`/service-orders/${id}/edit`)}><Pencil className="h-4 w-4 mr-1" />Yapılan İşleri Düzenle</Button>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card className="border-slate-200"><CardContent className="p-5">
            <PhotoUploader serviceOrderId={id} photos={o.photos || []} onChange={(photos)=>setO({...o, photos})} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="signature">
          <Card className="border-slate-200"><CardContent className="p-5">
            <SignaturePad initial={o.customer_signature || ""} onSave={saveSignature} />
            {o.signed_at && o.customer_signature && <div className="text-xs text-slate-500 mt-3">İmzalandı: {fmtDate(o.signed_at)}</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-slate-200"><CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Tarih</th><th className="text-left px-4 py-2">Tahsilat No</th><th className="text-left px-4 py-2">Yöntem</th><th className="text-right px-4 py-2">Tutar</th></tr></thead>
              <tbody>
                {(o.payments || []).map(p=>(
                  <tr key={p.id} className="border-t"><td className="px-4 py-2">{fmtDateShort(p.created_at)}</td><td className="px-4 py-2 font-mono text-xs">{p.payment_no}</td><td className="px-4 py-2">{p.method}</td><td className="px-4 py-2 text-right font-semibold text-emerald-600">{fmtMoney(p.amount)}</td></tr>
                ))}
                {(!o.payments || o.payments.length === 0) && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Henüz tahsilat yok</td></tr>}
              </tbody>
            </table>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-slate-200"><CardContent className="p-5">
            <ul className="space-y-3">
              {(o.status_history||[]).map((h, i) => (
                <li key={i} className="flex items-center gap-3 flex-wrap">
                  <span className="h-2 w-2 bg-brand-500 rounded-full"></span>
                  <StatusBadge status={h.status} />
                  <span className="text-sm text-slate-600">{fmtDate(h.at)}</span>
                  <span className="text-xs text-slate-500">— {h.by}</span>
                  {h.note && <span className="text-xs text-slate-500 italic">"{h.note}"</span>}
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

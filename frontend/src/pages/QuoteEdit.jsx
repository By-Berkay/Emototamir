import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { FileText as PvIcon } from "lucide-react";
import { documentTotals, lineAmounts, DEFAULT_VAT } from "../lib/pricing";
import { PriceModeSelect, VatSelect } from "../components/PriceControls";
import DocumentTotals from "../components/DocumentTotals";
import { Save, Trash2, ArrowLeft, Copy, ExternalLink, FileText } from "lucide-react";

const STATUS_LABEL = {
  draft: "Taslak", sent: "Gönderildi", approved: "Onaylandı",
  rejected: "Reddedildi", expired: "Süresi Doldu", converted: "Dönüştürüldü",
};

export default function QuoteEdit() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [motos, setMotos] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [motoId, setMotoId] = useState("");
  const [items, setItems] = useState([]);
  const [labor, setLabor] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [laborMode, setLaborMode] = useState("incl");
  const [laborVat, setLaborVat] = useState(DEFAULT_VAT);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [quote, setQuote] = useState(null);
  const [partKey, setPartKey] = useState(0);
  const [svcKey, setSvcKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers").then(r=>setCustomers(r.data));
    api.get("/products").then(r=>setProducts(r.data));
    api.get("/service-catalog").then(r=>setServices(r.data));
    if (id) api.get(`/quotes/${id}`).then(r => {
      const q = r.data; setQuote(q);
      setCustomerId(q.customer_id); setMotoId(q.motorcycle_id);
      setItems(q.items || []); setLabor(q.labor_total || 0); setDiscount(q.discount || 0);
      setLaborMode(q.labor_price_mode || "incl"); setLaborVat(q.labor_vat ?? DEFAULT_VAT);
      setNotes(q.notes || ""); setValidUntil((q.valid_until || "").slice(0,10));
    }).catch(() => toast.error("Teklif yüklenemedi"));
  }, [id]);

  useEffect(() => {
    if (!customerId) return setMotos([]);
    api.get(`/motorcycles?customer_id=${customerId}`).then(r => {
      setMotos(r.data);
      if (isNew) setMotoId("");
    });
  }, [customerId, isNew]);

  const addPart = (p) => setItems([...items, { id: crypto.randomUUID(), kind:"part", ref_id: p.id, name: p.name, qty:1, unit_price: p.sale_price, vat: p.vat ?? DEFAULT_VAT, price_mode: p.price_mode || "incl" }]);
  const addService = (s) => setItems([...items, { id: crypto.randomUUID(), kind:"service", ref_id: s.id, name: s.name, qty:1, unit_price: s.price, vat: s.vat ?? DEFAULT_VAT, price_mode: s.price_mode || "incl" }]);
  const updateItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));

  // Kalem ve işçilik fiyatları KDV dahil / hariç seçimine göre hesaplanır (pricing.js; backend ile aynı kural).
  const totals = useMemo(
    () => documentTotals({ items, labor_total: labor, labor_price_mode: laborMode, labor_vat: laborVat, discount }),
    [items, labor, laborMode, laborVat, discount]
  );


  const save = async () => {
    if (!customerId || !motoId) return toast.error("Müşteri ve motosiklet seçin");
    if (items.length === 0) return toast.error("En az bir parça veya hizmet ekleyin");
    if (saving) return;
    const payload = {
      customer_id: customerId, motorcycle_id: motoId, items,
      labor_total: Number(labor||0), labor_price_mode: laborMode, labor_vat: Number(laborVat),
      discount: Number(discount||0),
      notes, valid_until: validUntil ? new Date(validUntil + "T23:59:59+03:00").toISOString() : null,
    };
    setSaving(true);
    try {
      const r = isNew
        ? await api.post("/quotes", payload)
        : await api.put(`/quotes/${id}`, payload);
      toast.success(isNew ? "Teklif oluşturuldu" : "Kaydedildi");
      nav(`/quotes/${r.data.id}`);
      if (!isNew) setQuote(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Kaydedilemedi"); }
    finally { setSaving(false); }
  };

  const shareUrl = quote ? `${window.location.origin}/q/${quote.share_token}` : "";

  const editable = !quote || ["draft", "sent", "rejected"].includes(quote.status);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={()=>nav("/quotes")} data-testid="back-to-quotes"><ArrowLeft className="h-4 w-4 mr-1" />Geri</Button>
      </div>
      <PageHeader visual={<PageVisual icon={PvIcon} />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2"><FileText className="h-6 w-6 text-brand-500" />{isNew ? "Yeni Teklif" : quote?.quote_no}</span>
            {quote && <span className="text-xs uppercase font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">{STATUS_LABEL[quote.status] || quote.status}</span>}
          </span>
        }
      />

      {quote && (
        <Card className="border-brand-200 bg-brand-50">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase text-slate-600">Müşteri Paylaşım Linki</div>
              <div className="font-mono text-xs text-slate-800 break-all">{shareUrl}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={()=>{navigator.clipboard.writeText(shareUrl); toast.success("Kopyalandı");}} data-testid="copy-share"><Copy className="h-3.5 w-3.5 mr-1" />Kopyala</Button>
              <a href={shareUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />Aç</Button></a>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 space-y-3">
          <Label>Müşteri</Label>
          <Select value={customerId} onValueChange={setCustomerId} disabled={!editable}>
            <SelectTrigger data-testid="q-customer"><SelectValue placeholder="Müşteri seç" /></SelectTrigger>
            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.phone}</SelectItem>)}</SelectContent>
          </Select>
          <Label>Motosiklet</Label>
          <Select value={motoId} onValueChange={setMotoId} disabled={!editable || !customerId}>
            <SelectTrigger data-testid="q-moto"><SelectValue placeholder="Motosiklet seç" /></SelectTrigger>
            <SelectContent>{motos.map(m => <SelectItem key={m.id} value={m.id}>{m.brand} {m.model} · {m.plate}</SelectItem>)}</SelectContent>
          </Select>
          <Label>Geçerlilik Tarihi</Label>
          <Input type="date" value={validUntil} onChange={(e)=>setValidUntil(e.target.value)} disabled={!editable} data-testid="q-valid" />
        </CardContent></Card>

        <Card className="md:col-span-2"><CardContent className="p-5 space-y-3">
          <Label>Açıklama / Notlar</Label>
          <Textarea rows={4} value={notes} onChange={(e)=>setNotes(e.target.value)} disabled={!editable} placeholder="Örn: Rutin bakım + zincir seti. Fiyata montaj işçiliği dahildir." data-testid="q-notes" />
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Kalemler</CardTitle>
          {editable && (
            <div className="flex gap-2">
              <Select key={`p-${partKey}`} value="" onValueChange={(v)=>{const p=products.find(x=>x.id===v); if(p){ addPart(p); setPartKey(k=>k+1); }}}>
                <SelectTrigger className="w-48" data-testid="q-add-part"><SelectValue placeholder="Parça ekle" /></SelectTrigger>
                <SelectContent>{products.map(p=><SelectItem key={p.id} value={p.id}>{p.name} · {fmtMoney(p.sale_price)}</SelectItem>)}</SelectContent>
              </Select>
              <Select key={`s-${svcKey}`} value="" onValueChange={(v)=>{const s=services.find(x=>x.id===v); if(s){ addService(s); setSvcKey(k=>k+1); }}}>
                <SelectTrigger className="w-48" data-testid="q-add-service"><SelectValue placeholder="Hizmet ekle" /></SelectTrigger>
                <SelectContent>{services.map(s=><SelectItem key={s.id} value={s.id}>{s.name} · {fmtMoney(s.price)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Tür</th>
                <th className="text-left px-3 py-2">Ad</th>
                <th className="text-right px-3 py-2 w-20">Adet</th>
                <th className="text-right px-3 py-2 w-32">Birim Fiyat</th>
                <th className="text-right px-3 py-2 w-40">Fiyat tipi</th><th className="text-right px-3 py-2 w-24">KDV%</th>
                <th className="text-right px-3 py-2 w-32">Tutar</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2 text-xs">{it.kind === "part" ? "Parça" : "Hizmet"}</td>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2"><Input type="number" step="any" value={it.qty} min={0} onChange={(e)=>updateItem(i,{qty:Number(e.target.value)})} disabled={!editable} className="text-right" /></td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={it.unit_price} onChange={(e)=>updateItem(i,{unit_price:Number(e.target.value)})} disabled={!editable} className="text-right" /></td>
                  <td className="px-3 py-2"><PriceModeSelect value={it.price_mode} onChange={(v)=>updateItem(i,{price_mode:v})} disabled={!editable} /></td>
                  <td className="px-3 py-2"><VatSelect value={it.vat} onChange={(v)=>updateItem(i,{vat:v})} disabled={!editable} /></td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(lineAmounts(it).gross)}</td>
                  <td className="px-3 py-2 text-right">{editable && <button onClick={()=>removeItem(i)} className="text-red-500"><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-slate-500">Henüz kalem eklenmedi.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-5 grid grid-cols-2 gap-3">
          <div><Label>İşçilik (TL)</Label><Input type="number" value={labor} onChange={(e)=>setLabor(Number(e.target.value))} disabled={!editable} data-testid="q-labor" /></div>
          <div><Label>İşçilik fiyat tipi</Label><PriceModeSelect value={laborMode} onChange={setLaborMode} disabled={!editable} /></div>
          <div><Label>İşçilik KDV</Label><VatSelect value={laborVat} onChange={setLaborVat} disabled={!editable} /></div>
          <div><Label>İskonto (TL)</Label><Input type="number" value={discount} onChange={(e)=>setDiscount(Number(e.target.value))} disabled={!editable} data-testid="q-discount" /></div>
        </CardContent></Card>
        <Card><CardContent className="p-5"><DocumentTotals t={totals} paid={quote?.paid_total} /></CardContent></Card>
      </div>

      <div className="flex justify-end gap-2">
        {quote && quote.approval && (
          <div className="mr-auto text-xs text-slate-500">
            {quote.approval.action === "approve" ? "✓ Onaylayan" : "✗ Reddeden"}: <b>{quote.approval.name}</b> · {new Date(quote.approval.at).toLocaleString("tr-TR")}
            {quote.approval.note && <div className="italic">"{quote.approval.note}"</div>}
          </div>
        )}
        <Button onClick={save} className="bg-brand-500 hover:bg-brand-600" disabled={!editable || saving} data-testid="q-save"><Save className="h-4 w-4 mr-1" />{isNew ? "Oluştur" : "Kaydet"}</Button>
      </div>
    </div>
  );
}

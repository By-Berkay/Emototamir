import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { CheckCircle2, XCircle, Wrench, MapPin, Phone } from "lucide-react";
import { lineAmounts } from "../lib/pricing";

const STATUS_TR = { draft: "taslak", sent: "gönderilmiş", approved: "onaylanmış", rejected: "reddedilmiş", converted: "siparişe dönüştürülmüş", expired: "süresi dolmuş" };
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

function fmt(v) { return new Intl.NumberFormat("tr-TR",{ style:"currency", currency:"TRY" }).format(v || 0); }

export default function QuotePublic() {
  const { token } = useParams();
  const [q, setQ] = useState(null);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/public/quotes/${token}`)
      .then(r => setQ(r.data))
      .catch(e => setErr(e.response?.data?.detail || "Teklif bulunamadı"));
  }, [token]);

  const decide = async (action) => {
    if (!name.trim()) return toast.error("Lütfen ad-soyadınızı girin");
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/api/public/quotes/${token}/approve`, { action, customer_name: name.trim(), note });
      setDone({ action, status: r.data.status });
    } catch (e) {
      toast.error(e.response?.data?.detail || "İşlem başarısız");
      // Teklif bu arada süresi dolmuş/yanıtlanmış olabilir; güncel durumu yeniden al
      axios.get(`${API}/api/public/quotes/${token}`).then(r => setQ(r.data)).catch(() => {});
    }
    finally { setSubmitting(false); }
  };

  if (err) return (
    <div className="emt-aurora min-h-screen flex items-center justify-center p-6">
      <Card className="glass-card max-w-md w-full"><CardContent className="p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h1 className="font-heading text-2xl font-bold mb-2">Teklif Bulunamadı</h1>
        <p className="text-slate-500">{err}</p>
      </CardContent></Card>
    </div>
  );
  if (!q) return <div className="p-10 text-center text-slate-500">Yükleniyor…</div>;

  const t = q.tenant || {};
  const decided = ["approved", "rejected", "converted", "expired"].includes(q.status);
  const expiredByDate = !!q.valid_until && new Date(q.valid_until) < new Date() && !decided;
  const readonly = decided || expiredByDate || done;
  const brandColor = t.primary_color || "#F97316";

  return (
    <div className="emt-aurora min-h-screen py-8 px-4" data-testid="quote-public">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-9 w-9 rounded-md flex items-center justify-center text-white" style={{backgroundColor: brandColor}}><Wrench className="h-5 w-5" /></div>
                  <div>
                    <div className="font-heading font-bold text-xl text-slate-900">{t.name || "Servis"}</div>
                    <div className="text-xs text-slate-500">Fiyat Teklifi</div>
                  </div>
                </div>
                {t.address && <div className="text-xs text-slate-500 flex items-center gap-1 mt-2"><MapPin className="h-3 w-3" />{t.address}</div>}
                {t.phone && <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{t.phone}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase text-slate-500">Teklif No</div>
                <div className="font-mono text-lg font-bold">{q.quote_no}</div>
                <div className="text-xs text-slate-500 mt-1">{new Date(q.created_at).toLocaleDateString("tr-TR")}</div>
                {q.valid_until && <div className="text-xs text-amber-600 mt-1">Geçerlilik: {new Date(q.valid_until).toLocaleDateString("tr-TR")}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer + Moto */}
        <Card className="glass-card">
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase text-slate-500 mb-1">Sayın Müşterimiz</div>
              <div className="text-lg font-semibold">{q.customer.first_name} {q.customer.last_name}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500 mb-1">Motosiklet</div>
              <div className="text-lg font-semibold">{q.motorcycle.brand} {q.motorcycle.model} {q.motorcycle.year && `(${q.motorcycle.year})`}</div>
              <div className="font-mono text-sm rounded bg-slate-100 px-2 py-0.5 inline-block mt-1 dark:bg-white/10">{q.motorcycle.plate}</div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="glass-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">Kalem</th>
                    <th className="text-right px-4 py-2">Adet</th>
                    <th className="text-right px-4 py-2 hidden sm:table-cell">Birim</th>
                    <th className="text-right px-4 py-2 hidden sm:table-cell">KDV%</th>
                    <th className="text-right px-4 py-2">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.items || []).map(it => (
                    <tr key={it.id} className="border-t">
                      <td className="px-4 py-2">{it.name} <span className="text-xs text-slate-400">({it.kind==="part"?"Parça":"Hizmet"})</span></td>
                      <td className="px-4 py-2 text-right">{it.qty}</td>
                      <td className="px-4 py-2 text-right hidden sm:table-cell">{fmt(it.unit_price)}</td>
                      <td className="px-4 py-2 text-right hidden sm:table-cell">{it.vat}%</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(lineAmounts(it).gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span>Ara Toplam</span><span>{fmt(q.subtotal)}</span></div>
              <div className="flex justify-between"><span>KDV</span><span>{fmt(q.vat_total)}</span></div>
              <div className="flex justify-between"><span>İşçilik</span><span>{fmt(q.labor_total)}</span></div>
              {q.discount > 0 && <div className="flex justify-between text-red-600"><span>İskonto</span><span>-{fmt(q.discount)}</span></div>}
              <div className="border-t pt-2 flex justify-between font-heading text-2xl font-bold" style={{color: brandColor}}><span>Toplam</span><span>{fmt(q.grand_total)}</span></div>
            </div>
          </CardContent>
        </Card>

        {q.notes && (
          <Card className="glass-card"><CardContent className="p-6">
            <div className="text-xs uppercase text-slate-500 mb-1">Servis Notları</div>
            <div className="whitespace-pre-wrap text-sm">{q.notes}</div>
          </CardContent></Card>
        )}

        {/* Approval action */}
        {done ? (
          <Card className={done.status === "approved" ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}>
            <CardContent className="p-6 text-center">
              {done.status === "approved"
                ? <><CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-2" />
                    <div className="font-heading text-xl font-bold text-emerald-800">Teklif Onaylandı</div>
                    <div className="text-sm text-slate-600 mt-1">Teşekkürler {name}. Servisimiz sizinle en kısa sürede iletişime geçecektir.</div></>
                : <><XCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
                    <div className="font-heading text-xl font-bold text-red-800">Teklif Reddedildi</div>
                    <div className="text-sm text-slate-600 mt-1">Bildiriminiz alındı. İhtiyacınız halinde tekrar iletişime geçebiliriz.</div></>}
            </CardContent>
          </Card>
        ) : readonly ? (
          <Card className="glass-card"><CardContent className="p-6 text-center text-slate-500">
            {expiredByDate && !decided
              ? <>Bu teklifin geçerlilik süresi dolmuş — üzerinde işlem yapılamaz.</>
              : <>Bu teklif <b>{STATUS_TR[q.status] || q.status}</b> durumunda — üzerinde işlem yapılamaz.</>}
          </CardContent></Card>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-6 space-y-3">
              <div className="text-sm text-slate-700">Teklifi onaylamak veya reddetmek için lütfen ad-soyadınızı yazın.</div>
              <div>
                <Label>Ad Soyad *</Label>
                <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder={`${q.customer.first_name || ""} ${q.customer.last_name || ""}`} data-testid="approve-name" />
              </div>
              <div>
                <Label>Not (opsiyonel)</Label>
                <Textarea rows={2} value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Örn: Salı günü uğrayacağım." data-testid="approve-note" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting} onClick={()=>decide("approve")} data-testid="approve-yes">
                  <CheckCircle2 className="h-4 w-4 mr-1" />Onaylıyorum
                </Button>
                <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" disabled={submitting} onClick={()=>decide("reject")} data-testid="approve-no">
                  <XCircle className="h-4 w-4 mr-1" />Reddediyorum
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-slate-400 py-4">E-Moto Tamir · Servis Yönetim Sistemi</div>
      </div>
    </div>
  );
}

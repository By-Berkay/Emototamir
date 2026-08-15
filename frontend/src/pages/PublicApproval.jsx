import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API, fmtMoney } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Wrench, Check, X, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function PublicApproval() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/approval/${token}`).then(r => setData(r.data)).catch(() => setData(false)).finally(()=>setLoading(false));
  }, [token]);

  const decide = async (approve) => {
    setSubmitting(true);
    try {
      const { data: r } = await axios.post(`${API}/public/approval/${token}`, { approve, note });
      toast.success(approve ? "Teklif onaylandı" : "Teklif reddedildi");
      setData({ ...data, approval_status: r.approval_status });
    } catch (e) { toast.error("İşlem başarısız"); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Yükleniyor…</div>;
  if (!data) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h1 className="font-heading text-xl font-bold">Geçersiz Bağlantı</h1>
        <p className="text-sm text-slate-500 mt-2">Bu onay bağlantısı geçersiz ya da süresi dolmuş olabilir.</p>
      </CardContent></Card>
    </div>
  );

  const decided = data.approval_status === "approved" || data.approval_status === "rejected";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 bg-orange-500 rounded-md flex items-center justify-center"><Wrench className="h-5 w-5 text-white" /></div>
          <div>
            <div className="font-heading font-bold text-slate-900">MOTO SERVİS</div>
            <div className="text-xs text-slate-500">Müşteri Onay Formu</div>
          </div>
        </div>

        <Card className="border-slate-200">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Servis</div>
              <div className="font-mono text-lg font-bold">{data.service_no}</div>
              <div className="text-slate-700">{data.customer_name}</div>
              <div className="text-sm text-slate-500 mt-1">{data.brand} {data.model} · <span className="font-mono">{data.plate}</span></div>
            </div>

            {data.complaint && <div><div className="text-xs uppercase text-slate-500 mb-1">Müşteri Şikayeti</div><p className="text-sm">{data.complaint}</p></div>}
            {data.diagnosis && <div><div className="text-xs uppercase text-slate-500 mb-1">Arıza Tespiti</div><p className="text-sm">{data.diagnosis}</p></div>}

            {data.items && data.items.length > 0 && (
              <div>
                <div className="text-xs uppercase text-slate-500 mb-2">Yapılacak İşlemler & Parçalar</div>
                <table className="min-w-full text-sm border-t border-b border-slate-200">
                  <thead className="text-xs text-slate-500"><tr>
                    <th className="text-left py-1.5">Ad</th><th className="text-right py-1.5">Adet</th>
                    <th className="text-right py-1.5">Birim</th><th className="text-right py-1.5">Toplam</th>
                  </tr></thead>
                  <tbody>
                    {data.items.map((it, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5">{it.name} <span className="text-xs text-slate-400">({it.kind === "part" ? "Parça" : "Hizmet"})</span></td>
                        <td className="text-right py-1.5">{it.qty}</td>
                        <td className="text-right py-1.5">{fmtMoney(it.unit_price)}</td>
                        <td className="text-right py-1.5 font-medium">{fmtMoney(it.qty * it.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-slate-50 rounded-md p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>İşçilik</span><span>{fmtMoney(data.labor_total)}</span></div>
              <div className="flex justify-between"><span>İskonto</span><span className="text-red-600">-{fmtMoney(data.discount)}</span></div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-slate-200 mt-2">
                <span>Genel Toplam</span><span className="text-orange-600">{fmtMoney(data.grand_total)}</span>
              </div>
            </div>

            {decided ? (
              <div className={`rounded-md p-4 text-center ${data.approval_status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {data.approval_status === "approved" ? <CheckCircle2 className="h-10 w-10 mx-auto mb-2" /> : <XCircle className="h-10 w-10 mx-auto mb-2" />}
                <div className="font-heading text-lg font-bold">{data.approval_status === "approved" ? "Onayladınız" : "Reddettiniz"}</div>
                <div className="text-sm mt-1">Cevabınız için teşekkür ederiz.</div>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs uppercase text-slate-500 mb-1">Not (opsiyonel)</div>
                  <Textarea rows={2} value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Servise iletmek istediğiniz not…" data-testid="approval-note" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button disabled={submitting} onClick={()=>decide(false)} variant="outline" className="h-12 border-red-300 text-red-700 hover:bg-red-50" data-testid="btn-reject">
                    <X className="h-4 w-4 mr-1" />Reddet
                  </Button>
                  <Button disabled={submitting} onClick={()=>decide(true)} className="h-12 bg-emerald-600 hover:bg-emerald-700" data-testid="btn-approve">
                    <Check className="h-4 w-4 mr-1" />Onayla
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-400 mt-6">Bu sayfa Moto Servis tarafından gönderilen resmi bir onay formudur.</div>
      </div>
    </div>
  );
}

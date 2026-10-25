import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Camera, Download, FileText, MessageCircle, Pencil, ShieldCheck, Trash2, Wrench } from "lucide-react";
import api, { API, fmtDate } from "../lib/api";
import { toWhatsAppNumber } from "../lib/phone";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import {
  InspectionPhotoThumb,
  StatusBadgeInspection,
  groupItems,
} from "../components/InspectionChecklist";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";

// Rapor tarihi YYYY-MM-DD olarak gelir; saat dilimi kaymasını önlemek için doğrudan biçimlenir.
const formatReportDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "-");
const dash = (v) => (v === null || v === undefined || v === "" ? "-" : v);

function Detail({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={cn("mt-1 truncate text-sm text-slate-900", mono && "font-mono tabular-nums")}>{dash(value)}</dd>
    </div>
  );
}

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/inspections/${id}`)
      .then((r) => {
        if (active) setDoc(r.data);
      })
      .catch(() => {
        if (active) setDoc(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const groups = useMemo(() => groupItems(doc?.items || []), [doc]);
  const counts = useMemo(() => {
    const items = doc?.items || [];
    return {
      good: items.filter((i) => i.status === "good").length,
      medium: items.filter((i) => i.status === "medium").length,
      service: items.filter((i) => i.status === "service").length,
      photos: (doc?.photos || []).length,
    };
  }, [doc]);

  // Yetkili PDF çekimi: API istemcisi Authorization başlığını ekler.
  const fetchPdfUrl = async () => {
    const res = await api.get(`/inspections/${id}/pdf`, { responseType: "blob" });
    return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  };

  const downloadUrl = (url, filename) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const viewPdf = async () => {
    // Pencere, istek sürerken kullanıcı hareketi içinde açılır; açılır pencere engellenmez.
    const win = window.open("about:blank", "_blank");
    setBusy("pdf");
    try {
      const url = await fetchPdfUrl();
      if (win) {
        win.location.href = url;
      } else {
        downloadUrl(url, `${doc.report_no}.pdf`);
        toast.warning("Açılır pencere engellendi; PDF indirildi.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch {
      win?.close();
      toast.error("PDF açılamadı");
    } finally {
      setBusy("");
    }
  };

  const downloadPdf = async () => {
    setBusy("download");
    try {
      const url = await fetchPdfUrl();
      downloadUrl(url, `${doc.report_no}.pdf`);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("PDF indirilemedi");
    } finally {
      setBusy("");
    }
  };

  const sendWhatsApp = async () => {
    const win = window.open("about:blank", "_blank");
    setBusy("wa");
    try {
      const { data } = await api.post(`/inspections/${id}/share`);
      // Paylaşım yolu göreli gelir (/api/public/...); API tabanından tam adres oluşturulur.
      const pdfUrl = `${API.replace(/\/api\/?$/, "")}${data.pdf_url}`;
      const lines = [
        doc.owner_name ? `Merhaba ${doc.owner_name},` : "Merhaba,",
        `${doc.plate} plakalı motosikletinizin ekspertiz raporu (${doc.report_no}) hazır.`,
        `Raporu görüntülemek için: ${pdfUrl}`,
      ];
      if (tenant?.name) lines.push("", tenant.name);
      const text = lines.join("\n");
      const number = toWhatsAppNumber(doc.customer_phone);
      if (!number) {
        toast.warning("Müşteri telefonu kayıtlı değil; WhatsApp'ta kişiyi seçmeniz gerekir.");
      }
      const url = `https://wa.me/${number || ""}?text=${encodeURIComponent(text)}`;
      if (win) {
        win.location.href = url;
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (err) {
      win?.close();
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "WhatsApp bağlantısı oluşturulamadı");
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`${doc.report_no} numaralı ekspertiz raporu silinsin mi?`)) return;
    setBusy("delete");
    try {
      await api.delete(`/inspections/${id}`);
      toast.success("Ekspertiz raporu silindi");
      navigate("/inspections");
    } catch {
      toast.error("Ekspertiz silinemedi");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-500">Yükleniyor…</p>;
  }

  if (!doc) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Ekspertiz raporu bulunamadı"
          description="Rapor silinmiş olabilir ya da bu firmaya ait değil."
          action={
            <Button asChild variant="outline">
              <Link to="/inspections">Ekspertiz listesine dön</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const subtitle = [doc.plate, doc.owner_name, formatReportDate(doc.inspection_date)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Ekspertiz raporu"
        title={<span className="font-mono tracking-tight">{doc.report_no}</span>}
        description={subtitle}
        actions={
          <>
            <Button variant="outline" asChild data-testid="btn-inspection-edit">
              <Link to={`/inspections/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Düzenle
              </Link>
            </Button>
            <Button variant="outline" onClick={viewPdf} disabled={busy !== ""} data-testid="btn-inspection-view-pdf">
              <FileText className="h-4 w-4" /> {busy === "pdf" ? "Açılıyor…" : "PDF görüntüle"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={downloadPdf}
              disabled={busy !== ""}
              aria-label="PDF indir"
              title="PDF indir"
              data-testid="btn-inspection-download-pdf"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              onClick={sendWhatsApp}
              disabled={busy !== ""}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              data-testid="btn-inspection-whatsapp"
            >
              <MessageCircle className="h-4 w-4" /> {busy === "wa" ? "Hazırlanıyor…" : "WhatsApp ile gönder"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={busy !== ""}
              aria-label="Raporu sil"
              title="Raporu sil"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              data-testid="btn-inspection-delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="İYİ" value={counts.good} hint="Sorunsuz maddeler" icon={ShieldCheck} tone="emerald" testId="stat-good" />
        <StatCard label="ORTA" value={counts.medium} hint="Dikkat edilmeli" icon={AlertTriangle} tone="amber" testId="stat-medium" />
        <StatCard label="BAKIM" value={counts.service} hint="Bakım / onarım gerekli" icon={Wrench} tone="red" testId="stat-service" />
        <StatCard label="Fotoğraf" value={counts.photos} hint="Tüm kontrol maddeleri" icon={Camera} tone="slate" testId="stat-photos" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Araç ve sahip</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Detail label="Araç sahibi" value={doc.owner_name} />
              <Detail label="Telefon" value={doc.customer_phone} mono />
              <Detail label="Plaka" value={doc.plate} mono />
              <Detail label="Model yılı" value={doc.year} mono />
              <Detail label="Marka ve model" value={doc.make_model} />
              <Detail label="Kilometre" value={doc.km} mono />
              <Detail label="Şasi no" value={doc.chassis_no} mono />
              <Detail label="Ekspertiz tarihi" value={formatReportDate(doc.inspection_date)} mono />
              <Detail label="Teknisyen" value={doc.technician_name} />
              <Detail label="Teslim alan" value={doc.receiver_name} />
            </dl>
            {(doc.customer_id || doc.motorcycle_id) && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {doc.customer_id && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/customers/${doc.customer_id}`}>Müşteri kaydı</Link>
                  </Button>
                )}
                {doc.motorcycle_id && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/motorcycles/${doc.motorcycle_id}`}>Motosiklet kaydı</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kontrol listesi</CardTitle>
            <CardDescription>Her madde için durum, not ve fotoğraflar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {groups.length === 0 && <p className="text-sm text-slate-500">Kontrol maddesi kaydedilmemiş.</p>}
            {groups.map(({ group, items: gItems }) => (
              <section key={group} className="space-y-2" aria-label={group}>
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{group}</h3>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {gItems.map((it) => {
                    const itemPhotos = (doc.photos || []).filter((p) => p.item_key === it.key);
                    return (
                      <div key={it.key} className="px-4 py-3.5" data-testid={`detail-item-${it.key}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-sm font-medium text-slate-900">{it.label}</p>
                          <StatusBadgeInspection status={it.status} />
                        </div>
                        {it.note && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{it.note}</p>}
                        {itemPhotos.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                            {itemPhotos.map((p) => (
                              <InspectionPhotoThumb key={p.id} inspectionId={id} photo={p} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Genel notlar</CardTitle>
        </CardHeader>
        <CardContent>
          {doc.notes ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{doc.notes}</p>
          ) : (
            <p className="text-sm text-slate-500">Genel not girilmedi.</p>
          )}
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Oluşturuldu: {fmtDate(doc.created_at)}
            {doc.updated_at && ` · Son güncelleme: ${fmtDate(doc.updated_at)}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

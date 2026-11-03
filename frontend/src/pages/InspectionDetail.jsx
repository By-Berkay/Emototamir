import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { AlertTriangle, Camera, Download, FileText, MessageCircle, Pencil, ShieldCheck, Trash2, Wrench } from "lucide-react";
import api, { API, fmtDate } from "../lib/api";
import { toWhatsAppNumber } from "../lib/phone";
import { useAuth } from "../context/AuthContext";
import { InspectionPhotoThumb, groupItems } from "../components/InspectionChecklist";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { DataTable, HeroBanner, KpiCard, Panel, StatusBadge } from "../components/design/kit";

// Rapor tarihi YYYY-MM-DD olarak gelir; saat dilimi kaymasını önlemek için doğrudan biçimlenir.
const formatReportDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "-");
const dash = (v) => (v === null || v === undefined || v === "" ? "-" : v);

const STEPS = ["Motosiklet bilgileri", "Ekspertiz", "Teklif", "Onay", "Teslim"];
const OUTLINE_BTN = "border-white/10 bg-white/5 text-slate-100 shadow-none hover:bg-white/10 hover:text-white";

// Kontrol maddesi durumları: toggle benzeri üç segment (aktif olan renkli gösterilir).
const SEGMENTS = [
  { value: "good", label: "İYİ", on: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40" },
  { value: "medium", label: "ORTA", on: "bg-amber-500/20 text-amber-300 ring-amber-500/40" },
  { value: "service", label: "BAKIM", on: "bg-rose-500/20 text-rose-300 ring-rose-500/40" },
];

const DONUT_COLORS = { good: "#34d399", medium: "#fbbf24", service: "#fb7185", unrated: "#334155" };

function Field({ label, value, mono = false }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs font-medium text-slate-400">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right text-sm text-white", mono && "font-mono tabular-nums")}>{dash(value)}</dd>
    </div>
  );
}

function StatusToggle({ value }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-[10px] font-semibold tracking-wide">
      {SEGMENTS.map((s) => {
        const on = value === s.value;
        return (
          <span
            key={s.value}
            className={cn("rounded-full px-2 py-0.5 transition-colors duration-150", on ? `ring-1 ${s.on}` : "text-slate-400")}
          >
            {s.label}
          </span>
        );
      })}
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

  // Puan: İYİ = 100, ORTA = 50, BAKIM = 0; yalnızca değerlendirilmiş maddeler üzerinden hesaplanır.
  const score = useMemo(() => {
    const items = doc?.items || [];
    const rated = items.filter((i) => i.status === "good" || i.status === "medium" || i.status === "service");
    if (!rated.length) return null;
    const points = rated.reduce((sum, i) => sum + (i.status === "good" ? 1 : i.status === "medium" ? 0.5 : 0), 0);
    return Math.round((points / rated.length) * 100);
  }, [doc]);

  const donutData = useMemo(() => {
    const items = doc?.items || [];
    const unrated = items.filter((i) => !i.status).length;
    return [
      { name: "İYİ", value: counts.good, fill: DONUT_COLORS.good },
      { name: "ORTA", value: counts.medium, fill: DONUT_COLORS.medium },
      { name: "BAKIM", value: counts.service, fill: DONUT_COLORS.service },
      { name: "Değerlendirilmedi", value: unrated, fill: DONUT_COLORS.unrated },
    ].filter((d) => d.value > 0);
  }, [doc, counts]);

  // Teklif kalemleri: ekspertizde ORTA veya BAKIM işaretli maddeler (mevcut veriden).
  const quoteLines = useMemo(
    () => (doc?.items || []).filter((i) => i.status === "medium" || i.status === "service"),
    [doc]
  );

  // Adım şeridi: kontrol maddelerinden bir durum işaretlendiyse "Ekspertiz" adımı aktif sayılır.
  const activeStep = (doc?.items || []).some((i) => i.status) ? 1 : 0;

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
    return <p className="py-16 text-center text-sm text-slate-400">Yükleniyor…</p>;
  }

  if (!doc) {
    return (
      <Panel testId="inspection-not-found">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10">
            <FileText className="h-5 w-5" />
          </span>
          <p className="font-heading text-base font-semibold text-white">Ekspertiz raporu bulunamadı</p>
          <p className="max-w-sm text-sm text-slate-400">Rapor silinmiş olabilir ya da bu firmaya ait değil.</p>
          <Link
            to="/inspections"
            className="mt-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Ekspertiz listesine dön
          </Link>
        </div>
      </Panel>
    );
  }

  const subtitle = [doc.report_no, doc.plate, doc.owner_name, formatReportDate(doc.inspection_date)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6 pb-4 text-white">
      <HeroBanner
        eyebrow="Ekspertiz & teklif"
        title="Ekspertiz & Teklif"
        subtitle={subtitle}
        testId="inspection-hero"
      >
        <ol className="flex flex-wrap gap-2" aria-label="İş akışı adımları">
          {STEPS.map((step, idx) => {
            const isActive = idx === activeStep;
            const isDone = idx < activeStep;
            return (
              <li
                key={step}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-colors",
                  isActive && "bg-orange-500 text-white ring-orange-400",
                  isDone && "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
                  !isActive && !isDone && "bg-white/5 text-slate-400 ring-white/10"
                )}
              >
                <span className="font-mono text-[11px] opacity-80">{idx + 1}</span>
                {step}
              </li>
            );
          })}
        </ol>
      </HeroBanner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={ShieldCheck} label="İYİ" value={counts.good} tone="green" testId="stat-good" />
        <KpiCard icon={AlertTriangle} label="ORTA" value={counts.medium} tone="amber" testId="stat-medium" />
        <KpiCard icon={Wrench} label="BAKIM" value={counts.service} tone="red" testId="stat-service" />
        <KpiCard icon={Camera} label="Fotoğraf" value={counts.photos} tone="blue" testId="stat-photos" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Sol: motosiklet bilgileri */}
        <Panel title="Motosiklet bilgileri" subtitle="Araç ve sahip kaydı" testId="panel-moto-info">
          {(doc.photos || []).length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {(doc.photos || []).slice(0, 4).map((p) => (
                <InspectionPhotoThumb key={p.id} inspectionId={id} photo={p} />
              ))}
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/5 text-slate-400">
              <Camera className="h-6 w-6" />
              <span className="text-xs">Fotoğraf eklenmedi</span>
            </div>
          )}

          <dl className="mt-5">
            <Field label="Marka ve model" value={doc.make_model} />
            <Field label="Plaka" value={doc.plate} mono />
            <Field label="Şasi no" value={doc.chassis_no} mono />
            <Field label="Model yılı" value={doc.year} mono />
            <Field label="Kilometre" value={doc.km} mono />
            <Field label="Müşteri" value={doc.owner_name} />
            <Field label="Telefon" value={doc.customer_phone} mono />
            <Field label="Ekspertiz tarihi" value={formatReportDate(doc.inspection_date)} mono />
            <Field label="Teknisyen" value={doc.technician_name} />
            <Field label="Teslim alan" value={doc.receiver_name} />
          </dl>

          {(doc.customer_id || doc.motorcycle_id) && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {doc.customer_id && (
                <Link
                  to={`/customers/${doc.customer_id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-orange-300 hover:bg-white/5"
                >
                  Müşteri kaydı
                </Link>
              )}
              {doc.motorcycle_id && (
                <Link
                  to={`/motorcycles/${doc.motorcycle_id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-orange-300 hover:bg-white/5"
                >
                  Motosiklet kaydı
                </Link>
              )}
            </div>
          )}
        </Panel>

        {/* Orta: kontrol listesi ve puan */}
        <Panel
          title="Ekspertiz kontrol listesi"
          subtitle="Her madde için durum, not ve fotoğraflar."
          testId="panel-checklist"
        >
          <div className="mb-5 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="relative h-32 w-32 shrink-0">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={60}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-white/10" />
              )}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" data-testid="inspection-score">
                <span className="font-heading text-2xl font-bold text-white">{score === null ? "-" : `%${score}`}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Puan</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-sm">
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-slate-300">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.fill }} aria-hidden="true" />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-mono tabular-nums text-white">{d.value}</span>
                </li>
              ))}
              {donutData.length === 0 && <li className="text-slate-400">Kontrol maddesi kaydedilmemiş.</li>}
            </ul>
          </div>

          {groups.length === 0 && <p className="text-sm text-slate-400">Kontrol maddesi kaydedilmemiş.</p>}
          <div className="space-y-5">
            {groups.map(({ group, items: gItems }) => (
              <section key={group} className="space-y-2" aria-label={group}>
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{group}</h3>
                <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                  {gItems.map((it) => {
                    const itemPhotos = (doc.photos || []).filter((p) => p.item_key === it.key);
                    return (
                      <div key={it.key} className="px-4 py-3.5" data-testid={`detail-item-${it.key}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-sm font-medium text-white">{it.label}</p>
                          <StatusToggle value={it.status} />
                        </div>
                        {it.note && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-400">{it.note}</p>}
                        {itemPhotos.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          </div>
        </Panel>

        {/* Sağ: teklif kalemleri ve özet */}
        <Panel title="Teklif kalemleri" subtitle="ORTA veya BAKIM işaretli maddeler." testId="panel-quote-lines">
          {quoteLines.length > 0 ? (
            <DataTable>
              <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Kalem</th>
                  <th className="px-3 py-2.5 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {quoteLines.map((it) => (
                  <tr key={it.key} data-testid={`quote-line-${it.key}`}>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-medium text-white">{it.label}</p>
                      {it.note && <p className="mt-0.5 text-xs text-slate-400">{it.note}</p>}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <StatusBadge tone={it.status === "service" ? "danger" : "warning"}>
                        {it.status === "service" ? "BAKIM" : "ORTA"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              İşlem gerektiren kalem yok.
            </p>
          )}

          <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4" data-testid="quote-summary">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Teklif özeti</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Toplam kontrol maddesi</dt>
                <dd className="font-mono tabular-nums text-white">{(doc.items || []).length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Bakım gerektiren</dt>
                <dd className="font-mono tabular-nums text-rose-300">{counts.service}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Orta öncelikli</dt>
                <dd className="font-mono tabular-nums text-amber-300">{counts.medium}</dd>
              </div>
            </dl>
            <Link
              to="/quotes/new"
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Teklif oluştur
            </Link>
          </div>
        </Panel>
      </div>

      <Panel title="Genel notlar" testId="panel-notes">
        {doc.notes ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{doc.notes}</p>
        ) : (
          <p className="text-sm text-slate-400">Genel not girilmedi.</p>
        )}
        <p className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-400">
          Oluşturuldu: {fmtDate(doc.created_at)}
          {doc.updated_at && ` · Son güncelleme: ${fmtDate(doc.updated_at)}`}
        </p>
      </Panel>

      {/* Alt aksiyon çubuğu */}
      <div
        className="emt-glass-dark sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-white/10 p-3 text-white"
        data-testid="inspection-action-bar"
      >
        <Button variant="outline" asChild className={OUTLINE_BTN} data-testid="btn-inspection-edit">
          <Link to={`/inspections/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Düzenle
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={viewPdf}
          disabled={busy !== ""}
          className={OUTLINE_BTN}
          data-testid="btn-inspection-view-pdf"
        >
          <FileText className="h-4 w-4" /> {busy === "pdf" ? "Açılıyor…" : "PDF görüntüle"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={downloadPdf}
          disabled={busy !== ""}
          aria-label="PDF indir"
          title="PDF indir"
          className={OUTLINE_BTN}
          data-testid="btn-inspection-download-pdf"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          onClick={sendWhatsApp}
          disabled={busy !== ""}
          className="bg-orange-500 text-white hover:bg-orange-600"
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
          className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          data-testid="btn-inspection-delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

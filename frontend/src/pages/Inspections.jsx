import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, ClipboardCheck, Plus, Search, ShieldCheck, Wrench } from "lucide-react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { DataTable, FilterChips, HeroBanner, KpiCard, Panel, StatusBadge } from "../components/design/kit";

// Rapor tarihi YYYY-MM-DD olarak tutulur; saat dilimi kaymasını önlemek için doğrudan biçimlenir.
const formatReportDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "-");

// Rapor durumu kontrol maddelerinden türetilir: en kötü işaretlenmiş madde belirler.
function statusOf(r) {
  const items = r.items || [];
  if (!items.some((x) => x.status)) return { key: "none", label: "Değerlendirilmedi", tone: "neutral" };
  if (items.some((x) => x.status === "service")) return { key: "service", label: "Servis gerekli", tone: "danger" };
  if (items.some((x) => x.status === "medium")) return { key: "medium", label: "Dikkat", tone: "warning" };
  return { key: "good", label: "Uygun", tone: "success" };
}

// Ekspertiz skoru: İYİ = 100, ORTA = 50, BAKIM = 0; yalnızca değerlendirilmiş maddeler.
function scoreOf(items = []) {
  const rated = items.filter((x) => x.status === "good" || x.status === "medium" || x.status === "service");
  if (!rated.length) return null;
  const points = rated.reduce((sum, x) => sum + (x.status === "good" ? 1 : x.status === "medium" ? 0.5 : 0), 0);
  return Math.round((points / rated.length) * 100);
}

const FILTER_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "good", label: "Uygun" },
  { value: "medium", label: "Dikkat" },
  { value: "service", label: "Servis gerekli" },
];

export default function Inspections() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const query = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
        const { data } = await api.get(`/inspections?limit=100${query}`);
        if (active) setRows(data);
      } catch {
        if (active) {
          setRows([]);
          toast.error("Ekspertiz listesi yüklenemedi");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  const open = (id) => navigate(`/inspections/${id}`);

  const kpi = useMemo(() => {
    const byKey = { good: 0, medium: 0, service: 0 };
    rows.forEach((r) => {
      const k = statusOf(r).key;
      if (k in byKey) byKey[k] += 1;
    });
    return { total: rows.length, ...byKey };
  }, [rows]);

  const visibleRows = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => statusOf(r).key === statusFilter)),
    [rows, statusFilter]
  );

  return (
    <div className="space-y-6 text-white">
      <HeroBanner
        slot="inspection_hero"
        fallback={null}
        eyebrow="Ekspertiz"
        title="Ekspertiz"
        subtitle="Araç kabul ve durum tespiti raporları. Her rapor fotoğraflı, PDF olarak paylaşılabilir."
        testId="inspection-list-hero"
        actions={
          <Button asChild className="bg-orange-500 text-white hover:bg-orange-600" data-testid="btn-new-inspection">
            <Link to="/inspections/new">
              <Plus className="h-4 w-4" /> Yeni ekspertiz
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={ClipboardCheck} label="Toplam ekspertiz" value={kpi.total} tone="orange" testId="insp-total" />
        <KpiCard icon={ShieldCheck} label="Uygun" value={kpi.good} tone="green" testId="insp-good" />
        <KpiCard icon={AlertTriangle} label="Dikkat" value={kpi.medium} tone="amber" testId="insp-medium" />
        <KpiCard icon={Wrench} label="Servis gerekli" value={kpi.service} tone="red" testId="insp-service" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rapor no, plaka, araç sahibi veya şasi no ara…"
              className="h-10 border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
              aria-label="Ekspertiz ara"
              data-testid="input-search-inspections"
            />
          </div>
          <FilterChips options={FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </div>
        <p className="text-sm text-slate-400" data-testid="text-inspection-count">
          {loading ? "Yükleniyor…" : `${visibleRows.length} rapor`}
        </p>
      </div>

      <Panel bodyClassName="p-0">
        {!loading && visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <p className="font-heading text-base font-semibold text-white">
              {q || statusFilter !== "all" ? "Aramanızla eşleşen rapor yok" : "Henüz ekspertiz raporu yok"}
            </p>
            <p className="max-w-sm text-sm text-slate-400">
              {q || statusFilter !== "all"
                ? "Farklı bir plaka, rapor no, durum veya isim deneyin."
                : "İlk ekspertiz raporunu oluşturup araç durumunu fotoğraflarla belgeleyin."}
            </p>
            {!q && statusFilter === "all" && (
              <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
                <Link to="/inspections/new">
                  <Plus className="h-4 w-4" /> Ekspertiz oluştur
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Masaüstü: tablo */}
            <div className="hidden p-0 md:block">
              <DataTable className="rounded-none border-0">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Rapor no</th>
                    <th className="px-4 py-3 font-semibold">Tarih</th>
                    <th className="px-4 py-3 font-semibold">Müşteri</th>
                    <th className="px-4 py-3 font-semibold">Motosiklet</th>
                    <th className="px-4 py-3 font-semibold">Durum</th>
                    <th className="px-4 py-3 font-semibold">Skor</th>
                    <th className="px-5 py-3 text-right font-semibold">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {visibleRows.map((r) => {
                    const st = statusOf(r);
                    const score = scoreOf(r.items || []);
                    return (
                      <tr
                        key={r.id}
                        className="cursor-pointer transition-colors duration-150 hover:bg-white/5"
                        onClick={() => open(r.id)}
                        data-testid={`row-inspection-${r.id}`}
                      >
                        <td className="px-5 py-3.5 font-mono text-sm font-medium text-orange-300">
                          <Link to={`/inspections/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                            {r.report_no}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-slate-300">{formatReportDate(r.inspection_date)}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-white">{r.owner_name || "-"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono tabular-nums text-slate-200">{r.plate || "-"}</p>
                          {r.make_model && <p className="text-xs text-slate-400">{r.make_model}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        </td>
                        <td className="px-4 py-3.5 font-mono tabular-nums text-white">{score === null ? "-" : `%${score}`}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-300">
                            Aç <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>

            {/* Mobil: kart listesi */}
            <ul className="divide-y divide-white/10 md:hidden">
              {visibleRows.map((r) => {
                const st = statusOf(r);
                const score = scoreOf(r.items || []);
                return (
                  <li key={r.id}>
                    <Link
                      to={`/inspections/${r.id}`}
                      className="flex flex-col gap-1.5 px-5 py-4 transition-colors duration-150 hover:bg-white/5"
                      data-testid={`card-inspection-${r.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-medium text-orange-300">{r.report_no}</span>
                        <span className="text-xs tabular-nums text-slate-400">{formatReportDate(r.inspection_date)}</span>
                      </div>
                      <div className="font-medium text-white">{r.owner_name || "-"}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                        <span className="font-mono tabular-nums text-slate-200">{r.plate}</span>
                        {r.make_model && <span>{r.make_model}</span>}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        {score !== null && <span className="font-mono text-xs tabular-nums text-slate-300">Skor %{score}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Search } from "lucide-react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

// Rapor tarihi YYYY-MM-DD olarak tutulur; saat dilimi kaymasını önlemek için doğrudan biçimlenir.
const formatReportDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "-");

export default function Inspections() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ekspertiz"
        title="Ekspertiz raporları"
        description="Araç kabul ve durum tespiti raporları. Her rapor fotoğraflı, PDF olarak paylaşılabilir."
        actions={
          <Button asChild data-testid="btn-new-inspection">
            <Link to="/inspections/new">
              <Plus className="h-4 w-4" /> Yeni ekspertiz
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rapor no, plaka, araç sahibi veya şasi no ara…"
            className="h-10 pl-9"
            aria-label="Ekspertiz ara"
            data-testid="input-search-inspections"
          />
        </div>
        <p className="text-sm text-slate-500" data-testid="text-inspection-count">
          {loading ? "Yükleniyor…" : `${rows.length} rapor`}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {!loading && rows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={q ? "Aramanızla eşleşen rapor yok" : "Henüz ekspertiz raporu yok"}
              description={
                q
                  ? "Farklı bir plaka, rapor no veya isim deneyin."
                  : "İlk ekspertiz raporunu oluşturup araç durumunu fotoğraflarla belgeleyin."
              }
              action={
                !q && (
                  <Button asChild>
                    <Link to="/inspections/new">
                      <Plus className="h-4 w-4" /> Ekspertiz oluştur
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Masaüstü: tablo */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">Rapor no</TableHead>
                      <TableHead>Araç sahibi</TableHead>
                      <TableHead>Plaka</TableHead>
                      <TableHead>Marka / model</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="pr-5">Teknisyen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => open(r.id)}
                        data-testid={`row-inspection-${r.id}`}
                      >
                        <TableCell className="pl-5 font-mono text-sm font-medium text-brand-700">
                          <Link to={`/inspections/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                            {r.report_no}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">{r.owner_name || "-"}</TableCell>
                        <TableCell className="font-mono tabular-nums">{r.plate}</TableCell>
                        <TableCell>{r.make_model || "-"}</TableCell>
                        <TableCell className="tabular-nums">{formatReportDate(r.inspection_date)}</TableCell>
                        <TableCell className="pr-5">{r.technician_name || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobil: kart listesi */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/inspections/${r.id}`}
                      className="flex flex-col gap-1 px-4 py-3.5 transition-colors duration-150 hover:bg-slate-50"
                      data-testid={`card-inspection-${r.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-medium text-brand-700">{r.report_no}</span>
                        <span className="text-xs tabular-nums text-slate-500">{formatReportDate(r.inspection_date)}</span>
                      </div>
                      <div className="font-medium text-slate-900">{r.owner_name || "-"}</div>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
                        <span className="font-mono tabular-nums text-slate-700">{r.plate}</span>
                        {r.make_model && <span>{r.make_model}</span>}
                        {r.technician_name && <span>· {r.technician_name}</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

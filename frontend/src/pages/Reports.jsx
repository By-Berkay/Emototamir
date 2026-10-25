import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useLayout } from "../lib/layoutPrefs";
import { usePrivacy } from "../context/PrivacyContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Money from "../components/Money";
import DashboardDebtorsTable from "../components/DashboardDebtorsTable";
import { DashboardSection, SectionsPanel } from "../components/DashboardLayout";
import { toast } from "sonner";

function toCSV(rows, headers) {
  const head = headers.map(h=>h.label).join(",");
  const body = rows.map(r=>headers.map(h=>`"${String(r[h.key]??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  return head + "\n" + body;
}

const download = (name, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const exportCsv = (name, rows, headers) => () => {
  download(name, toCSV(rows, headers));
  toast.success("İndirildi");
};

const LAYOUT_KEY = "report.layout.v1";
const SECTIONS = [
  { id: "totals", label: "Genel toplamlar", span: "full" },
  { id: "profit", label: "Kâr ve zarar", span: "narrow" },
  { id: "customers", label: "En Çok Servis Kullanan Müşteriler", span: "wide" },
  { id: "services", label: "En Çok Yapılan Hizmetler", span: "wide" },
  { id: "parts", label: "En Çok Kullanılan Parçalar", span: "narrow" },
  { id: "stock", label: "Kritik Stok", span: "wide" },
  { id: "debtors", label: "Borçlu Müşteriler", span: "narrow" },
];
const DEFAULT_IDS = SECTIONS.map((s) => s.id);
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

const PROFIT_ROWS = [
  { label: "Parça geliri", key: "parts_revenue" },
  { label: "Parça maliyeti", key: "parts_cost" },
  { label: "Parça marjı", key: "parts_margin" },
  { label: "Hizmet geliri", key: "services_revenue" },
  { label: "İşçilik geliri", key: "labor_revenue" },
];

/** Rapor kartı: başlık, isteğe bağlı CSV indirme düğmesi ve yatay kaydırmalı içerik. */
function ReportCard({ title, onExport, children }) {
  return (
    <Card className="flex-1 overflow-hidden border-slate-200">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function SimpleTable({ columns, rows, rowKey, renderRow, empty = "Kayıt yok" }) {
  return (
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          {columns.map((c) => (
            <th key={c.label} className={`px-4 py-2 ${c.right ? "text-right" : "text-left"}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">{empty}</td></tr>
        ) : (
          rows.map((row) => <tr key={rowKey(row)} className="border-t">{renderRow(row)}</tr>)
        )}
      </tbody>
    </table>
  );
}

export default function Reports() {
  const { unlocked } = usePrivacy();
  const [r, setR] = useState(null);
  const { order, visible, hidden, toggle, reset, dnd } = useLayout(LAYOUT_KEY, DEFAULT_IDS);

  // Kilit açılıp kapanınca tutarlar yeniden alınır (sunucu parasal alanları gizlerse null gelir).
  useEffect(() => {
    let active = true;
    api.get("/reports/summary")
      .then((x) => { if (active) setR(x.data); })
      .catch(() => toast.error("Rapor verileri yüklenemedi"));
    return () => { active = false; };
  }, [unlocked]);

  if (!r) return <p className="text-sm text-slate-500">Yükleniyor…</p>;

  const pl = r.profit_loss;

  const bodies = {
    totals: (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam Ciro" value={<Money value={r.totals.total_revenue} />} tone="brand" />
        <StatCard label="Toplam Tahsilat" value={<Money value={r.totals.total_collected} />} tone="emerald" />
        <StatCard label="Alacak" value={<Money value={r.totals.receivables} />} tone="red" />
        <StatCard label="Servis Sayısı" value={r.totals.orders_count} tone="slate" />
      </div>
    ),

    profit: (
      <ReportCard title="Kâr ve zarar">
        <dl className="divide-y divide-slate-100 px-4 text-sm">
          {PROFIT_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-slate-600">{row.label}</dt>
              <dd className="font-medium"><Money value={pl[row.key]} /></dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="font-semibold text-slate-900">Brüt kâr</dt>
            <dd className="font-heading text-base font-bold text-slate-900"><Money value={pl.gross_profit} /></dd>
          </div>
        </dl>
      </ReportCard>
    ),

    customers: (
      <ReportCard
        title="En Çok Servis Kullanan Müşteriler"
        onExport={exportCsv("musteri_raporu.csv", r.top_customers, [
          { key: "customer_name", label: "Müşteri" },
          { key: "count", label: "Servis" },
          { key: "spent", label: "Harcama" },
        ])}
      >
        <SimpleTable
          columns={[{ label: "Müşteri" }, { label: "Servis", right: true }, { label: "Harcama", right: true }]}
          rows={r.top_customers}
          rowKey={(c) => c.customer_id}
          renderRow={(c) => (
            <>
              <td className="px-4 py-2">{c.customer_name}</td>
              <td className="px-4 py-2 text-right">{c.count}</td>
              <td className="px-4 py-2 text-right font-medium"><Money value={c.spent} /></td>
            </>
          )}
        />
      </ReportCard>
    ),

    services: (
      <ReportCard
        title="En Çok Yapılan Hizmetler"
        onExport={exportCsv("hizmet_raporu.csv", r.top_services, [
          { key: "name", label: "Hizmet" },
          { key: "count", label: "Adet" },
          { key: "revenue", label: "Ciro" },
        ])}
      >
        <SimpleTable
          columns={[{ label: "Hizmet" }, { label: "Adet", right: true }, { label: "Ciro", right: true }]}
          rows={r.top_services}
          rowKey={(s) => s.name}
          renderRow={(s) => (
            <>
              <td className="px-4 py-2">{s.name}</td>
              <td className="px-4 py-2 text-right">{s.count}</td>
              <td className="px-4 py-2 text-right font-medium"><Money value={s.revenue} /></td>
            </>
          )}
        />
      </ReportCard>
    ),

    parts: (
      <ReportCard
        title="En Çok Kullanılan Parçalar"
        onExport={exportCsv("parca_raporu.csv", r.top_parts, [
          { key: "name", label: "Parça" },
          { key: "qty", label: "Adet" },
          { key: "revenue", label: "Ciro" },
        ])}
      >
        <SimpleTable
          columns={[{ label: "Parça" }, { label: "Adet", right: true }, { label: "Ciro", right: true }]}
          rows={r.top_parts}
          rowKey={(p) => p.name}
          renderRow={(p) => (
            <>
              <td className="px-4 py-2">{p.name}</td>
              <td className="px-4 py-2 text-right">{p.qty}</td>
              <td className="px-4 py-2 text-right font-medium"><Money value={p.revenue} /></td>
            </>
          )}
        />
      </ReportCard>
    ),

    stock: (
      <ReportCard title="Kritik Stok">
        <SimpleTable
          columns={[{ label: "Kod" }, { label: "Ad" }, { label: "Stok", right: true }, { label: "Min", right: true }]}
          rows={r.critical_stock}
          rowKey={(p) => p.id}
          empty="Tüm stoklar iyi durumda"
          renderRow={(p) => (
            <>
              <td className="px-4 py-2 font-mono">{p.code}</td>
              <td className="px-4 py-2">{p.name}</td>
              <td className="px-4 py-2 text-right font-bold text-red-600">{p.stock}</td>
              <td className="px-4 py-2 text-right">{p.min_stock}</td>
            </>
          )}
        />
      </ReportCard>
    ),

    debtors: (
      <ReportCard title="Borçlu Müşteriler">
        <DashboardDebtorsTable debtors={r.debtors} />
      </ReportCard>
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        actions={
          <SectionsPanel
            sections={order.map((id) => SECTION_BY_ID[id])}
            hidden={hidden}
            onToggle={toggle}
            onReset={reset}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {visible.map((id) => (
          <DashboardSection
            key={id}
            id={id}
            label={SECTION_BY_ID[id].label}
            span={SECTION_BY_ID[id].span}
            dnd={dnd}
          >
            {bodies[id]}
          </DashboardSection>
        ))}
      </div>
    </div>
  );
}

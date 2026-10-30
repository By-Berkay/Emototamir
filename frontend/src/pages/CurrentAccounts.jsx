import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import AnimatedMotorcycleSVG from "../components/AnimatedMotorcycleSVG";
import { Wallet, Search, Users, TrendingDown, TrendingUp, CircleCheck } from "lucide-react";
import Money from "../components/Money";
import { usePrivacy } from "../context/PrivacyContext";
import { KpiTile, Donut, Bar, Initials, RankBadge, PALETTE } from "../components/reports/ReportKit";

const SORTS = {
  balance: { label: "Bakiyeye göre", fn: (a, b) => b.balance - a.balance },
  spent: { label: "Harcamaya göre", fn: (a, b) => b.total_spent - a.total_spent },
  name: { label: "Ada göre", fn: (a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "tr") },
};

export default function CurrentAccounts() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("balance");
  const [loaded, setLoaded] = useState(false);
  const { unlocked } = usePrivacy();

  useEffect(() => {
    api.get("/current-accounts").then((r) => setRows(r.data)).finally(() => setLoaded(true));
  }, []);

  const k = useMemo(() => {
    const debtors = rows.filter((r) => r.balance > 0.01);
    const totalDebt = debtors.reduce((s, r) => s + r.balance, 0);
    const totalPaid = rows.reduce((s, r) => s + (r.total_paid || 0), 0);
    const totalSpent = rows.reduce((s, r) => s + (r.total_spent || 0), 0);
    return {
      totalDebt,
      debtorCount: debtors.length,
      clearCount: rows.length - debtors.length,
      collection: totalSpent ? Math.min(100, Math.round((totalPaid / totalSpent) * 100)) : 100,
      topDebtor: debtors.reduce((m, r) => (r.balance > (m?.balance || 0) ? r : m), null),
    };
  }, [rows]);

  // Tutarlar kilitliyken dilim değerleri yüzde olarak gösterilir; tutar hiçbir yerde açılmaz.
  const donut = useMemo(() => {
    const top = [...rows].filter((r) => r.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const parts = top.slice(0, 5).map((r, i) => ({ name: `${r.first_name} ${r.last_name}`, amount: r.balance, color: PALETTE[i] }));
    const restSum = top.slice(5).reduce((s, r) => s + r.balance, 0);
    if (restSum > 0) parts.push({ name: "Diğer", amount: restSum, color: "#64748b" });
    const total = parts.reduce((s, p) => s + p.amount, 0) || 1;
    return parts.map((p) => ({ ...p, pct: Math.round((p.amount / total) * 100), value: unlocked ? p.amount : Math.round((p.amount / total) * 100) }));
  }, [rows, unlocked]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => !needle || `${r.first_name} ${r.last_name} ${r.phone || ""}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [rows, q, sort]);

  const maxBalance = Math.max(0, ...rows.map((r) => r.balance || 0));

  return (
    <div className="space-y-6">
      <PageHeader
        art={<AnimatedMotorcycleSVG type="cruiser" height="100%" />}
        visual={<PageVisual icon={Wallet} />}
        title="Cari Hesaplar"
        description="Müşteri bakiyeleri, tahsilat durumu ve açık alacaklar."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile testId="ca-total-debt" label="Toplam alacak" icon={TrendingDown} tone="red" value={<Money value={k.totalDebt} />} hint={`${k.debtorCount} borçlu müşteri`} />
        <KpiTile testId="ca-debtors" label="Borçlu müşteri" icon={Users} tone="orange" value={k.debtorCount} hint={`${k.clearCount} müşteri hesabı kapalı`} />
        <KpiTile testId="ca-collection" label="Tahsilat oranı" icon={TrendingUp} tone="emerald" value={`%${k.collection}`} hint="Harcamaya göre tahsil edilen" />
        <KpiTile testId="ca-top" label="En yüksek borç" icon={CircleCheck} tone="violet" value={k.topDebtor ? <Money value={k.topDebtor.balance} /> : "—"} hint={k.topDebtor ? `${k.topDebtor.first_name} ${k.topDebtor.last_name}` : "Borç yok"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200/70 dark:border-white/10 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Alacak dağılımı</CardTitle>
            <CardDescription>En yüksek 5 borçlu ve diğerleri</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {donut.length ? (
              <>
                <Donut data={donut} centerLabel="Toplam" centerValue={unlocked ? fmtMoney(k.totalDebt) : "**"} height={220} />
                <ul className="space-y-2 text-sm">
                  {donut.map((d) => (
                    <li key={d.name} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate">{d.name}</span></span>
                      <span className="font-medium tabular-nums">{unlocked ? fmtMoney(d.amount) : `%${d.pct}`}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">Açık alacak yok</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200/70 dark:border-white/10 lg:col-span-2">
          <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Müşteri bakiyeleri</CardTitle>
              <CardDescription>{list.length} müşteri</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad veya telefon ara" className="pl-9 sm:w-56" aria-label="Cari ara" />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
                aria-label="Sırala"
              >
                {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Müşteri</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Servis</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Harcama</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Tahsilat</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Bakiye</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, i) => {
                    const debt = r.balance > 0.01;
                    return (
                      <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-brand-50/40 dark:border-white/5 dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-3"><RankBadge n={i + 1} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Initials name={`${r.first_name} ${r.last_name}`} />
                            <div className="min-w-0">
                              <Link to={`/customers/${r.id}`} className="block truncate font-medium hover:underline">{r.first_name} {r.last_name}</Link>
                              <p className="font-mono text-xs text-slate-500">{r.phone}</p>
                              {debt && <div className="mt-1 w-28"><Bar value={r.balance} max={maxBalance} color="#ef4444" /></div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.total_services}</td>
                        <td className="px-4 py-3 text-right tabular-nums"><Money value={r.total_spent} /></td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400"><Money value={r.total_paid} /></td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex rounded-md px-2 py-0.5 font-bold tabular-nums ${debt ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                            <Money value={r.balance} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {loaded && list.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">{q ? "Aramaya uygun müşteri yok" : "Cari hesap kaydı yok"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

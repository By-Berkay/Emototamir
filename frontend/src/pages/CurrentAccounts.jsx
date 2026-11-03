import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtDate } from "../lib/api";
import { Input } from "../components/ui/input";
import { Search, Users, TrendingDown, Wallet, Scale, Eye, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import Money from "../components/Money";
import { usePrivacy } from "../context/PrivacyContext";
import { HeroBanner, KpiCard, Panel, StatusBadge, DataTable, FilterChips } from "../components/design/kit";

const SORTS = {
  balance: { label: "Bakiyeye göre", fn: (a, b) => b.balance - a.balance },
  spent: { label: "Harcamaya göre", fn: (a, b) => b.total_spent - a.total_spent },
  name: { label: "Ada göre", fn: (a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "tr") },
};

const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "debt", label: "Borçlu" },
  { value: "credit", label: "Alacaklı" },
];

const METHODS = { cash: "Nakit", card: "Kredi Kartı", transfer: "Havale/EFT", other: "Diğer" };
const METHOD_TONE = { cash: "success", card: "info", transfer: "violet", other: "neutral" };

const PAGE_SIZE = 10;
const CONTROL = "h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-orange-500 focus:outline-none";
const ACTION = "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white";
const PAGE_BTN = "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40";

const fullName = (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim();

function initialsOf(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

function Avatar({ name }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-cyan-400 text-xs font-bold text-white">
      {initialsOf(name)}
    </span>
  );
}

function statusOf(balance) {
  if (balance > 0.01) return <StatusBadge tone="danger">Borçlu</StatusBadge>;
  if (balance < -0.01) return <StatusBadge tone="info">Alacaklı</StatusBadge>;
  return <StatusBadge tone="success">Kapalı</StatusBadge>;
}

function balanceTone(balance) {
  if (balance > 0.01) return "text-rose-300";
  if (balance < -0.01) return "text-emerald-300";
  return "text-slate-300";
}

export default function CurrentAccounts() {
  const [rows, setRows] = useState([]);
  const [payments, setPayments] = useState([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("balance");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const { unlocked } = usePrivacy();

  useEffect(() => {
    api.get("/current-accounts").then((r) => setRows(r.data)).finally(() => setLoaded(true));
    api.get("/payments").then((r) => setPayments(r.data)).catch(() => setPayments([]));
  }, []);

  const k = useMemo(() => {
    const debtors = rows.filter((r) => r.balance > 0.01);
    const totalDebt = debtors.reduce((s, r) => s + r.balance, 0);
    const totalPaid = rows.reduce((s, r) => s + (r.total_paid || 0), 0);
    const totalSpent = rows.reduce((s, r) => s + (r.total_spent || 0), 0);
    return {
      totalDebt,
      totalPaid,
      net: rows.reduce((s, r) => s + (r.balance || 0), 0),
      debtorCount: debtors.length,
      clearCount: rows.length - debtors.length,
      collection: totalSpent ? Math.min(100, Math.round((totalPaid / totalSpent) * 100)) : 100,
      topDebtor: debtors.reduce((m, r) => (r.balance > (m?.balance || 0) ? r : m), null),
    };
  }, [rows]);

  const nameById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, fullName(r)])), [rows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => filter === "all" || (filter === "debt" ? r.balance > 0.01 : r.balance < -0.01))
      .filter((r) => !needle || `${r.first_name} ${r.last_name} ${r.phone || ""}`.toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [rows, q, sort, filter]);

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const recent = payments.slice(0, 8);

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Finans"
        title="Cari Hesaplar & Tahsilatlar"
        subtitle="Müşteri bakiyeleri, tahsilat durumu ve açık alacaklar."
        slot="accounts_hero"
        actions={
          <Link
            to="/payments"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Yeni Tahsilat
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          testId="ca-total-debt"
          icon={TrendingDown}
          label="Toplam alacak"
          tone="red"
          value={<Money value={k.totalDebt} />}
          delta={`${k.debtorCount} borçlu`}
          deltaTone="neutral"
        />
        <KpiCard
          testId="ca-paid"
          icon={Wallet}
          label="Toplam tahsilat"
          tone="green"
          value={<Money value={k.totalPaid} />}
          delta={`%${k.collection} tahsil`}
          deltaTone="up"
        />
        <KpiCard
          testId="ca-debtors"
          icon={Users}
          label="Borçlu müşteri"
          tone="orange"
          value={k.debtorCount}
          delta={`${k.clearCount} kapalı`}
          deltaTone="neutral"
        />
        <KpiCard
          testId="ca-net"
          icon={Scale}
          label="Net bakiye"
          tone="blue"
          value={<Money value={k.net} />}
          delta={k.net > 0.01 ? "Alacak yönlü" : "Dengede"}
          deltaTone={k.net > 0.01 ? "down" : "up"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Müşteri cari hesapları (borç / alacak)"
          subtitle={`${list.length} müşteri`}
          testId="ca-panel"
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300 ring-1 ring-white/10">
              Tahsilat oranı{" "}
              <b data-testid="ca-collection" className="text-emerald-300">%{k.collection}</b>
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300 ring-1 ring-white/10">
              En yüksek borç{" "}
              <span data-testid="ca-top" className="font-semibold text-rose-300">
                {k.topDebtor ? `${fullName(k.topDebtor)} · ` : ""}
                {k.topDebtor ? <Money value={k.topDebtor.balance} /> : "—"}
              </span>
            </span>
          </div>

          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <FilterChips
              options={FILTERS}
              value={filter}
              onChange={(v) => {
                setFilter(v);
                resetPage();
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    resetPage();
                  }}
                  placeholder="Ad veya telefon ara"
                  className="h-10 border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500 focus-visible:border-orange-500 sm:w-56"
                  aria-label="Cari ara"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  resetPage();
                }}
                className={CONTROL}
                aria-label="Sırala"
              >
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key} className="bg-slate-900">{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DataTable>
            <thead>
              <tr>
                <th className="text-left">Müşteri</th>
                <th className="text-left">Telefon</th>
                <th className="text-right">Borç</th>
                <th className="text-right">Alacak</th>
                <th className="text-right">Bakiye</th>
                <th className="text-left">Durum</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const name = fullName(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0">
                          <Link to={`/customers/${r.id}`} className="block truncate font-medium text-white hover:text-orange-300 hover:underline">
                            {name}
                          </Link>
                          <p className="text-xs text-slate-400">{r.total_services} servis</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-400">{r.phone || "-"}</td>
                    <td className="text-right font-medium tabular-nums text-rose-300"><Money value={r.total_spent} /></td>
                    <td className="text-right font-medium tabular-nums text-emerald-300"><Money value={r.total_paid} /></td>
                    <td className={`text-right font-bold tabular-nums ${balanceTone(r.balance)}`}><Money value={r.balance} /></td>
                    <td>{statusOf(r.balance)}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/customers/${r.id}`} className={ACTION} aria-label={`${name} cari detayı`}>
                          <Eye className="h-3.5 w-3.5" />
                          Görüntüle
                        </Link>
                        <Link to="/payments" className={ACTION}>
                          <Plus className="h-3.5 w-3.5" />
                          Tahsilat
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loaded && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    {q ? "Aramaya uygun müşteri yok" : "Cari hesap kaydı yok"}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>

          {list.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-400">
              <span>Sayfa {current} / {pageCount}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(current - 1)}
                  disabled={current <= 1}
                  className={PAGE_BTN}
                  aria-label="Önceki sayfa"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(current + 1)}
                  disabled={current >= pageCount}
                  className={PAGE_BTN}
                  aria-label="Sonraki sayfa"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Tahsilat ekle" subtitle="Yeni tahsilat kaydı oluşturun" testId="ca-payment-panel">
            <p className="text-sm text-slate-400">
              Müşteri, servis, tutar ve ödeme yöntemi bilgileriyle tahsilat kaydı Tahsilatlar ekranında oluşturulur.
            </p>
            <Link
              to="/payments"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Tahsilat ekranına git
            </Link>
          </Panel>

          <Panel title="Tahsilat geçmişi" subtitle="Son kayıtlar" testId="ca-history-panel">
            {recent.length ? (
              <ul className="divide-y divide-white/5">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{nameById[p.customer_id] || "Müşteri"}</p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(p.created_at)}
                        {p.payment_no ? ` · ${p.payment_no}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular-nums text-emerald-300"><Money value={p.amount} /></span>
                      <StatusBadge tone={METHOD_TONE[p.method] || "neutral"}>{METHODS[p.method] || p.method}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Tahsilat kaydı yok</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

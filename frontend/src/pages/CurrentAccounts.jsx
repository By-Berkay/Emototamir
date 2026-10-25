import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtMoney } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

export default function CurrentAccounts() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/current-accounts").then(r=>setRows(r.data)); }, []);

  const totalDebt = rows.reduce((s,r)=>s + Math.max(0, r.balance), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Cari Hesaplar" />
      <div className="max-w-xs">
        <StatCard label="Toplam Alacak" value={fmtMoney(totalDebt)} tone="red" />
      </div>
      <Card className="border-slate-200"><CardContent className="p-0">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="text-left px-4 py-3">Müşteri</th><th className="text-left px-4 py-3">Telefon</th>
            <th className="text-right px-4 py-3">Toplam Servis</th><th className="text-right px-4 py-3">Harcama</th>
            <th className="text-right px-4 py-3">Tahsilat</th><th className="text-right px-4 py-3">Bakiye</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3"><Link to={`/customers/${r.id}`} className="font-medium hover:underline">{r.first_name} {r.last_name}</Link></td>
                <td className="px-4 py-3 font-mono text-slate-600">{r.phone}</td>
                <td className="px-4 py-3 text-right">{r.total_services}</td>
                <td className="px-4 py-3 text-right">{fmtMoney(r.total_spent)}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{fmtMoney(r.total_paid)}</td>
                <td className={`px-4 py-3 text-right font-bold ${r.balance>0.01?"text-red-600":"text-emerald-600"}`}>{fmtMoney(r.balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Cari hesap kaydı yok</td></tr>}
          </tbody>
        </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

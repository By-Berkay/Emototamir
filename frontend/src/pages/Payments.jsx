import React, { useEffect, useState } from "react";
import api, { fmtMoney, fmtDate } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";

const METHOD_LABEL = { cash:"Nakit", card:"Kredi Kartı", transfer:"Havale/EFT", other:"Diğer" };

export default function Payments() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/payments").then(r=>setItems(r.data)); }, []);
  const total = items.reduce((s,p)=>s+p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Tahsilatlar</h1>
        <p className="text-sm text-slate-500 mt-1">Toplam: <span className="font-bold text-emerald-600">{fmtMoney(total)}</span></p>
      </div>
      <Card className="border-slate-200"><CardContent className="p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="text-left px-4 py-3">Tarih</th>
            <th className="text-left px-4 py-3">Tahsilat No</th>
            <th className="text-left px-4 py-3">Yöntem</th>
            <th className="text-right px-4 py-3">Tutar</th>
          </tr></thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{fmtDate(p.created_at)}</td>
                <td className="px-4 py-3 font-mono">{p.payment_no}</td>
                <td className="px-4 py-3">{METHOD_LABEL[p.method] || p.method}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtMoney(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtDateShort } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AlertTriangle, Clock, Bike } from "lucide-react";

export default function Reminders() {
  const [data, setData] = useState({ overdue: [], upcoming: [] });
  useEffect(() => { api.get("/reminders").then(r => setData(r.data)); }, []);

  const Row = ({ r }) => (
    <tr className="border-t hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link to={`/motorcycles/${r.motorcycle_id}`} className="font-medium hover:underline flex items-center gap-2">
          <Bike className="h-4 w-4 text-slate-500" />{r.brand} {r.model}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-sm">{r.plate}</td>
      <td className="px-4 py-3">{r.customer ? `${r.customer.first_name} ${r.customer.last_name}` : "-"}</td>
      <td className="px-4 py-3 font-mono text-sm">{r.customer?.phone}</td>
      <td className="px-4 py-3 text-right">{r.last_km?.toLocaleString("tr-TR")} km</td>
      <td className="px-4 py-3">{fmtDateShort(r.last_service_date)}</td>
      <td className="px-4 py-3">{fmtDateShort(r.next_date)}</td>
      <td className={`px-4 py-3 text-right font-semibold ${r.days_left < 0 ? "text-red-600" : r.days_left <= 7 ? "text-orange-600" : "text-slate-700"}`}>
        {r.days_left < 0 ? `${Math.abs(r.days_left)} gün gecikti` : `${r.days_left} gün kaldı`}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Bakım Hatırlatmaları</h1>
        <p className="text-sm text-slate-500 mt-1">Motosikletin son servisinden 12 ay veya 5.000 km sonrası için hatırlatmalar</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card className="border-red-200 bg-red-50/40"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-red-700"><AlertTriangle className="h-4 w-4" />Gecikmiş</div>
          <div className="font-heading text-3xl font-bold text-red-700 mt-1" data-testid="reminders-overdue-count">{data.overdue.length}</div>
        </CardContent></Card>
        <Card className="border-orange-200 bg-orange-50/40"><CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-700"><Clock className="h-4 w-4" />Yaklaşan (30 gün)</div>
          <div className="font-heading text-3xl font-bold text-orange-700 mt-1" data-testid="reminders-upcoming-count">{data.upcoming.length}</div>
        </CardContent></Card>
      </div>

      {data.overdue.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" />Gecikmiş Bakımlar</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                  <th className="text-left px-4 py-2">Motosiklet</th><th className="text-left px-4 py-2">Plaka</th>
                  <th className="text-left px-4 py-2">Müşteri</th><th className="text-left px-4 py-2">Telefon</th>
                  <th className="text-right px-4 py-2">Son KM</th><th className="text-left px-4 py-2">Son Servis</th>
                  <th className="text-left px-4 py-2">Bir Sonraki</th><th className="text-right px-4 py-2">Durum</th>
                </tr></thead>
                <tbody>{data.overdue.map(r => <Row key={r.motorcycle_id} r={r} />)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-orange-600" />Yaklaşan Bakımlar (30 gün içinde)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="text-left px-4 py-2">Motosiklet</th><th className="text-left px-4 py-2">Plaka</th>
                <th className="text-left px-4 py-2">Müşteri</th><th className="text-left px-4 py-2">Telefon</th>
                <th className="text-right px-4 py-2">Son KM</th><th className="text-left px-4 py-2">Son Servis</th>
                <th className="text-left px-4 py-2">Bir Sonraki</th><th className="text-right px-4 py-2">Durum</th>
              </tr></thead>
              <tbody>
                {data.upcoming.map(r => <Row key={r.motorcycle_id} r={r} />)}
                {data.upcoming.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Yaklaşan bakım hatırlatması yok</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

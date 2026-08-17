import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { History, RefreshCw, Filter } from "lucide-react";
import { fmtDate } from "../lib/api";

const ACTION_COLORS = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-200",
  update: "bg-blue-50 text-blue-700 border-blue-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  status_change: "bg-amber-50 text-amber-700 border-amber-200",
  password_reset: "bg-purple-50 text-purple-700 border-purple-200",
  clone: "bg-indigo-50 text-indigo-700 border-indigo-200",
  global_apply: "bg-slate-100 text-slate-700 border-slate-200",
};
const badgeCls = (action = "") => {
  const key = action.split(".").pop();
  return ACTION_COLORS[key] || "bg-slate-50 text-slate-700 border-slate-200";
};

export default function AdminAuditLogs() {
  const [tenants, setTenants] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ tenant_id: "", user_email: "", action: "", since: "" });

  useEffect(() => {
    api.get("/admin/tenants").then(r => setTenants(r.data));
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (f.tenant_id && f.tenant_id !== "all") q.set("tenant_id", f.tenant_id);
      if (f.user_email) q.set("user_email", f.user_email);
      if (f.action) q.set("action", f.action);
      if (f.since) q.set("since", new Date(f.since + "T00:00:00Z").toISOString());
      q.set("limit", "500");
      const { data } = await api.get(`/admin/audit-logs?${q}`);
      setLogs(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    const g = {};
    logs.forEach(l => {
      const d = (l.at || "").slice(0, 10);
      g[d] = g[d] || []; g[d].push(l);
    });
    return g;
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 flex items-center gap-2"><History className="h-7 w-7 text-orange-500" />Denetim Kayıtları</h1>
          <p className="text-sm text-slate-500 mt-1">{logs.length} kayıt · Her işlem kim yaptı, ne zaman yaptı — filtreleyerek inceleyin.</p>
        </div>
        <Button onClick={fetchLogs} className="bg-orange-500 hover:bg-orange-600" data-testid="audit-refresh">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Yenile
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Filtreler</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Firma</Label>
            <Select value={f.tenant_id || "all"} onValueChange={(v)=>setF({...f, tenant_id: v === "all" ? "" : v})}>
              <SelectTrigger data-testid="audit-tenant"><SelectValue placeholder="Tümü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kullanıcı (e-posta)</Label>
            <Input value={f.user_email} onChange={(e)=>setF({...f, user_email:e.target.value})} placeholder="ör: admin@…" data-testid="audit-user" />
          </div>
          <div>
            <Label>İşlem</Label>
            <Input value={f.action} onChange={(e)=>setF({...f, action:e.target.value})} placeholder="ör: service_order.create" data-testid="audit-action" />
          </div>
          <div>
            <Label>Bu tarihten sonra</Label>
            <Input type="date" value={f.since} onChange={(e)=>setF({...f, since:e.target.value})} data-testid="audit-since" />
          </div>
          <div className="md:col-span-4 flex justify-end gap-2">
            <Button variant="outline" onClick={()=>{ setF({ tenant_id:"", user_email:"", action:"", since:"" }); setTimeout(fetchLogs, 0); }}>Temizle</Button>
            <Button onClick={fetchLogs} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="audit-apply">Uygula</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 && !loading && <div className="p-10 text-center text-slate-500">Bu filtrelere uyan kayıt yok.</div>}
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-slate-50 border-y text-xs font-semibold text-slate-600 uppercase">{new Date(date).toLocaleDateString("tr-TR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</div>
              <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <tbody>
                  {items.map(l => (
                    <tr key={l.id} className="border-b hover:bg-slate-50" data-testid={`audit-row-${l.id}`}>
                      <td className="px-3 py-2 w-24 text-xs text-slate-500 whitespace-nowrap">{fmtDate(l.at).split(" ")[1]}</td>
                      <td className="px-2 py-2 w-40"><span className={`text-[10px] uppercase font-semibold px-2 py-1 rounded border whitespace-nowrap ${badgeCls(l.action)}`}>{l.action}</span></td>
                      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{l.user}</td>
                      <td className="hidden md:table-cell px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{l.tenant_name || <span className="text-slate-400">— sistem —</span>}</td>
                      <td className="hidden lg:table-cell px-3 py-2 text-xs text-slate-500 font-mono truncate max-w-xs" title={l.entity_id}>
                        {l.entity_id ? l.entity_id.slice(0,8) : ""}
                        {(l.old_value !== undefined || l.new_value !== undefined) && (
                          <span className="ml-2 text-slate-600">
                            {l.old_value !== undefined && <span>{String(l.old_value)}</span>}
                            {l.old_value !== undefined && l.new_value !== undefined && <span className="mx-1">→</span>}
                            {l.new_value !== undefined && <span className="font-semibold">{Array.isArray(l.new_value) ? l.new_value.join(", ") : String(l.new_value)}</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

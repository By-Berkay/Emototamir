import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { History, RefreshCw, Filter, ArrowRight, X } from "lucide-react";
import { fmtDate } from "../lib/api";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

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

// Satırlardaki saatle aynı (yerel) güne göre YYYY-MM-DD anahtarı üretir
const localDay = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function AdminAuditLogs() {
  const [tenants, setTenants] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ tenant_id: "", user_email: "", action: "", since: "" });
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/admin/tenants").then(r => setTenants(r.data));
  }, []);

  // filters parametresi verilmezse mevcut form değerleri kullanılır (Temizle gibi state'i henüz güncellenmemiş çağrılar için)
  const fetchLogs = async (filters = f) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.tenant_id && filters.tenant_id !== "all") q.set("tenant_id", filters.tenant_id);
      if (filters.user_email) q.set("user_email", filters.user_email);
      if (filters.action) q.set("action", filters.action);
      // Tarih seçimi Türkiye saatine (yerel gün başlangıcı) göre yorumlanır
      if (filters.since) q.set("since", new Date(filters.since + "T00:00:00").toISOString());
      q.set("limit", "500");
      const { data } = await api.get(`/admin/audit-logs?${q}`);
      setLogs(data);
    } catch { toast.error("Denetim kayıtları yüklenemedi"); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    const g = {};
    logs.forEach(l => {
      const d = localDay(l.at);
      g[d] = g[d] || []; g[d].push(l);
    });
    return g;
  }, [logs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><History className="h-7 w-7 text-brand-500" />Denetim Kayıtları</span>}
        description={`${logs.length} kayıt · Her işlem kim yaptı, ne zaman yaptı — filtreleyerek inceleyin.`}
        actions={
          <Button onClick={() => fetchLogs()} className="bg-brand-500 hover:bg-brand-600" data-testid="audit-refresh">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Yenile
          </Button>
        }
      />

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
            <Button variant="outline" onClick={()=>{ const cleared = { tenant_id:"", user_email:"", action:"", since:"" }; setF(cleared); fetchLogs(cleared); }}>Temizle</Button>
            <Button onClick={() => fetchLogs()} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="audit-apply">Uygula</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 && !loading && <EmptyState icon={History} title="Bu filtrelere uyan kayıt yok." />}
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-slate-50 border-y text-xs font-semibold text-slate-600 uppercase">{new Date(date + "T00:00:00").toLocaleDateString("tr-TR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</div>
              <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <tbody>
                  {items.map(l => (
                    <tr key={l.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={()=>setDetail(l)} data-testid={`audit-row-${l.id}`}>
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

      {/* Audit detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o)=>{ if(!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl" data-testid="audit-detail-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-brand-500" />
              Denetim Detayı
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-slate-500">İşlem</div><span className={`text-[11px] uppercase font-semibold px-2 py-1 rounded border ${badgeCls(detail.action)}`}>{detail.action}</span></div>
                <div><div className="text-xs text-slate-500">Zaman</div><div className="font-medium">{fmtDate(detail.at)}</div></div>
                <div><div className="text-xs text-slate-500">Kullanıcı</div><div className="font-medium">{detail.user}</div></div>
                <div><div className="text-xs text-slate-500">Firma</div><div className="font-medium">{detail.tenant_name || "— sistem —"}</div></div>
                {detail.entity_id && <div className="col-span-2"><div className="text-xs text-slate-500">Kayıt ID</div><div className="font-mono text-xs">{detail.entity_id}</div></div>}
              </div>
              {Array.isArray(detail.changes) && detail.changes.length > 0 ? (
                <div>
                  <div className="text-xs uppercase text-slate-500 mb-2">Değişen Alanlar ({detail.changes.length})</div>
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-3 py-2 w-1/4">Alan</th><th className="text-left px-3 py-2">Önce</th><th className="w-6"></th><th className="text-left px-3 py-2">Sonra</th></tr></thead>
                      <tbody>
                        {detail.changes.map((c, i) => (
                          <tr key={i} className="border-t" data-testid={`audit-diff-${c.field}`}>
                            <td className="px-3 py-2 font-mono text-xs text-slate-700">{c.field}</td>
                            <td className="px-3 py-2 text-slate-500 line-through decoration-red-400/60 break-all">{c.old || <span className="italic text-slate-400">—</span>}</td>
                            <td className="px-1 text-slate-400"><ArrowRight className="h-3 w-3" /></td>
                            <td className="px-3 py-2 text-emerald-700 font-medium break-all">{c.new || <span className="italic text-slate-400">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (detail.old_value !== undefined || detail.new_value !== undefined) ? (
                <div>
                  <div className="text-xs uppercase text-slate-500 mb-2">Değer</div>
                  <div className="border rounded-md p-3 bg-slate-50 text-sm">
                    {detail.old_value !== undefined && <div><span className="text-slate-500">Önce:</span> <span className="line-through decoration-red-400/60">{String(detail.old_value)}</span></div>}
                    {detail.new_value !== undefined && <div><span className="text-slate-500">Sonra:</span> <span className="font-medium text-emerald-700">{Array.isArray(detail.new_value) ? detail.new_value.join(", ") : String(detail.new_value)}</span></div>}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">Bu işlem için alan değişikliği kaydedilmemiş.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

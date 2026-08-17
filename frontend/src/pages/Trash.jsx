import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Trash2, ArchiveRestore, ArchiveX, User as UserIcon, Bike, RefreshCw, AlertTriangle } from "lucide-react";

function fmtDT(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("tr-TR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return iso; }
}
function daysLeft(iso) {
  if (!iso) return null;
  try {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  } catch { return null; }
}

export default function Trash() {
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const t = type === "all" ? "" : type;
      const { data } = await api.get(`/trash${t ? "?type=" + t : ""}`);
      setRows(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type]);

  const restore = async (r) => {
    if (!window.confirm(`${r.label} kaydı geri yüklensin mi?`)) return;
    try {
      const { data } = await api.post(`/trash/${r.id}/restore`);
      const parts = Object.entries(data.restored || {}).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`);
      toast.success(`Geri yüklendi${parts.length ? ` · ${parts.join(", ")}` : ""}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Geri yükleme başarısız");
    }
  };
  const purge = async (r) => {
    if (!window.confirm(`${r.label} kaydı KALICI olarak silinecek. Geri alınamaz. Emin misiniz?`)) return;
    try {
      await api.delete(`/trash/${r.id}`);
      toast.success("Kalıcı olarak silindi");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Silinemedi");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="h-7 w-7 text-red-500" />Çöp Kutusu
          </h1>
          <p className="text-sm text-slate-500 mt-1">Silinen kayıtlar 30 gün saklanır. Sonrasında otomatik olarak kalıcı silinir.</p>
        </div>
        <div className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40" data-testid="trash-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Türler</SelectItem>
              <SelectItem value="customer">Müşteriler</SelectItem>
              <SelectItem value="motorcycle">Motosikletler</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} data-testid="trash-refresh"><RefreshCw className={`h-4 w-4 mr-1 ${loading?"animate-spin":""}`} />Yenile</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-600">{rows.length} kayıt</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Tür</th>
                <th className="text-left px-4 py-2">Kayıt</th>
                <th className="text-left px-4 py-2">Silen</th>
                <th className="text-left px-4 py-2">Silinme</th>
                <th className="text-left px-4 py-2">Kalan</th>
                <th className="text-left px-4 py-2">Sebep</th>
                <th className="text-left px-4 py-2">Cascade</th>
                <th className="text-right px-4 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const dl = daysLeft(r.purge_at);
                const critical = dl !== null && dl <= 3;
                return (
                  <tr key={r.id} className="border-t hover:bg-slate-50" data-testid={`trash-row-${r.id}`}>
                    <td className="px-4 py-2">
                      {r.type === "customer" ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"><UserIcon className="h-3 w-3" />Müşteri</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded"><Bike className="h-3 w-3" />Motosiklet</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{r.label}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">{r.deleted_by}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{fmtDT(r.deleted_at)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold ${critical ? "text-red-600" : "text-slate-600"}`}>
                        {critical && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        {dl !== null ? `${dl} gün` : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {Object.entries(r.counts || {}).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={()=>restore(r)} data-testid={`restore-${r.id}`}><ArchiveRestore className="h-3.5 w-3.5 mr-1" />Geri Yükle</Button>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={()=>purge(r)} data-testid={`purge-${r.id}`}><ArchiveX className="h-3.5 w-3.5 mr-1" />Kalıcı Sil</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">
                  <Trash2 className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  Çöp kutusu boş.
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

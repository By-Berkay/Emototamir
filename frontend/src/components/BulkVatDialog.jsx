import React, { useState } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Percent } from "lucide-react";
import { toast } from "sonner";

/** Katalogdaki KDV oranlarını toplu değiştirir (vergi oranı değişikliklerinde). Geçmiş belgeler etkilenmez. */
export default function BulkVatDialog({ onDone }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("all");
  const [fromVat, setFromVat] = useState("any");
  const [vat, setVat] = useState("20");
  const [mode, setMode] = useState("keep");
  const [busy, setBusy] = useState(false);
  const selectCls = "h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm";
  const SCOPE_LABEL = { all: "parça ve hizmet", part: "parça", service: "hizmet" };

  const apply = async () => {
    const target = Number(vat);
    if (vat === "" || !Number.isFinite(target) || target < 0 || target > 100) {
      return toast.error("KDV oranı 0-100 arasında olmalı");
    }
    const ok = window.confirm(
      `Katalogdaki ${SCOPE_LABEL[scope]} kalemlerinin KDV oranı %${target} olarak güncellenecek.\n\n` +
      "Mevcut iş emri ve tekliflerdeki kalemler değişmez; yalnızca bundan sonra katalogdan eklenen kalemler etkilenir. Devam edilsin mi?"
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.post("/catalog/vat-bulk", {
        scope,
        vat: target,
        from_vat: fromVat === "any" ? null : Number(fromVat),
        price_mode: mode === "keep" ? null : mode,
      });
      toast.success(`${data.parts} parça, ${data.services} hizmet güncellendi`);
      setOpen(false);
      await onDone?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Toplu güncelleme başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="btn-bulk-vat"><Percent className="h-3.5 w-3.5 mr-1" />Toplu KDV değiştir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Toplu KDV değiştir</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-500">
          Vergi oranı değiştiğinde katalogdaki parça ve hizmetleri tek seferde günceller. Geçmiş belgeler etkilenmez.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Kapsam</Label>
            <select className={selectCls} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">Parça ve hizmet</option>
              <option value="part">Sadece parçalar</option>
              <option value="service">Sadece hizmetler</option>
            </select>
          </div>
          <div><Label>Mevcut oran</Label>
            <select className={selectCls} value={fromVat} onChange={(e) => setFromVat(e.target.value)}>
              <option value="any">Tümü</option>
              {[0, 1, 10, 20].map((r) => <option key={r} value={r}>%{r}</option>)}
            </select>
          </div>
          <div><Label>Yeni KDV %</Label>
            <Input type="number" min={0} max={100} value={vat} onChange={(e) => setVat(e.target.value)} />
          </div>
          <div><Label>Fiyat tipi</Label>
            <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="keep">Değiştirme</option>
              <option value="incl">KDV dahil</option>
              <option value="excl">KDV hariç</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
          <Button onClick={apply} disabled={busy} className="bg-brand-500 hover:bg-brand-600">Uygula</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


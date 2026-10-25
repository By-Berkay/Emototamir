import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const digits = (v) => v.replace(/\D/g, "").slice(0, 4);

/** Yönetici PIN'ini değiştirme kartı. PIN varsa önce mevcut PIN istenir. */
export default function PinChangeCard() {
  const [hasPin, setHasPin] = useState(null);
  const [form, setForm] = useState({ current: "", next: "", repeat: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/auth/pin/status")
      .then(({ data }) => setHasPin(!!data.has_pin))
      .catch(() => setHasPin(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: digits(e.target.value) }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length !== 4) { toast.error("PIN 4 haneli olmalıdır"); return; }
    if (form.next !== form.repeat) { toast.error("Yeni PIN'ler eşleşmiyor"); return; }
    if (hasPin && form.current.length !== 4) { toast.error("Mevcut PIN'i girin"); return; }
    setSaving(true);
    try {
      await api.put("/auth/pin", { pin: form.next, current_pin: hasPin ? form.current : null });
      toast.success("Yönetici PIN'i güncellendi");
      setForm({ current: "", next: "", repeat: "" });
      setHasPin(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "PIN güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6" data-testid="pin-change-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Yönetici PIN'i
        </CardTitle>
        <p className="text-sm text-slate-500">
          Dashboard ve raporlardaki para tutarlarını açmak için kullanılır. {hasPin === false && "Henüz PIN belirlenmedi."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {hasPin && (
            <div className="space-y-1.5">
              <Label htmlFor="pin_current">Mevcut PIN</Label>
              <Input id="pin_current" type="password" inputMode="numeric" autoComplete="off"
                     value={form.current} onChange={set("current")} className="tracking-[0.5em]" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pin_next">Yeni PIN (4 haneli)</Label>
            <Input id="pin_next" type="password" inputMode="numeric" autoComplete="off"
                   value={form.next} onChange={set("next")} className="tracking-[0.5em]" data-testid="input-new-pin" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin_repeat">Yeni PIN (tekrar)</Label>
            <Input id="pin_repeat" type="password" inputMode="numeric" autoComplete="off"
                   value={form.repeat} onChange={set("repeat")} className="tracking-[0.5em]" />
          </div>
          <Button type="submit" disabled={saving || hasPin === null} className="w-full" data-testid="btn-change-pin">
            {saving ? "Kaydediliyor…" : hasPin ? "PIN'i Güncelle" : "PIN Belirle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

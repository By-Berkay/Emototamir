import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { toast } from "sonner";

/** 4 haneli yönetici PIN'i: PIN yoksa belirletir, varsa doğrular. */
export default function PinDialog({ onClose, onUnlock }) {
  const [hasPin, setHasPin] = useState(null);
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/auth/pin/status")
      .then(({ data }) => setHasPin(!!data.has_pin))
      .catch(() => setHasPin(true));
  }, []);

  const digits = (v) => v.replace(/\D/g, "").slice(0, 4);

  const submit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) { toast.error("PIN 4 haneli olmalıdır"); return; }
    setBusy(true);
    try {
      if (!hasPin && pin !== repeat) { toast.error("PIN'ler eşleşmiyor"); setBusy(false); return; }
      if (!hasPin) await api.put("/auth/pin", { pin });
      const { data } = await api.post("/auth/pin/verify", { pin });
      onUnlock(data.reveal_token);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "PIN doğrulanamadı");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{hasPin === false ? "Yönetici PIN'i belirleyin" : "Yönetici PIN'i"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="pin-form">
          <div className="space-y-1.5">
            <Label htmlFor="pin">4 haneli PIN</Label>
            <Input id="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus
                   value={pin} onChange={(e) => setPin(digits(e.target.value))}
                   className="text-center text-xl tracking-[0.5em]" data-testid="input-pin" />
          </div>
          {hasPin === false && (
            <div className="space-y-1.5">
              <Label htmlFor="pin2">PIN tekrar</Label>
              <Input id="pin2" type="password" inputMode="numeric" autoComplete="off"
                     value={repeat} onChange={(e) => setRepeat(digits(e.target.value))}
                     className="text-center text-xl tracking-[0.5em]" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={busy || hasPin === null} data-testid="btn-pin-submit">
              {hasPin === false ? "Kaydet ve aç" : "Aç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

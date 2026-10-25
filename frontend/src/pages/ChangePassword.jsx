import React, { useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import PinChangeCard from "../components/PinChangeCard";

const MIN_LEN = 8;
const EMPTY = { current_password: "", new_password: "", confirm_password: "" };

export default function ChangePassword() {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < MIN_LEN) {
      toast.error(`Yeni şifre en az ${MIN_LEN} karakter olmalıdır`);
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast.error("Yeni şifreler eşleşmiyor");
      return;
    }
    if (form.new_password === form.current_password) {
      toast.error("Yeni şifre mevcut şifreden farklı olmalıdır");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success("Şifreniz değiştirildi");
      setForm(EMPTY);
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Şifre değiştirilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title="Şifre Değiştir" description="Hesabınızın şifresini güncelleyin." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Yeni şifre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" data-testid="change-password-form">
            <div className="space-y-1.5">
              <Label htmlFor="current_password">Mevcut şifre</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                value={form.current_password}
                onChange={set("current_password")}
                required
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new_password">Yeni şifre</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_LEN}
                value={form.new_password}
                onChange={set("new_password")}
                required
                data-testid="input-new-password"
              />
              <p className="text-xs text-slate-500">En az {MIN_LEN} karakter.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Yeni şifre (tekrar)</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_LEN}
                value={form.confirm_password}
                onChange={set("confirm_password")}
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full" data-testid="btn-change-password">
              {saving ? "Kaydediliyor…" : "Şifreyi Güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <PinChangeCard />
    </div>
  );
}

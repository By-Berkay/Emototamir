import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

function formatErr(d) {
  if (!d) return "Bir hata oluştu";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return d?.msg || String(d);
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Giriş başarılı");
      navigate("/");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-body">
      <div className="hidden lg:flex flex-1 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="flex items-center">
          <div className="h-11 w-11 bg-orange-500 rounded-md flex items-center justify-center mr-3">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <div className="font-heading font-bold text-xl">MOTO SERVİS</div>
            <div className="text-xs text-slate-400 tracking-wider">YÖNETİM SİSTEMİ</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Servis operasyonunu <span className="text-orange-500">tek ekrandan</span> yönetin.
          </h1>
          <p className="mt-6 text-slate-300 text-base max-w-md">
            Müşteri, motosiklet, iş emri, parça, tahsilat ve cari hesap yönetimi.
            Türkiye'deki motosiklet servisleri için tasarlandı.
          </p>
        </div>
        <div className="text-xs text-slate-500 relative">© Moto Servis · v1.0</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center">
            <div className="h-10 w-10 bg-orange-500 rounded-md flex items-center justify-center mr-3">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-bold text-slate-900">MOTO SERVİS</div>
              <div className="text-xs text-slate-500">Yönetim Sistemi</div>
            </div>
          </div>
          <h2 className="font-heading text-3xl font-bold text-slate-900">Giriş Yap</h2>
          <p className="text-slate-500 text-sm mt-2 mb-8">Hesabınıza erişmek için bilgilerinizi girin.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="ornek@servis.com" className="mt-1.5 h-11" data-testid="login-email" />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••" className="mt-1.5 h-11" data-testid="login-password" />
            </div>
            <Button type="submit" disabled={loading}
                    className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    data-testid="login-submit">
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>
          </form>
          <div className="mt-8 text-xs text-slate-500 border-t pt-4">
            Demo hesap ile giriş yapmayı unutmayın.
          </div>
        </div>
      </div>
    </div>
  );
}

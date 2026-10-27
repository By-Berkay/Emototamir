import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Wrench, ClipboardCheck, Wallet, MessageCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

const WHATSAPP_URL = `https://wa.me/447378552959?text=${encodeURIComponent(
  "Merhaba E-Moto Tamir uygulaması için bilgi istiyorum."
)}`;

const FEATURES = [
  { icon: Wrench, title: "İş emri ve servis takibi", text: "Arıza tespitinden teslimata kadar her aşama tek kayıtta izlenir." },
  { icon: ClipboardCheck, title: "Fiyat teklifi ve onay", text: "Müşteriye bağlantıyla teklif gönderin, onayını kayda alın." },
  { icon: Wallet, title: "Tahsilat ve cari hesap", text: "Borç, ödeme ve bakiye hareketleri müşteri bazında takip edilir." },
];

// Kutu içi alanlar: koyu zeminde marka rengiyle aydınlanan odak
const fieldCls = "emt-field h-11 border-white/12 bg-white/[0.05] text-white placeholder:text-slate-500";

function formatErr(d) {
  if (!d) return "Bir hata oluştu";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  }
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
      const message =
        formatErr(err?.response?.data?.detail) ||
        err?.message ||
        "Giriş sırasında bir hata oluştu";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="emt-night min-h-screen lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Marka paneli (yalnızca masaüstü) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-12 text-white lg:flex" data-testid="login-brand-panel">
        <Link to="/" className="inline-flex w-fit items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana sayfaya dön
        </Link>

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-600/30">
            <Wrench className="h-5 w-5 text-white" />
          </span>
          <div>
            <div className="font-heading text-lg font-bold tracking-tight">E-MOTO TAMİR</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Servis yönetim sistemi</div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Motosiklet servisleri için</p>
          <h1 className="font-heading mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight xl:text-5xl">
            Servis operasyonunuzu <span className="bg-gradient-to-r from-orange-300 to-orange-500 bg-clip-text text-transparent">tek ekrandan</span> yönetin.
          </h1>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-cyan-300/25">
                  <Icon className="h-4 w-4 text-cyan-300" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-400">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <span>© E-Moto Tamir · v1.0</span>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-400 transition-colors duration-150 hover:text-emerald-400"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp İletişim
          </a>
        </div>

      </aside>

      {/* Giriş formu */}
      <main className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobil marka başlığı */}
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-600/30">
                <Wrench className="h-5 w-5 text-white" />
              </span>
              <div>
                <div className="font-heading font-bold tracking-tight text-white">E-MOTO TAMİR</div>
                <div className="text-xs text-slate-400">Servis yönetim sistemi</div>
              </div>
            </div>
            <Link to="/" className="text-xs text-slate-400 hover:text-white">Ana sayfa</Link>
          </div>

          <div className="emt-glass-dark relative overflow-hidden rounded-2xl p-6 sm:p-8">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Hoş geldiniz</p>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">Giriş Yap</h2>
            <p className="mt-1 text-sm text-slate-400">Hesabınıza erişmek için bilgilerinizi girin.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@servis.com"
                  className={fieldCls}
                  data-testid="login-email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={fieldCls}
                  data-testid="login-password"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className={cn(
                  "h-12 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-600/30 transition-all hover:brightness-110",
                  loading && "opacity-80",
                )}
                data-testid="login-submit"
              >
                {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
            </form>

            <p className="mt-8 flex items-start gap-2 border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
              Demo hesap ile giriş yapmak için bizimle iletişime geçin.
            </p>
          </div>

          {/* Mobil WhatsApp bağlantısı */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors duration-150 hover:text-emerald-400 lg:hidden"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp İletişim
          </a>
        </div>
      </main>
    </div>
  );
}

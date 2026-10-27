import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Wrench, ClipboardCheck, Wallet, MessageCircle } from "lucide-react";
import { MotorcycleSvg } from "../components/DashboardHero";
import { toast } from "sonner";

const WHATSAPP_URL = `https://wa.me/447378552959?text=${encodeURIComponent(
  "Merhaba E-Moto Tamir uygulaması için bilgi istiyorum."
)}`;

const FEATURES = [
  {
    icon: Wrench,
    title: "İş emri ve servis takibi",
    text: "Arıza tespitinden teslimata kadar her aşama tek kayıtta izlenir.",
  },
  {
    icon: ClipboardCheck,
    title: "Fiyat teklifi ve onay",
    text: "Müşteriye bağlantıyla teklif gönderin, onayını kayda alın.",
  },
  {
    icon: Wallet,
    title: "Tahsilat ve cari hesap",
    text: "Borç, ödeme ve bakiye hareketleri müşteri bazında takip edilir.",
  },
];

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
    <div className="emt-aurora min-h-screen lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Marka paneli (yalnızca masaüstü) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-10 text-white lg:flex xl:p-12" data-testid="login-brand-panel">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500">
            <Wrench className="h-5 w-5 text-white" />
          </span>
          <div>
            <div className="font-heading text-lg font-bold tracking-tight">E-MOTO TAMİR</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Motosiklet servis yazılımı</div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Yalnızca motosiklet servisleri için</p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
            Motosiklet servisinizi <span className="text-brand-400">tek ekrandan</span> yönetin.
          </h1>

          <div className="relative mt-5 h-40 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-brand-500/10" aria-hidden="true">
            <div className="absolute inset-x-12 bottom-1 h-12 rounded-[50%] border border-brand-400/25 bg-brand-500/10 blur-sm" />
            <div className="emt-float absolute inset-x-10 bottom-0 top-0">
              <MotorcycleSvg />
            </div>
            <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-slate-300">MOTO / 3D</span>
          </div>
          <ul className="mt-6 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <Icon className="h-4 w-4 text-brand-400" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-400">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
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
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500">
              <Wrench className="h-5 w-5 text-white" />
            </span>
            <div>
              <div className="font-heading font-bold tracking-tight text-slate-900">E-MOTO TAMİR</div>
              <div className="text-xs text-slate-500">Motosiklet servis yazılımı</div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-500" />
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">Hoş geldiniz</p>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Giriş Yap</h2>
          <p className="mt-1 text-sm text-slate-500">Motosiklet servis yönetim panelinize güvenle giriş yapın.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@servis.com"
                className="h-11"
                data-testid="login-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11"
                data-testid="login-password"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full"
              data-testid="login-submit"
            >
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>
          </form>

          <p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500">
            Demo hesap ile giriş yapmak için bizimle iletişime geçin.
          </p>
          </div>

          {/* Mobil WhatsApp bağlantısı */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors duration-150 hover:text-emerald-600 lg:hidden"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp İletişim
          </a>
        </div>
      </main>
    </div>
  );
}

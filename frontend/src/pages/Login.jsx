import React, { useEffect, useState } from "react";
import BrandLoader from "../components/BrandLoader";
import { Link } from "react-router-dom";
import { MessageCircle, Bike, BarChart3, ClipboardList } from "lucide-react";
import { APP_VERSION } from "../version";
import LoginCard from "../components/LoginCard";
import { PublicNav, HeroGlow, WHATSAPP_URL } from "../components/PublicShell";
import { useSiteAsset } from "../lib/siteAssets";

const FEATURES = [
  { icon: ClipboardList, title: "Servis ve İş Emirleri", text: "Kabulden teslimata her aşama tek kayıtta izlenir; teklifler onaylanır." },
  { icon: Bike, title: "Motosiklet ve Müşteri Yönetimi", text: "Motosiklet geçmişi, plaka, KM ve müşteri bilgileri tek yerde." },
  { icon: BarChart3, title: "Tahsilat ve Raporlama", text: "Tahsilat, cari hesap ve borç takibi; anlık rapor ve kontrol paneli." },
];

export default function Login() {
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1100);
    return () => clearTimeout(t);
  }, []);

  const heroImage = useSiteAsset("login_hero", "/visuals/moto-hud.jpg");

  return (
    <>
    {intro && <BrandLoader label="Giriş ekranı açılıyor" />}
    <div className="emt-night emt-enter flex min-h-screen flex-col">
      <PublicNav
        anchorPrefix="/"
        secondary={
          <Link to="/" className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:border-cyan-300/50 hover:bg-white/10">
            Ana sayfa
          </Link>
        }
        primary={
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
             className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/30 transition-colors hover:bg-orange-600">
            <MessageCircle className="h-4 w-4" /> Demo Talep Et
          </a>
        }
      />

      <main className="relative isolate flex-1 overflow-hidden">
        <HeroGlow src={heroImage} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:py-20">
          {/* Marka ve özellik alanı */}
          <div data-testid="login-brand-panel">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
              Motosiklet servisleri için
            </p>
            <h1 className="font-heading mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Atölyenin tüm gücü,{" "}
              <span className="bg-gradient-to-r from-orange-300 to-orange-500 bg-clip-text text-transparent">tek ekranda.</span>
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

          {/* Giriş kartı: sayfanın ana öğesi */}
          <div className="mx-auto w-full max-w-md">
            <LoginCard />
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
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© E-Moto Tamir · v{APP_VERSION}</span>
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
      </footer>
    </div>
    </>
  );
}

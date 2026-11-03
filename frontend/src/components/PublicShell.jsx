import React from "react";
import { Link } from "react-router-dom";
import { Wrench, MessageCircle } from "lucide-react";
import { useSiteAsset } from "../lib/siteAssets";

/** Herkese açık sayfalar (onay, teklif, giriş, vitrin) için ortak kabuk. Koyu tema. */
export const WHATSAPP_URL = `https://wa.me/447378552959?text=${encodeURIComponent(
  "Merhaba E-Moto Tamir uygulaması için bilgi istiyorum."
)}`;

export default function PublicShell({ eyebrow, tenantName, children, footer }) {
  return (
    <div className="emt-aurora emt-app min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-heading truncate font-bold text-white">{tenantName || "Moto Servis"}</div>
            <div className="text-xs text-slate-400">{eyebrow}</div>
          </div>
        </header>
        {children}
        {footer && <p className="mt-6 text-center text-xs text-slate-400">{footer}</p>}
      </div>
    </div>
  );
}

/** Üst gezinme çubuğu: logo, bağlantılar ve sağda iki buton. */
export function PublicNav({ anchorPrefix = "", secondary, primary }) {
  const logo = useSiteAsset("logo", "/visuals/emoto-logo.png");
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070c]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="E-Moto Tamir ana sayfa">
          <img src={logo} alt="E-Moto Tamir" className="h-9 w-auto max-w-[150px] object-contain" />
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Sayfa bölümleri">
          <a href={`${anchorPrefix}#features`} className="rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:text-white">Özellikler</a>
          <a href={`${anchorPrefix}#workflow`} className="rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:text-white">İş akışı</a>
          <a href={`${anchorPrefix}#pricing`} className="rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:text-white">Fiyatlandırma</a>
          <a href={`${anchorPrefix}#faq`} className="rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:text-white">SSS</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {secondary}
          {primary}
        </div>
      </div>
    </header>
  );
}

/** Kahraman arka planı: düşük opaklıkta motosiklet görseli ve mavi/turuncu parıltı. */
export function HeroGlow({ src }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        width="1179"
        height="792"
        decoding="async"
        className="absolute left-1/2 top-1/2 w-[120%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-20 mix-blend-screen lg:w-[95%]"
      />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-orange-500/25 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05070c] to-transparent" />
    </div>
  );
}

import React from "react";
import Tilt3D from "./Tilt3D";

/**
 * Ana sayfa sahnesi: cyan ışık çizgili motosiklet ve etrafında yüzen cam HUD panelleri.
 * Tamamen SVG/CSS; dış görsel veya ağır 3B motor gerektirmez. Dekoratiftir (aria-hidden).
 */
export default function HoloMotorcycle() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xl select-none" style={{ perspective: "1200px" }}>
      {/* Zemin halkası */}
      <div className="absolute inset-x-[12%] bottom-[6%] h-6 rounded-[50%] bg-cyan-400/25 blur-xl" />

      {/* Motosiklet */}
      <svg viewBox="0 0 600 380" className="relative z-[1] w-full drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]">
        <defs>
          <filter id="emt-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="emt-head" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ecfeff" />
            <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="emt-tank" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
        </defs>

        <g fill="none" stroke="#67e8f9" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" filter="url(#emt-glow)">
          {/* Tekerlekler */}
          <circle cx="150" cy="270" r="82" />
          <circle cx="455" cy="270" r="82" />
          <circle cx="150" cy="270" r="22" strokeWidth="4" />
          <circle cx="455" cy="270" r="22" strokeWidth="4" />
          <path d="M150 248 V292 M128 270 H172" strokeWidth="2" opacity="0.5" />
          <path d="M455 248 V292 M433 270 H477" strokeWidth="2" opacity="0.5" />
          {/* Şasi ve salıncak kolu */}
          <path d="M150 270 L240 252 L272 236" />
          <path d="M236 252 C258 200 300 170 362 160 L418 150" />
          <path d="M300 255 L222 258 C200 262 184 274 172 296" strokeWidth="5" />
          {/* Ön çatal */}
          <path d="M412 156 L452 262" />
          <path d="M426 152 L460 262" />
          {/* Gidon ve dikiz aynası */}
          <path d="M404 142 L394 114 L378 112" />
          <ellipse cx="368" cy="106" rx="14" ry="7" strokeWidth="3" />
          {/* Motor bloğu */}
          <rect x="292" y="204" width="122" height="62" rx="12" strokeWidth="4" />
          <path d="M310 222 H392 M310 246 H392" strokeWidth="2" opacity="0.6" />
        </g>

        {/* Depo (marka turuncusu) ve koltuk */}
        <path d="M270 172 C290 128 342 118 382 126 C406 131 414 150 398 166 C372 180 322 184 270 172Z"
              fill="url(#emt-tank)" opacity="0.92" />
        <path d="M218 152 C250 138 292 138 320 146 L302 168 L224 166Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />

        {/* Far */}
        <circle cx="440" cy="168" r="30" fill="url(#emt-head)" />
        <circle cx="440" cy="168" r="10" fill="#ecfeff" />
      </svg>

      {/* HUD panelleri: modül adları. Gösterge değerleri temsilidir, gerçek veri değildir. */}
      <Tilt3D max={6} lift={6} className="emt-holo absolute left-0 top-[4%] w-[46%] rounded-xl p-3 emt-float sm:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">İş Emri Yönetimi</p>
        <div className="mt-3 flex h-12 items-end gap-1">
          {[40, 62, 48, 80, 66, 90, 74].map((h, i) => (
            <span key={i} className={`flex-1 rounded-sm ${i === 5 ? "bg-cyan-300" : "bg-cyan-400/35"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="mt-2 text-[9px] uppercase tracking-wider text-slate-500">Temsili gösterge</p>
      </Tilt3D>

      <Tilt3D max={6} lift={6} className="emt-holo absolute right-0 top-[0%] w-[42%] rounded-xl p-3 sm:p-4" style={{ animationDelay: "-2s" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">Periyodik Bakım</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-400 to-orange-400" />
        </div>
        <p className="mt-2 text-[9px] uppercase tracking-wider text-slate-500">Temsili gösterge</p>
      </Tilt3D>

      <Tilt3D max={5} lift={6} className="emt-glass-dark absolute bottom-[2%] right-[2%] hidden w-[40%] rounded-xl p-4 sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/90">Tahsilat ve Cari Hesap</p>
        <svg viewBox="0 0 160 56" className="mt-2 h-14 w-full">
          <path d="M0 44 C20 30 32 40 50 26 S84 18 100 24 S134 6 160 12" fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
          <path d="M0 44 C20 30 32 40 50 26 S84 18 100 24 S134 6 160 12 V56 H0Z" fill="#f97316" opacity="0.15" />
        </svg>
      </Tilt3D>

      <Tilt3D max={5} lift={6} className="emt-glass-dark absolute bottom-[10%] left-[4%] hidden w-[38%] rounded-xl p-4 md:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Stok ve Yedek Parça</p>
        <div className="mt-3 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < 3 ? "bg-orange-400" : "bg-white/20"}`} />
          ))}
        </div>
      </Tilt3D>
    </div>
  );
}

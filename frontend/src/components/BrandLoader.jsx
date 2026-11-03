import React from "react";

/** Tam ekran marka yükleme ekranı: dönen halka, logo ve ilerleme çubuğu. */
export default function BrandLoader({ label = "Yükleniyor" }) {
  const ringMask = "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))";
  return (
    <div
      role="status"
      aria-live="polite"
      className="emt-night fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8"
      data-testid="brand-loader"
    >
      <div className="relative h-44 w-44">
        <div
          className="emt-ring absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, #f97316, #22d3ee 45%, transparent 70%)",
            WebkitMask: ringMask,
            mask: ringMask,
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/visuals/emoto-logo.png"
            alt="E-Moto Tamir"
            width="1536"
            height="1024"
            className="emt-float w-32 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
      <div className="w-60">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="emt-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-orange-500 to-cyan-400" />
        </div>
        <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

import React from "react";

const RING_MASK = "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))";

/**
 * Marka yükleme animasyonu.
 * - inline: bulunduğu kapsayıcının ortasında görünür, sayfa düzenini bozmaz.
 * - varsayılan: tüm ekranı kaplar (uygulama ilk açılırken).
 */
export default function BrandLoader({ label = "Yükleniyor", inline = false }) {
  const wrap = inline
    ? "relative flex min-h-[calc(100vh-10rem)] w-full items-center justify-center"
    : "emt-night fixed inset-0 z-[100] flex items-center justify-center";
  return (
    <div role="status" aria-live="polite" className={wrap} data-testid="brand-loader">
      <div className="flex flex-col items-center gap-8">
        <div className="relative h-48 w-48">
          {/* Arkada yumuşak marka ışığı */}
          <span className="emt-glow absolute inset-4 rounded-full bg-orange-500/30 blur-2xl" aria-hidden="true" />
          {/* Dönen gradyan halka */}
          <span
            className="emt-ring absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, #f97316, #22d3ee 40%, transparent 65%, #f97316)",
              WebkitMask: RING_MASK,
              mask: RING_MASK,
            }}
            aria-hidden="true"
          />
          {/* Ters yönde dönen kesikli halka */}
          <span className="emt-ring-rev absolute inset-5 rounded-full border border-dashed border-cyan-400/40" aria-hidden="true" />
          {/* Yörüngede dönen nokta */}
          <span className="emt-orbit absolute inset-0" aria-hidden="true">
            <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-400 shadow-[0_0_14px_#f97316]" />
          </span>
          {/* Logo: hafifçe nefes alır */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/visuals/emoto-logo.png"
              alt="E-Moto Tamir"
              width="1536"
              height="1024"
              className="emt-breathe w-24 object-contain drop-shadow-[0_0_16px_rgba(249,115,22,0.35)]"
            />
          </div>
        </div>
        <div className="w-64 text-center">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="emt-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-orange-500 to-cyan-400" />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

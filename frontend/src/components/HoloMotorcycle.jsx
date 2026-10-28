import React from "react";
import Tilt3D from "./Tilt3D";
import MotoIllustration from "./MotoIllustration";

/**
 * Ana sayfa sahnesi: orijinal motosiklet çizimi, cam HUD panelleri ve modül etiketleri.
 * Etiket değerleri yoktur; yalnızca modül adları gösterilir. Dekoratiftir.
 */
const MODULES = [
  { label: "İş Emri Yönetimi", pos: "left-[-2%] top-[8%]", dot: "cyan" },
  { label: "Periyodik Bakım", pos: "right-[-2%] top-[2%]", dot: "orange" },
  { label: "Tahsilat ve Cari Hesap", pos: "right-[2%] bottom-[8%] hidden sm:block", dot: "orange" },
  { label: "Stok ve Yedek Parça", pos: "left-[4%] bottom-[4%] hidden md:block", dot: "cyan" },
];

export default function HoloMotorcycle({ className = "" }) {
  return (
    <div className={`relative mx-auto w-full max-w-xl ${className}`}>
      <div aria-hidden="true" className="absolute inset-x-[8%] -bottom-4 h-16 rounded-[50%] bg-orange-500/25 blur-2xl" />
      <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-400/15 via-transparent to-orange-500/20 blur-2xl" />

      <Tilt3D max={5} lift={6} className="emt-glass-dark relative overflow-hidden rounded-2xl px-4 pb-6 pt-8 sm:px-8">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="emt-float">
          <MotoIllustration className="relative z-[1] h-auto w-full drop-shadow-[0_0_24px_rgba(34,211,238,0.3)]" />
        </div>
      </Tilt3D>

      {MODULES.map((m, i) => (
        <span
          key={m.label}
          aria-hidden="true"
          className={`emt-glass-dark absolute ${m.pos} flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium text-white shadow-lg`}
          style={{ animation: `emt-float ${7 + i}s ease-in-out infinite`, animationDelay: `${-i * 1.3}s` }}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${m.dot === "cyan" ? "bg-cyan-300 shadow-[0_0_8px_#67e8f9]" : "bg-orange-400 shadow-[0_0_8px_#fb923c]"}`} />
          {m.label}
        </span>
      ))}
    </div>
  );
}

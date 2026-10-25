import React from "react";
import { useAuth } from "../context/AuthContext";
import { BikeSvg, getBikeDesign } from "./MotorcycleIllustration";

// Sabit arıza bölgeleri (sıra buton listesinin sırasıdır).
export const FAULT_ZONES = [
  "Ön Fren", "Arka Fren", "Ön Teker", "Arka Teker", "Motor", "Şanzıman",
  "Egzoz", "Elektrik", "Akü", "Yakıt Sistemi", "Süspansiyon",
];

const GROUND_Y = 186;
const HOTSPOT_R = 10; // 20px çap (400x220 çizim alanında)
const BRAND = "#F97316";

// Motor tipinin çizim tanımından (tekerlek yarıçapı r, ön/arka tekerlek x'i fx/rx) türetilen yardımcılar.
const cyOf = (d) => GROUND_Y - d.r;          // tekerlek merkezi y
const midOf = (d) => (d.rx + d.fx) / 2;      // iki tekerleğin orta noktası (motor/şanzıman bölgesi)

// Her bölge için konum fonksiyonu: [x, y] döndürür.
const ZONE_POS = {
  "Ön Fren":       (d) => [d.fx + 0.5 * d.r, cyOf(d) - 0.5 * d.r],   // ön tekerlek üst-sağ (disk)
  "Ön Teker":      (d) => [d.fx - 0.5 * d.r, cyOf(d) + 0.5 * d.r],   // ön tekerlek alt-sol (lastik)
  "Arka Fren":     (d) => [d.rx + 0.5 * d.r, cyOf(d) - 0.5 * d.r],   // arka tekerlek üst-sağ (disk)
  "Arka Teker":    (d) => [d.rx - 0.5 * d.r, cyOf(d) + 0.5 * d.r],   // arka tekerlek alt-sol (lastik)
  "Motor":         (d) => [midOf(d), cyOf(d) - 0.35 * d.r],           // gövde ortası
  "Şanzıman":      (d) => [midOf(d) + 10, cyOf(d) + 10],              // motorun hemen altı
  "Egzoz":         (d) => [d.rx + 0.45 * (midOf(d) - d.rx) + 0.8 * d.r, GROUND_Y - 14], // arka yarının altı
  "Elektrik":      (d) => [d.fx - 0.75 * d.r, cyOf(d) - 1.4 * d.r],   // far/ön gövde bölgesi
  "Akü":           (d) => [d.rx + 0.5 * (midOf(d) - d.rx), cyOf(d) - 1.2 * d.r], // koltuk altı
  "Yakıt Sistemi": (d) => [midOf(d) - 8, cyOf(d) - 1.4 * d.r],        // depo
  "Süspansiyon":   (d) => [d.fx - 0.62 * d.r, cyOf(d) - 0.5 * d.r],   // ön çatal orta noktası
};

export default function FaultDiagram({ selected = [], onToggle, motoType }) {
  const { tenant } = useAuth() || {};
  const customZones = tenant?.custom_fault_zones || [];
  const design = getBikeDesign(motoType);
  const isSel = (k) => selected.includes(k);

  // Sabit bölgeler motor tipine göre konumlanır; kiracı bölgeleri sabit cx/cy varsa çizilir, yoksa yalnızca buton olur.
  const builtIn = FAULT_ZONES.map((key) => {
    const [cx, cy] = ZONE_POS[key](design);
    return { key, cx, cy };
  });
  const allZones = [...builtIn, ...customZones];
  const placed = allZones.filter((z) => Number.isFinite(z.cx) && Number.isFinite(z.cy));

  return (
    <div className="w-full">
      <div className="relative w-full">
        <BikeSvg design={design} label={motoType || "Motosiklet"} />
        <svg
          viewBox="0 0 400 220"
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {placed.map((z) => (
            <g
              key={z.key}
              onClick={() => onToggle(z.key)}
              className="cursor-pointer"
              role="button"
              aria-label={z.key}
              aria-pressed={isSel(z.key)}
            >
              <circle
                cx={z.cx} cy={z.cy} r={HOTSPOT_R}
                fill={isSel(z.key) ? BRAND : "#FFFFFF"}
                stroke={isSel(z.key) ? "#C2410C" : "#64748B"}
                strokeWidth="2"
                opacity="0.92"
                data-testid={`fault-zone-${z.key}`}
              />
              {isSel(z.key) && (
                <text x={z.cx} y={z.cy + 4} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold">
                  !
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {allZones.map((z) => (
          <button
            type="button"
            key={z.key}
            onClick={() => onToggle(z.key)}
            data-testid={`fault-btn-${z.key}`}
            className={`text-xs px-3 py-1.5 rounded-md border font-body transition-colors duration-150 ${
              isSel(z.key)
                ? "bg-orange-50 border-orange-300 text-orange-700 font-semibold"
                : "bg-white border-slate-200 text-slate-700 hover:border-slate-400"
            }`}
          >
            {z.key}
          </button>
        ))}
      </div>
    </div>
  );
}

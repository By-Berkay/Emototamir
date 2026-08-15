import React from "react";
import { useAuth } from "../context/AuthContext";

export const FAULT_ZONES = [
  { key: "Ön Fren", cx: 60, cy: 150 },
  { key: "Arka Fren", cx: 220, cy: 150 },
  { key: "Ön Teker", cx: 60, cy: 165 },
  { key: "Arka Teker", cx: 220, cy: 165 },
  { key: "Motor", cx: 145, cy: 130 },
  { key: "Şanzıman", cx: 165, cy: 145 },
  { key: "Egzoz", cx: 210, cy: 135 },
  { key: "Elektrik", cx: 125, cy: 100 },
  { key: "Akü", cx: 155, cy: 108 },
  { key: "Yakıt Sistemi", cx: 115, cy: 118 },
  { key: "Süspansiyon", cx: 90, cy: 140 },
];

export default function FaultDiagram({ selected = [], onToggle }) {
  const { tenant } = useAuth() || {};
  const customZones = tenant?.custom_fault_zones || [];
  const allZones = [...FAULT_ZONES, ...customZones];
  const isSel = (k) => selected.includes(k);

  return (
    <div className="w-full">
      <svg viewBox="0 0 280 200" className="w-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="280" height="200" fill="#F1F5F9" rx="8" />
        {/* Motorcycle silhouette */}
        <path d="M55 148 Q95 128 130 122 L175 118 Q215 122 220 148"
              fill="#CBD5E1" stroke="#0F172A" strokeWidth="2" />
        <path d="M130 122 L130 92 L165 92" stroke="#0F172A" strokeWidth="4" fill="none" />
        <line x1="165" y1="92" x2="180" y2="82" stroke="#0F172A" strokeWidth="4" />
        <line x1="150" y1="82" x2="185" y2="82" stroke="#0F172A" strokeWidth="4" />
        <rect x="140" y="100" width="45" height="18" rx="3" fill="#0F172A" />
        <circle cx="60" cy="150" r="26" fill="none" stroke="#0F172A" strokeWidth="4" />
        <circle cx="220" cy="150" r="26" fill="none" stroke="#0F172A" strokeWidth="4" />

        {allZones.map((z) => (
          <g key={z.key} onClick={() => onToggle(z.key)} className="cursor-pointer">
            <circle
              cx={z.cx} cy={z.cy} r={9}
              fill={isSel(z.key) ? "#EF4444" : "#FFFFFF"}
              stroke={isSel(z.key) ? "#B91C1C" : "#64748B"}
              strokeWidth="2"
              opacity="0.9"
              data-testid={`fault-zone-${z.key}`}
            />
            {isSel(z.key) && (
              <text x={z.cx} y={z.cy + 3} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">
                !
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {allZones.map((z) => (
          <button
            type="button"
            key={z.key}
            onClick={() => onToggle(z.key)}
            data-testid={`fault-btn-${z.key}`}
            className={`text-xs px-3 py-1.5 rounded-md border font-body transition-colors duration-150 ${
              isSel(z.key)
                ? "bg-red-50 border-red-300 text-red-700 font-semibold"
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

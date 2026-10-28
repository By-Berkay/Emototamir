import React, { useId } from "react";

/**
 * Orijinal vektör çizim: naked tip sport motosiklet (yan görünüm).
 * Referans görsellerdeki stilden ilham alınmıştır; hiçbir görsel kopyalanmamıştır.
 * zones: opsiyonel arıza/bakım işaretçileri (viewBox koordinatlarında).
 */
export default function MotoIllustration({ className = "", zones = [], showGround = true }) {
  const uid = useId().replace(/:/g, "");
  const tankId = `tank-${uid}`;
  const bodyId = `body-${uid}`;
  const glowId = `glow-${uid}`;

  return (
    <svg viewBox="0 0 640 360" className={className} role="img" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={tankId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22d3ee" floodOpacity="0.55" />
        </filter>
        <radialGradient id={`ground-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      {showGround && <ellipse cx="320" cy="338" rx="260" ry="18" fill={`url(#ground-${uid})`} />}

      <g filter={`url(#${glowId})`}>
        {/* Egzoz */}
        <path d="M338 236 L252 240 C232 242 222 256 228 268 L246 276 L346 268" fill="none" stroke="#94a3b8" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        {/* Arka salıncak kolu */}
        <path d="M150 252 L300 236" stroke="#cbd5e1" strokeWidth="9" strokeLinecap="round" />
        {/* Ana şasi */}
        <path d="M424 150 L336 198 L250 186 L196 206" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Ön çatal */}
        <path d="M468 178 L500 252" stroke="#e2e8f0" strokeWidth="7" strokeLinecap="round" />
        <path d="M480 172 L510 252" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Tekerlekler */}
      {[[150, 252], [500, 252]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="74" fill="none" stroke="#0f172a" strokeWidth="18" />
          <circle cx={cx} cy={cy} r="74" fill="none" stroke="#1e293b" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="58" fill="none" stroke="#67e8f9" strokeWidth="2.5" opacity="0.85" />
          {[0, 45, 90, 135].map((a) => (
            <line key={a} x1={cx} y1={cy - 56} x2={cx} y2={cy + 56} stroke="#475569" strokeWidth="3" transform={`rotate(${a} ${cx} ${cy})`} />
          ))}
          <circle cx={cx} cy={cy} r="14" fill="#cbd5e1" />
          <circle cx={cx} cy={cy} r="5" fill="#0f172a" />
          {/* Fren diski */}
          <circle cx={cx} cy={cy} r="38" fill="none" stroke="#f97316" strokeWidth="2" opacity={i ? "0.9" : "0.35"} />
        </g>
      ))}

      <g filter={`url(#${glowId})`}>
        {/* Motor bloğu */}
        <path d="M272 206 L346 200 L352 256 L282 262 Z" fill={`url(#${bodyId})`} stroke="#7dd3fc" strokeWidth="2" />
        <rect x="290" y="216" width="46" height="26" rx="5" fill="#0f172a" opacity="0.7" />
        {/* Arka kuyruk */}
        <path d="M304 124 L232 150 C224 154 226 166 236 166 L304 160 Z" fill={`url(#${bodyId})`} />
        {/* Koltuk */}
        <path d="M300 122 C330 112 362 116 380 126 L366 140 L302 142 Z" fill="#0b1220" stroke="#334155" strokeWidth="2" />
        {/* Depo */}
        <path d="M330 140 C344 116 396 108 428 124 C442 132 440 150 424 156 L344 172 Z" fill={`url(#${tankId})`} />
        {/* Yan kaplama */}
        <path d="M344 170 L424 156 L440 190 L352 204 Z" fill={`url(#${bodyId})`} opacity="0.85" />
        {/* Ön kaporta ve far */}
        <path d="M424 150 C440 122 472 116 488 134 L502 192 C498 202 482 206 470 198 L432 182 Z" fill={`url(#${bodyId})`} />
        <ellipse cx="486" cy="158" rx="12" ry="7" fill="#ecfeff" />
        {/* Gidon ve dikiz aynası */}
        <path d="M424 130 L414 108 L432 102" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="410" cy="98" rx="11" ry="5" fill="none" stroke="#cbd5e1" strokeWidth="3" />
      </g>

      {/* Arıza / bakım işaretçileri */}
      {zones.map((z) => (
        <g key={z.id}>
          <circle cx={z.x} cy={z.y} r="12" fill="#f97316" opacity="0.18" />
          <circle cx={z.x} cy={z.y} r="5" fill="#fb923c" stroke="#fff7ed" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

/** Ekspertiz bölgeleri için hazır işaretçi konumları (çizim koordinatları). */
export const MOTO_ZONES = [
  { id: "engine", label: "Motor", x: 318, y: 228 },
  { id: "front-brake", label: "Ön fren", x: 500, y: 252 },
  { id: "rear-wheel", label: "Arka lastik", x: 150, y: 178 },
  { id: "exhaust", label: "Egzoz", x: 236, y: 262 },
  { id: "light", label: "Far", x: 486, y: 158 },
];

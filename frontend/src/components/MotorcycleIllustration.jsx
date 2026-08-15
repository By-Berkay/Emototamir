import React from "react";

// Simple stylized SVG illustrations per motorcycle type
export default function MotorcycleIllustration({ type = "Naked", className = "" }) {
  const t = (type || "Naked").toLowerCase();
  const stroke = "#0F172A";
  const accent = "#F97316";
  const bg = "#F1F5F9";

  const wheels = (
    <>
      <circle cx="60" cy="150" r="26" fill="none" stroke={stroke} strokeWidth="4" />
      <circle cx="60" cy="150" r="10" fill={stroke} />
      <circle cx="220" cy="150" r="26" fill="none" stroke={stroke} strokeWidth="4" />
      <circle cx="220" cy="150" r="10" fill={stroke} />
    </>
  );

  let body = null;
  if (t.includes("scooter") || t.includes("elektrik")) {
    body = (
      <>
        <path d="M55 148 Q90 140 120 140 L180 140 Q220 148 220 148" stroke={stroke} strokeWidth="4" fill="none" />
        <path d="M120 140 L120 100 Q135 82 165 90 L170 105" stroke={stroke} strokeWidth="4" fill="none" />
        <path d="M95 140 Q90 100 130 92 L165 90" fill={accent} stroke={stroke} strokeWidth="2" />
        <path d="M155 100 L200 108 L210 145 L110 145 Z" fill={accent} stroke={stroke} strokeWidth="2" opacity="0.85" />
        <line x1="170" y1="105" x2="165" y2="80" stroke={stroke} strokeWidth="4" />
        <line x1="155" y1="72" x2="180" y2="72" stroke={stroke} strokeWidth="4" />
      </>
    );
  } else if (t.includes("sport") || t.includes("cafe")) {
    body = (
      <>
        <path d="M55 148 L100 120 L170 108 L215 130 L220 148" fill={accent} stroke={stroke} strokeWidth="2" />
        <path d="M175 108 L215 92 L220 108 L200 118" fill={stroke} />
        <line x1="175" y1="108" x2="150" y2="90" stroke={stroke} strokeWidth="4" />
        <line x1="150" y1="90" x2="130" y2="88" stroke={stroke} strokeWidth="4" />
        <path d="M100 125 L60 148" stroke={stroke} strokeWidth="4" />
      </>
    );
  } else if (t.includes("cruiser") || t.includes("chopper")) {
    body = (
      <>
        <path d="M55 148 Q95 130 140 130 L200 130 Q220 138 220 148" stroke={stroke} strokeWidth="4" fill={accent} />
        <path d="M110 130 L110 100 L140 90 L155 100" stroke={stroke} strokeWidth="4" fill="none" />
        <rect x="140" y="105" width="55" height="20" rx="4" fill={stroke} />
        <path d="M155 100 L180 88" stroke={stroke} strokeWidth="4" />
        <line x1="60" y1="150" x2="30" y2="130" stroke={stroke} strokeWidth="3" />
      </>
    );
  } else if (t.includes("touring") || t.includes("adventure") || t.includes("enduro") || t.includes("cross")) {
    body = (
      <>
        <path d="M55 148 Q90 122 130 118 L180 115 Q215 118 220 148" fill={accent} stroke={stroke} strokeWidth="2" />
        <path d="M130 118 L130 78 L165 78 L165 108" fill="none" stroke={stroke} strokeWidth="4" />
        <rect x="155" y="60" width="28" height="22" fill={stroke} />
        <line x1="165" y1="108" x2="155" y2="82" stroke={stroke} strokeWidth="4" />
        <path d="M215 118 L235 100" stroke={stroke} strokeWidth="4" />
      </>
    );
  } else {
    // Naked / Diğer
    body = (
      <>
        <path d="M55 148 Q95 128 130 122 L175 118 Q215 122 220 148" fill={accent} stroke={stroke} strokeWidth="2" />
        <path d="M130 122 L130 92 L165 92" stroke={stroke} strokeWidth="4" fill="none" />
        <line x1="165" y1="92" x2="180" y2="82" stroke={stroke} strokeWidth="4" />
        <line x1="150" y1="82" x2="185" y2="82" stroke={stroke} strokeWidth="4" />
        <rect x="140" y="100" width="45" height="18" rx="3" fill={stroke} />
      </>
    );
  }

  return (
    <svg viewBox="0 0 280 190" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="280" height="190" fill={bg} rx="8" />
      {body}
      {wheels}
      <text x="140" y="180" textAnchor="middle" fill="#64748B" fontSize="11" fontFamily="ui-sans-serif">
        {type}
      </text>
    </svg>
  );
}

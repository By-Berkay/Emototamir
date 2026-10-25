import React from "react";
import { API } from "../lib/api";
import AuthedImage from "./AuthedImage";
import { useAuth } from "../context/AuthContext";

/**
 * Motor tipi çizimi. Kiracı özel bir görsel yüklediyse (custom_moto_images) onu gösterir;
 * yoksa tutarlı, çizgi-tabanlı SVG ilüstrasyon kullanır. Tüm tipler aynı çizim sistemini
 * paylaşır: ortak tekerlek/zemin ve tipe özgü tekerlek boyu, gövde ve gidon tanımları.
 */

const INK = "#0F172A";
const ACCENT = "#F97316";
const SOFT = "#CBD5E1";
const GREEN = "#22C55E";
const GROUND_Y = 186;

// Parça türleri: { p: yol (dolgu f ya da çizgi s/w), c: [cx,cy,r] daire, r: [x,y,w,h,rx] dikdörtgen }
const DESIGNS = {
  naked: {
    r: 34, fx: 300, rx: 104,
    frame: "M104 152 L170 150 L212 120 L262 118",
    parts: [
      { p: "M146 112 Q186 92 232 102 L240 118 L146 122 Z", f: ACCENT },
      { p: "M116 106 L146 98 L148 114 L112 118 Z", f: INK },
      { p: "M258 118 L300 152", s: INK, w: 6 },
      { p: "M258 96 L270 86", s: INK, w: 5 },
      { c: [274, 104, 8], f: ACCENT },
    ],
  },
  sport: {
    r: 32, fx: 300, rx: 104,
    frame: "M104 154 L168 150 L214 120 L258 124",
    parts: [
      { p: "M226 100 Q268 90 290 120 L270 136 L222 128 Z", f: ACCENT },
      { p: "M160 108 Q196 92 230 104 L226 122 L160 122 Z", f: INK },
      { p: "M124 112 L158 102 L162 116 L120 120 Z", f: INK },
      { p: "M262 128 L300 154", s: INK, w: 6 },
      { p: "M262 124 L276 116", s: INK, w: 5 },
    ],
  },
  touring: {
    r: 34, fx: 300, rx: 104,
    frame: "M104 152 L172 150 L216 120 L262 118",
    parts: [
      { p: "M262 96 Q284 84 296 104 L282 120 L258 118 Z", f: SOFT },
      { p: "M150 106 Q196 88 238 102 L242 122 L150 124 Z", f: ACCENT },
      { p: "M112 110 L156 102 L158 118 L108 120 Z", f: INK },
      { r: [114, 128, 40, 26, 5], f: "#334155" },
      { p: "M258 118 L300 152", s: INK, w: 6 },
      { p: "M258 96 L270 86", s: INK, w: 5 },
    ],
  },
  adventure: {
    r: 40, fx: 298, rx: 102,
    frame: "M102 146 L170 146 L210 120 L262 118",
    parts: [
      { p: "M146 104 Q192 82 240 98 L240 122 L146 124 Z", f: ACCENT },
      { p: "M112 102 L156 90 L158 106 L110 112 Z", f: INK },
      { p: "M262 124 Q282 132 292 116 L284 102 L262 110 Z", f: INK },
      { p: "M262 118 L298 146", s: INK, w: 7 },
      { p: "M258 100 L274 92", s: INK, w: 5 },
    ],
  },
  enduro: {
    r: 38, fx: 300, rx: 102,
    frame: "M102 148 L168 146 L206 118 L256 116",
    parts: [
      { p: "M150 108 Q186 94 218 106 L214 120 L150 122 Z", f: ACCENT },
      { p: "M116 108 L160 102 L162 114 L114 118 Z", f: INK },
      { p: "M276 108 Q300 94 322 108", s: INK, w: 4 },
      { p: "M258 118 L300 148", s: INK, w: 6 },
      { p: "M254 104 L266 94", s: INK, w: 5 },
    ],
  },
  cross: {
    r: 36, fx: 300, rx: 102,
    frame: "M102 150 L168 148 L206 120 L258 118",
    parts: [
      { p: "M150 110 Q184 98 214 108 L212 120 L150 122 Z", f: ACCENT },
      { p: "M124 108 L160 104 L160 116 L120 118 Z", f: INK },
      { p: "M256 118 L300 150", s: INK, w: 6 },
      { p: "M252 104 L264 96", s: INK, w: 5 },
    ],
  },
  chopper: {
    r: 30, fx: 330, rx: 100,
    frame: "M100 156 L170 154 L200 128 L250 126",
    parts: [
      { p: "M160 112 Q192 104 214 112 L212 122 L160 122 Z", f: ACCENT },
      { p: "M122 112 L166 106 L168 116 L120 120 Z", f: INK },
      { p: "M262 124 L330 156", s: INK, w: 6 },
      { p: "M306 110 L296 60 L304 58", s: INK, w: 5, fill: "none" },
    ],
  },
  cruiser: {
    r: 32, fx: 296, rx: 104,
    frame: "M104 154 L180 152 L224 128 L262 126",
    parts: [
      { p: "M150 114 Q190 104 226 112 L228 124 L150 124 Z", f: ACCENT },
      { p: "M110 112 L170 106 L172 118 L106 122 Z", f: INK },
      { p: "M262 126 L296 154", s: INK, w: 7 },
      { p: "M258 108 Q270 100 282 106", s: INK, w: 5 },
    ],
  },
  "cafe racer": {
    r: 33, fx: 300, rx: 104,
    frame: "M104 152 L168 150 L212 120 L256 118",
    parts: [
      { p: "M166 108 Q196 96 222 104 L222 118 L166 120 Z", f: ACCENT },
      { p: "M136 104 Q160 94 184 100 L184 112 L134 116 Z", f: INK },
      { p: "M104 152 Q100 116 124 104", s: INK, w: 4 },
      { p: "M258 118 L300 152", s: INK, w: 6 },
      { p: "M252 116 L268 110", s: INK, w: 5 },
      { c: [272, 104, 7], f: INK },
    ],
  },
  scooter: {
    r: 26, fx: 300, rx: 100,
    frame: null,
    parts: [
      { p: "M122 150 Q118 110 168 104 L236 104 L268 98 L280 126 L252 142 L142 148 Z", f: ACCENT },
      { p: "M168 96 L222 94 L224 104 L168 106 Z", f: INK },
      { p: "M268 98 L290 66 L300 68 L286 104 Z", f: INK },
      { p: "M292 68 L300 58", s: INK, w: 5 },
      { c: [300, 80, 6], f: ACCENT },
    ],
  },
  "maxi scooter": {
    r: 28, fx: 302, rx: 100,
    frame: null,
    parts: [
      { p: "M120 150 Q112 104 170 100 L244 100 L276 92 L290 124 L258 146 L136 150 Z", f: ACCENT },
      { p: "M160 92 L226 90 L228 100 L160 102 Z", f: INK },
      { p: "M270 94 Q292 60 304 66 L292 104 Z", f: SOFT },
      { p: "M294 66 L304 56", s: INK, w: 5 },
    ],
  },
  elektrikli: {
    r: 34, fx: 300, rx: 104,
    frame: "M104 152 L170 150 L212 120 L262 118",
    parts: [
      { r: [148, 112, 74, 24, 6], f: GREEN },
      { p: "M226 102 L212 124 L226 124 L218 144 L240 116 L226 116 Z", f: "#FFFFFF" },
      { p: "M112 104 L150 98 L152 112 L110 116 Z", f: INK },
      { p: "M258 118 L300 152", s: INK, w: 6 },
      { p: "M258 96 L270 86", s: INK, w: 5 },
      { c: [274, 104, 8], f: ACCENT },
    ],
  },
};

const TYPE_ALIASES = {
  "diğer": "naked",
  "cross": "cross",
};

function Wheel({ cx, cy, r }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={INK} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke="#94A3B8" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r * 0.16} fill="#E2E8F0" />
    </g>
  );
}

function Part({ p }) {
  if (p.c) return <circle cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.f} />;
  if (p.r) {
    const [x, y, w, h, rx] = p.r;
    return <rect x={x} y={y} width={w} height={h} rx={rx} fill={p.f} />;
  }
  if (p.s) {
    return (
      <path d={p.p} fill={p.fill || "none"} stroke={p.s} strokeWidth={p.w || 4}
            strokeLinecap="round" strokeLinejoin="round" />
    );
  }
  return <path d={p.p} fill={p.f} />;
}

function BikeSvg({ design, label }) {
  const { r, rx, fx, frame, parts } = design;
  const rearCy = GROUND_Y - r;
  const frontCy = GROUND_Y - r;
  return (
    <svg viewBox="0 0 400 220" className="w-full h-full" role="img" aria-label={label}>
      <rect width="400" height="220" rx="16" fill="#F8FAFC" />
      <ellipse cx="200" cy={GROUND_Y + 2} rx="150" ry="7" fill={INK} opacity="0.08" />
      <Wheel cx={rx} cy={rearCy} r={r} />
      <Wheel cx={fx} cy={frontCy} r={r} />
      {frame && (
        <path d={frame} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {parts.map((p, i) => <Part key={i} p={p} />)}
    </svg>
  );
}

export default function MotorcycleIllustration({ type = "Naked", className = "" }) {
  const { tenant } = useAuth() || {};
  const custom = tenant?.custom_moto_images?.[type];
  const key = (type || "").toLowerCase().trim();
  const design = DESIGNS[TYPE_ALIASES[key] || key] || DESIGNS.naked;
  if (custom) {
    const token = localStorage.getItem("token");
    return (
      <div className={className}>
        <AuthedImage path={custom} alt={type}
             className="w-full h-full object-contain rounded-md bg-slate-100" />
      </div>
    );
  }
  return (
    <div className={className}>
      <BikeSvg design={design} label={type} />
    </div>
  );
}

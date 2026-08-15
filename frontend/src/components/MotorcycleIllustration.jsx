import React from "react";
import { API } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/**
 * Uses tenant custom_moto_images if set for the type; otherwise renders SVG silhouette.
 */

const VB = "0 0 400 220";
const BG = "#F1F5F9";
const FG = "#0F172A";
const HL = "#F97316";

const Wheels = ({ frontCX = 78, backCX = 322, cy = 168, r = 34, knobby = false }) => (
  <g>
    {[frontCX, backCX].map((cx) => (
      <g key={cx}>
        {knobby && Array.from({ length: 18 }).map((_, i) => {
          const a = (i * 360) / 18;
          return <rect key={i} x={cx - 4} y={cy - r - 5} width="8" height="10" fill={FG} transform={`rotate(${a} ${cx} ${cy})`} />;
        })}
        <circle cx={cx} cy={cy} r={r} fill={FG} />
        <circle cx={cx} cy={cy} r={r - 6} fill={BG} />
        {/* spokes */}
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={cx} y1={cy} x2={cx + Math.cos((a * Math.PI) / 180) * (r - 8)} y2={cy + Math.sin((a * Math.PI) / 180) * (r - 8)}
                stroke={FG} strokeWidth="2" />
        ))}
        {[0, 45, 90, 135].map((a) => (
          <line key={"n"+a} x1={cx} y1={cy} x2={cx - Math.cos((a * Math.PI) / 180) * (r - 8)} y2={cy - Math.sin((a * Math.PI) / 180) * (r - 8)}
                stroke={FG} strokeWidth="2" />
        ))}
        <circle cx={cx} cy={cy} r={7} fill={FG} />
        <circle cx={cx} cy={cy} r={3} fill={BG} />
      </g>
    ))}
    <line x1="10" y1="205" x2="390" y2="205" stroke={FG} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
  </g>
);

// ============================================================================
// SCOOTER  — small wheels, step-through, upright rider
// ============================================================================
function Scooter() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Rear body enclosure */}
      <path fill={FG} d="M148 168 Q165 100 235 96 L295 100 Q315 108 322 140 L315 168 L235 172 L165 172 Z" />
      {/* Under seat storage */}
      <path fill={FG} d="M230 96 L295 100 L320 145 L235 148 Z" />
      {/* Seat */}
      <path fill={FG} d="M170 96 L245 90 L255 108 L172 116 Z" />
      {/* Front leg shield */}
      <path fill={FG} d="M78 168 L88 100 Q95 80 130 76 L145 88 L138 155 L108 158 L88 168 Z" />
      {/* Floor board */}
      <path fill={FG} d="M100 155 L172 148 L172 168 L108 168 Z" />
      {/* Handlebar column */}
      <path fill={FG} d="M120 76 L130 42 L155 40 L152 76 L140 82 Z" />
      {/* Handlebar */}
      <path fill={FG} d="M120 42 L165 32 L172 42 L160 52 L128 52 Z" />
      {/* Mirror */}
      <circle cx="168" cy="26" r="8" fill={FG} />
      <line x1="162" y1="34" x2="150" y2="46" stroke={FG} strokeWidth="3" />
      {/* Headlight */}
      <ellipse cx="118" cy="88" rx="14" ry="10" fill={FG} />
      <ellipse cx="118" cy="88" rx="9" ry="6" fill={HL} />
      <Wheels frontCX="88" backCX="285" r="30" cy="172" />
    </svg>
  );
}

// ============================================================================
// MAXI SCOOTER  — larger, windshield, top case
// ============================================================================
function MaxiScooter() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Rear body */}
      <path fill={FG} d="M140 172 Q160 90 240 85 L305 92 Q332 105 340 145 L335 175 L235 178 L162 178 Z" />
      {/* Big seat */}
      <path fill={FG} d="M160 88 L275 82 L292 108 L170 116 Z" />
      {/* Top case */}
      <path fill={FG} d="M220 62 L285 62 L295 92 L215 96 Z" />
      <rect x="230" y="70" width="55" height="18" fill={BG} opacity="0.2" rx="2" />
      {/* Front fairing tall */}
      <path fill={FG} d="M78 172 L86 76 Q94 42 135 38 L155 55 L148 158 L112 160 L88 172 Z" />
      {/* Windshield */}
      <path fill={FG} opacity="0.55" d="M108 62 L155 20 L165 30 L120 76 Z" />
      {/* Handlebar */}
      <path fill={FG} d="M138 42 L175 30 L182 42 L172 55 L145 60 Z" />
      {/* Headlight cluster */}
      <ellipse cx="118" cy="82" rx="16" ry="10" fill={FG} />
      <ellipse cx="118" cy="82" rx="10" ry="6" fill={HL} />
      {/* Mirror */}
      <circle cx="180" cy="18" r="8" fill={FG} />
      <line x1="174" y1="26" x2="160" y2="42" stroke={FG} strokeWidth="3" />
      <Wheels frontCX="90" backCX="305" r="34" cy="172" />
    </svg>
  );
}

// ============================================================================
// NAKED  — visible engine, exposed frame, upright bars
// ============================================================================
function Naked() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Fork tube going down to front wheel */}
      <path fill={FG} d="M258 90 L285 105 L88 168 L78 158 L245 78 Z" />
      {/* Tank */}
      <path fill={FG} d="M175 100 L255 88 L268 118 L180 128 Z" />
      {/* Seat + rear cowl */}
      <path fill={FG} d="M115 118 L175 108 L182 128 L172 145 L118 145 Z" />
      <path fill={FG} d="M85 118 L120 108 L128 130 L82 138 Z" />
      {/* Engine block prominent */}
      <path fill={FG} d="M188 122 L272 122 L284 168 L186 168 Z" />
      <path fill={BG} opacity="0.15" d="M198 130 L268 130 L276 160 L192 160 Z" />
      {/* Cylinder head fins */}
      {[130, 138, 146].map((y) => <line key={y} x1="198" y1={y} x2="268" y2={y} stroke={BG} strokeWidth="1.5" opacity="0.4" />)}
      {/* Headlight */}
      <circle cx="298" cy="98" r="18" fill={FG} />
      <circle cx="298" cy="98" r="12" fill={HL} opacity="0.9" />
      {/* Handlebar */}
      <path fill={FG} d="M290 78 L340 62 L346 74 L296 92 Z" />
      <path fill={FG} d="M290 78 L245 70 L242 82 L288 92 Z" />
      {/* Rear stub */}
      <path fill={FG} d="M78 118 L92 68 L105 68 L98 128 Z" />
      {/* Exhaust */}
      <path fill={FG} d="M282 158 L360 148 L365 162 L288 172 Z" />
      <Wheels />
    </svg>
  );
}

// ============================================================================
// SPORT  — aggressive full fairing, low profile, big rear
// ============================================================================
function Sport() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Full fairing front */}
      <path fill={FG} d="M228 78 Q288 68 335 92 L348 128 L338 158 L295 165 L268 145 L245 128 L222 118 L215 98 Z" />
      {/* Windscreen */}
      <path fill={FG} opacity="0.55" d="M275 62 L328 52 L335 68 L285 86 Z" />
      {/* Headlight slit */}
      <path fill={HL} d="M305 92 L340 100 L338 110 L302 104 Z" opacity="0.85" />
      <path fill={BG} d="M310 98 L332 104 L332 106 L310 102 Z" />
      {/* Fuel tank */}
      <path fill={FG} d="M162 92 L228 78 L238 118 L165 128 Z" />
      {/* Rear tail sharp */}
      <path fill={FG} d="M85 128 L165 96 L170 118 L155 138 L102 148 Z" />
      <path fill={FG} d="M78 135 L112 118 L120 145 L82 152 Z" />
      {/* Under-tail exhaust */}
      <path fill={FG} d="M55 155 L110 148 L108 168 L58 170 Z" />
      {/* Engine hidden by fairing but visible bottom */}
      <path fill={FG} d="M175 138 L272 138 L285 172 L172 172 Z" />
      {/* Highlight strip */}
      <path fill={HL} d="M170 108 L232 96 L235 108 L172 118 Z" opacity="0.9" />
      {/* Clip-on bar */}
      <path fill={FG} d="M255 82 L292 76 L298 88 L262 96 Z" />
      <Wheels />
    </svg>
  );
}

// ============================================================================
// TOURING / BAGGER  — big fairing, saddlebags, top case
// ============================================================================
function Touring() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Saddlebag */}
      <path fill={FG} d="M40 128 L118 128 L128 178 L38 180 Z" />
      <line x1="45" y1="145" x2="115" y2="145" stroke={BG} strokeWidth="1.5" opacity="0.35" />
      <line x1="45" y1="160" x2="115" y2="160" stroke={BG} strokeWidth="1.5" opacity="0.35" />
      {/* Top box */}
      <path fill={FG} d="M62 68 L142 68 L152 128 L58 130 Z" />
      <rect x="72" y="80" width="70" height="30" fill={BG} opacity="0.2" rx="3" />
      {/* Seat + rider */}
      <path fill={FG} d="M135 108 L215 100 L228 130 L142 138 Z" />
      {/* Tank */}
      <path fill={FG} d="M215 100 L285 90 L295 122 L222 130 Z" />
      {/* Engine block */}
      <path fill={FG} d="M188 130 L305 130 L318 168 L172 168 Z" />
      {/* Front fairing large */}
      <path fill={FG} d="M285 90 L335 68 L360 88 L358 138 L340 168 L318 168 L305 138 Z" />
      {/* Windshield tall */}
      <path fill={FG} opacity="0.55" d="M305 62 L348 32 L360 42 L322 78 Z" />
      {/* Antenna */}
      <line x1="358" y1="36" x2="358" y2="12" stroke={FG} strokeWidth="3" />
      <circle cx="358" cy="10" r="3" fill={FG} />
      {/* Headlight */}
      <ellipse cx="345" cy="102" rx="12" ry="10" fill={HL} opacity="0.9" />
      <Wheels frontCX="90" backCX="308" r="34" />
    </svg>
  );
}

// ============================================================================
// ADVENTURE  — tall stance, beak, panniers, knobby tires
// ============================================================================
function Adventure() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Pannier */}
      <path fill={FG} d="M40 115 L108 115 L118 172 L38 174 Z" />
      <line x1="45" y1="130" x2="105" y2="130" stroke={BG} strokeWidth="1.5" opacity="0.35" />
      <line x1="45" y1="148" x2="105" y2="148" stroke={BG} strokeWidth="1.5" opacity="0.35" />
      {/* Top box */}
      <path fill={FG} d="M55 60 L128 60 L140 115 L50 118 Z" />
      {/* Seat elevated */}
      <path fill={FG} d="M118 82 L210 76 L220 108 L128 116 Z" />
      {/* Tank */}
      <path fill={FG} d="M210 78 L275 68 L285 108 L215 118 Z" />
      {/* Engine */}
      <path fill={FG} d="M195 108 L295 108 L305 152 L182 152 Z" />
      <path fill={BG} opacity="0.15" d="M202 118 L288 118 L296 145 L188 145 Z" />
      {/* Tall front beak */}
      <path fill={FG} d="M275 68 L318 48 L342 60 L340 108 L322 138 L295 128 L282 108 Z" />
      {/* Beak protrusion */}
      <path fill={FG} d="M295 128 L360 120 L365 138 L305 148 Z" />
      {/* Tall windshield */}
      <path fill={FG} opacity="0.6" d="M298 42 L338 8 L352 20 L318 60 Z" />
      {/* Handlebar wide */}
      <path fill={FG} d="M285 42 L342 28 L348 40 L292 55 Z" />
      {/* Hand guards */}
      <path fill={FG} d="M270 45 L295 42 L292 55 L268 58 Z" />
      <path fill={FG} d="M328 32 L352 30 L350 44 L326 46 Z" />
      {/* Headlight */}
      <ellipse cx="325" cy="98" rx="14" ry="10" fill={HL} opacity="0.9" />
      <Wheels frontCX="90" backCX="322" r="36" knobby />
    </svg>
  );
}

// ============================================================================
// ENDURO / CROSS  — very tall stance, huge knobby tires, minimal body
// ============================================================================
function Enduro() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Number plate rear */}
      <path fill={FG} d="M55 78 L118 72 L118 118 L48 122 Z" />
      <text x="82" y="105" fill={BG} fontSize="22" fontWeight="900" textAnchor="middle" opacity="0.6">42</text>
      {/* Slim seat */}
      <path fill={FG} d="M100 72 L200 60 L210 80 L108 92 Z" />
      {/* Slim tank */}
      <path fill={FG} d="M195 62 L245 55 L252 92 L200 100 Z" />
      {/* Small engine */}
      <path fill={FG} d="M200 92 L268 92 L280 138 L188 138 Z" />
      <path fill={BG} opacity="0.15" d="M208 100 L262 100 L272 128 L196 128 Z" />
      {/* Tall front fender high above wheel */}
      <path fill={FG} d="M258 22 L295 18 L310 38 L282 45 L265 42 Z" />
      {/* Fork tube — long */}
      <path fill={FG} d="M275 32 L322 152 L305 158 L262 42 Z" />
      {/* High wide handlebar */}
      <path fill={FG} d="M258 22 L320 5 L328 18 L268 35 Z" />
      {/* Hand guards */}
      <path fill={FG} d="M250 12 L285 10 L282 26 L248 28 Z" />
      <path fill={FG} d="M300 3 L332 3 L330 17 L302 18 Z" />
      {/* Exhaust up-swept */}
      <path fill={FG} d="M78 92 L108 68 L120 78 L92 108 Z" />
      <Wheels frontCX="90" backCX="322" r="42" knobby />
    </svg>
  );
}

// ============================================================================
// CHOPPER  — extended forks, low seat, high bars
// ============================================================================
function Chopper() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Extended forks angling down to front wheel */}
      <path fill={FG} d="M275 50 L340 40 L350 55 L295 78 Z" />
      <path fill={FG} d="M280 55 L82 165 L60 158 L275 42 Z" />
      <path fill={FG} d="M292 68 L88 172 L68 168 L286 55 Z" />
      {/* Big teardrop tank */}
      <path fill={FG} d="M188 92 L268 82 L282 118 L192 128 Z" />
      {/* Big V-twin engine */}
      <path fill={FG} d="M195 118 L262 118 L275 168 L182 168 Z" />
      <path fill={BG} opacity="0.15" d="M205 128 L258 128 L268 158 L196 158 Z" />
      {/* Engine fins */}
      {[132, 140, 148].map((y) => <line key={y} x1="205" y1={y} x2="258" y2={y} stroke={BG} strokeWidth="1.5" opacity="0.5" />)}
      {/* High "ape" handlebars */}
      <path fill={FG} d="M292 68 L292 12 L318 12 L318 68 Z" />
      <path fill={FG} d="M262 12 L328 5 L332 18 L272 22 Z" />
      {/* Low seat */}
      <path fill={FG} d="M115 108 L192 100 L200 128 L118 132 Z" />
      {/* Sissy bar */}
      <path fill={FG} d="M108 108 L102 55 L118 55 L120 108 Z" />
      {/* Fishtail exhaust */}
      <path fill={FG} d="M255 145 L365 148 L370 165 L262 168 Z" />
      <Wheels frontCX="68" backCX="325" r="42" />
    </svg>
  );
}

// ============================================================================
// CRUISER  — low, wide, teardrop tank, forward controls
// ============================================================================
function Cruiser() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Front fender */}
      <path fill={FG} d="M55 148 L128 138 L138 168 L60 170 Z" />
      {/* Rear fender */}
      <path fill={FG} d="M262 138 L370 148 L365 172 L262 172 Z" />
      {/* Big teardrop tank */}
      <path fill={FG} d="M175 92 L262 78 L275 122 L182 132 Z" />
      {/* Cruiser seat */}
      <path fill={FG} d="M120 118 L185 110 L192 138 L125 140 Z" />
      {/* Sissy bar */}
      <path fill={FG} d="M115 118 L100 62 L118 62 L128 118 Z" />
      {/* Big V-twin engine */}
      <path fill={FG} d="M195 128 L272 128 L285 172 L182 172 Z" />
      <path fill={BG} opacity="0.15" d="M205 138 L262 138 L272 162 L198 162 Z" />
      {[142, 150, 158].map((y) => <line key={y} x1="205" y1={y} x2="262" y2={y} stroke={BG} strokeWidth="1.5" opacity="0.5" />)}
      {/* Fat front tire — larger */}
      {/* Headlight big round */}
      <circle cx="308" cy="118" r="20" fill={FG} />
      <circle cx="308" cy="118" r="12" fill={HL} opacity="0.85" />
      {/* Wide handlebars */}
      <path fill={FG} d="M302 88 L348 78 L352 92 L308 100 Z" />
      <path fill={FG} d="M302 88 L255 82 L252 96 L302 100 Z" />
      <path fill={FG} d="M298 96 L308 118 L302 122 Z" />
      {/* Long swept exhaust */}
      <path fill={FG} d="M262 152 L362 158 L365 175 L265 172 Z" />
      <Wheels frontCX="90" backCX="325" r="40" />
    </svg>
  );
}

// ============================================================================
// CAFE RACER  — clip-on bars, hump seat, retro tank
// ============================================================================
function CafeRacer() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Fork */}
      <path fill={FG} d="M262 92 L285 105 L92 168 L78 158 L248 82 Z" />
      {/* Rounded tank */}
      <path fill={FG} d="M175 95 L262 82 L275 122 L180 132 Z" />
      {/* Retro stripe */}
      <rect x="180" y="105" width="88" height="6" fill={HL} opacity="0.9" transform="rotate(-3 224 108)" />
      {/* Cafe hump seat */}
      <path fill={FG} d="M115 118 L175 108 L182 132 L120 138 Z" />
      <path fill={FG} d="M108 96 L148 90 L162 122 L112 130 Z" />
      {/* Engine air-cooled */}
      <path fill={FG} d="M195 128 L268 128 L282 168 L188 168 Z" />
      {[138, 146, 154].map((y) => <line key={y} x1="200" y1={y} x2="270" y2={y} stroke={BG} strokeWidth="1.5" opacity="0.5" />)}
      {/* Bullet round headlight */}
      <circle cx="298" cy="98" r="20" fill={FG} />
      <circle cx="298" cy="98" r="12" fill={HL} opacity="0.85" />
      {/* Clip-on bars low */}
      <path fill={FG} d="M292 88 L332 88 L335 100 L294 100 Z" />
      <path fill={FG} d="M292 88 L258 82 L256 96 L292 100 Z" />
      {/* Megaphone exhaust */}
      <path fill={FG} d="M268 158 L365 148 L370 168 L272 172 Z" />
      <Wheels />
    </svg>
  );
}

// ============================================================================
// ELECTRIC — modern, smooth, no engine, battery pack, LED
// ============================================================================
function Electric() {
  return (
    <svg viewBox={VB} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="220" fill={BG} rx="10" />
      {/* Rear body sleek */}
      <path fill={FG} d="M78 158 Q100 90 175 82 L268 78 Q325 88 340 128 L338 158 L285 170 L118 170 Z" />
      {/* Battery pack visible */}
      <path fill={FG} d="M175 108 L268 100 L278 148 L180 155 Z" />
      <rect x="188" y="118" width="80" height="24" fill={BG} opacity="0.2" rx="3" />
      {/* Lightning bolt on battery */}
      <path fill={HL} d="M225 118 L238 118 L228 130 L242 130 L215 148 L225 134 L215 134 Z" />
      {/* Sleek seat */}
      <path fill={FG} d="M115 100 L180 88 L188 108 L120 118 Z" />
      {/* LED strip headlight */}
      <path fill={FG} d="M285 88 L342 82 L348 108 L290 115 Z" />
      <rect x="292" y="90" width="52" height="4" fill={HL} />
      <rect x="292" y="98" width="52" height="2" fill={HL} opacity="0.5" />
      {/* Minimal handlebar */}
      <path fill={FG} d="M298 78 L340 62 L346 74 L302 92 Z" />
      <path fill={FG} d="M298 78 L260 68 L258 82 L296 92 Z" />
      {/* Discreet mirror */}
      <circle cx="256" cy="60" r="6" fill={FG} />
      <Wheels frontCX="90" backCX="320" r="36" />
    </svg>
  );
}

// ============================================================================
// MAP
// ============================================================================
const MAP = {
  "scooter": Scooter,
  "maxi scooter": MaxiScooter,
  "naked": Naked,
  "sport": Sport,
  "touring": Touring,
  "adventure": Adventure,
  "enduro": Enduro,
  "cross": Enduro,
  "chopper": Chopper,
  "cruiser": Cruiser,
  "cafe racer": CafeRacer,
  "elektrikli": Electric,
  "diğer": Naked,
};

export default function MotorcycleIllustration({ type = "Naked", className = "" }) {
  const { tenant } = useAuth() || {};
  const custom = tenant?.custom_moto_images?.[type];
  const key = (type || "").toLowerCase().trim();
  const C = MAP[key] || Naked;
  if (custom) {
    const token = localStorage.getItem("token");
    return (
      <div className={className}>
        <img src={`${API}/files/${custom}?auth=${token}`} alt={type}
             className="w-full h-full object-contain rounded-md bg-slate-100" />
      </div>
    );
  }
  return (
    <div className={className}>
      <C />
    </div>
  );
}

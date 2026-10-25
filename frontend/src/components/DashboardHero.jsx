import React from "react";
import Money from "./Money";

// Yalnızca bu bileşene ait stiller. Sınıf adları "dh-" ön ekiyle kapsamlıdır.
const CSS = `
.dh-stage { perspective: 900px; }
.dh-bike {
  transform-style: preserve-3d;
  animation: dh-turn 16s ease-in-out infinite alternate;
}
@keyframes dh-turn {
  0% { transform: rotateX(-6deg) rotateY(-32deg); }
  100% { transform: rotateX(-6deg) rotateY(32deg); }
}
.dh-floor {
  transform: rotateX(68deg);
  background:
    radial-gradient(ellipse at center, rgb(249 115 22 / 0.35) 0%, rgb(249 115 22 / 0.08) 45%, transparent 70%),
    linear-gradient(180deg, #334155 0%, #0f172a 100%);
  box-shadow: 0 40px 60px -20px rgb(249 115 22 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.12);
}
@media (prefers-reduced-motion: reduce) {
  .dh-bike { animation: none; transform: rotateX(-6deg) rotateY(-14deg); }
}
`;

/** Motosikletin SVG parçalarla çizilmiş sade hali (tekerlekler, gövde, marka turuncusu aksanı). */
function MotorcycleSvg() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full overflow-visible drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)]" aria-hidden="true">
      <defs>
        <linearGradient id="dh-tank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdba74" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#c2410c" />
        </linearGradient>
        <radialGradient id="dh-tire" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.6" stopColor="#1e293b" />
          <stop offset="1" stopColor="#020617" />
        </radialGradient>
      </defs>

      {/* egzoz */}
      <path d="M108 112 Q96 128 66 122" fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      {/* şasi ve salıncak kolu */}
      <path d="M62 110 L100 76 L150 78 L184 110" fill="none" stroke="#f97316" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 112 L126 100 L150 110" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />

      {/* motor bloğu */}
      <rect x="110" y="96" width="42" height="22" rx="5" fill="#475569" />
      <rect x="116" y="101" width="8" height="12" rx="2" fill="#64748b" />

      {/* sele */}
      <path d="M84 62 Q104 50 126 56 L124 66 L82 70 Z" fill="#1e293b" />
      {/* depo */}
      <path d="M100 70 Q110 50 140 50 L160 58 Q166 66 150 74 L104 78 Z" fill="url(#dh-tank)" />
      <path d="M118 62 Q132 58 146 62" fill="none" stroke="#fff7ed" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />

      {/* çatal ve gidon */}
      <line x1="178" y1="60" x2="185" y2="110" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      <path d="M168 54 L182 46 M176 56 L184 48" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
      {/* far */}
      <circle cx="186" cy="66" r="6" fill="#fef3c7" />
      <circle cx="186" cy="66" r="10" fill="#fef3c7" fillOpacity="0.2" />

      {/* tekerlekler */}
      {[60, 185].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="110" r="32" fill="url(#dh-tire)" stroke="#334155" strokeWidth="5" />
          <circle cx={cx} cy="110" r="19" fill="none" stroke="#cbd5e1" strokeWidth="3" />
          <circle cx={cx} cy="110" r="6" fill="#e2e8f0" />
          <path d={`M${cx} 91 L${cx} 129 M${cx - 19} 110 L${cx + 19} 110`} stroke="#94a3b8" strokeWidth="1.5" strokeOpacity="0.6" />
        </g>
      ))}
    </svg>
  );
}

function Chip({ label, children, testId }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="font-heading mt-1 text-xl font-bold tabular-nums text-white">{children}</p>
    </div>
  );
}

/** Firma kullanıcılarının ana sayfa üst bölümü: 3D motosiklet ve hızlı göstergeler. */
export default function DashboardHero({ kpi, tenantName, userName }) {
  const dash = (v) => (v === undefined || v === null ? "—" : v);

  return (
    <section
      aria-label="Karşılama"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-card"
      data-testid="dashboard-hero"
    >
      <style>{CSS}</style>
      {/* marka turuncusu parlaması */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 p-6 md:flex-row md:gap-8 md:p-8">
        <div className="w-full min-w-0 md:flex-1">
          {tenantName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400" data-testid="hero-tenant">
              {tenantName}
            </p>
          )}
          <h2 className="font-heading mt-1 text-2xl font-bold tracking-tight sm:text-3xl" data-testid="hero-greeting">
            Merhaba{userName ? `, ${userName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-slate-300">Servis operasyonunuzun bugünkü durumu.</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Chip label="Açık servis" testId="hero-open">{dash(kpi?.open_services)}</Chip>
            <Chip label="Bugünkü servis" testId="hero-today">{dash(kpi?.today_services)}</Chip>
            <Chip label="Toplam alacak" testId="hero-receivables">
              <Money value={kpi?.total_receivables} />
            </Chip>
          </div>
        </div>

        <div className="dh-stage relative h-56 w-full max-w-xs shrink-0 sm:h-64 md:h-72 md:w-80 md:max-w-none" aria-hidden="true">
          {/* 3D zemin */}
          <div className="dh-floor absolute bottom-6 left-1/2 h-24 w-[85%] -translate-x-1/2 rounded-[50%] border border-white/10" />
          {/* dönen motosiklet */}
          <div className="dh-bike absolute inset-x-[8%] bottom-10 top-6">
            <MotorcycleSvg />
          </div>
        </div>
      </div>
    </section>
  );
}

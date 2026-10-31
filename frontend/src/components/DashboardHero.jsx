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

/** Ana ekran motosiklet görseli: gerçekçi fotoğraf (SVG çizim servis raporları için ayrılmıştır). */
function MotorcycleSvg() {
  return (
    <img
      src="/visuals/moto-hologram.jpg"
      alt=""
      width="1386"
      height="665"
      decoding="async"
      className="h-full w-full rounded-xl object-cover drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)]"
    />
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

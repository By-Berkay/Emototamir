import React from "react";
import { useSiteAsset, SITE_BACKGROUND } from "../../lib/siteAssets";

/* Ortak tasarım bileşenleri: tüm sayfalar bu parçalarla aynı görünümü alır. */

const TONES = {
  orange: { text: "text-orange-400", bg: "bg-orange-500/15", ring: "ring-orange-500/30", hex: "#f97316" },
  blue: { text: "text-sky-400", bg: "bg-sky-500/15", ring: "ring-sky-500/30", hex: "#38bdf8" },
  green: { text: "text-emerald-400", bg: "bg-emerald-500/15", ring: "ring-emerald-500/30", hex: "#34d399" },
  violet: { text: "text-violet-400", bg: "bg-violet-500/15", ring: "ring-violet-500/30", hex: "#a78bfa" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/15", ring: "ring-amber-500/30", hex: "#fbbf24" },
  red: { text: "text-rose-400", bg: "bg-rose-500/15", ring: "ring-rose-500/30", hex: "#fb7185" },
};

export function toneOf(tone = "orange") {
  return TONES[tone] || TONES.orange;
}

/** Üst banner: atölye arka planı, sağda motosiklet görseli (süper admin yüklemesi varsa o, yoksa paket varsayılanı). */
export function HeroBanner({ eyebrow, title, subtitle, slot, fallback, actions, children, testId }) {
  const image = useSiteAsset(slot || "__none__", fallback);
  return (
    <section
      className="emt-glass-dark relative overflow-hidden rounded-3xl border border-white/10 text-white"
      data-testid={testId}
    >
      <img src={SITE_BACKGROUND} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/20" />
      {image && (
        <img
          src={image}
          alt=""
          className="pointer-events-none absolute -right-2 top-1/2 hidden h-[125%] w-[50%] -translate-y-1/2 object-contain mix-blend-screen md:block"
        />
      )}
      <div className="relative z-10 flex min-h-[168px] flex-col justify-center gap-3 p-6 sm:p-8 md:max-w-[56%]">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">{eyebrow}</p>}
        <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="max-w-xl text-sm text-slate-300">{subtitle}</p>}
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
      {children && <div className="relative z-10 px-6 pb-6 sm:px-8">{children}</div>}
    </section>
  );
}

/** Küçük sparkline (SVG). */
export function Sparkline({ data = [], tone = "orange", className = "h-10 w-full" }) {
  if (!data.length) return null;
  const w = 100;
  const h = 40;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * w, h - ((v - min) / span) * (h - 6) - 3]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const color = toneOf(tone).hex;
  const id = `spark-${tone}-${data.length}-${data[0]}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** KPI kartı: ikon, etiket, büyük değer, değişim rozeti ve mini grafik. */
export function KpiCard({ icon: Icon, label, value, delta, deltaTone = "up", spark, tone = "orange", testId }) {
  const t = toneOf(tone);
  const deltaClass =
    deltaTone === "down" ? "bg-rose-500/15 text-rose-300" : deltaTone === "neutral" ? "bg-white/10 text-slate-300" : "bg-emerald-500/15 text-emerald-300";
  return (
    <div className="emt-glass-dark flex flex-col gap-3 rounded-2xl border border-white/10 p-4 text-white" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${t.bg} ${t.ring} ${t.text}`}>
              <Icon className="h-4 w-4" />
            </span>
          )}
          <span className="text-xs font-medium text-slate-300">{label}</span>
        </div>
        {delta && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${deltaClass}`}>{delta}</span>}
      </div>
      <div className="font-heading text-2xl font-bold tracking-tight">{value}</div>
      {spark && <Sparkline data={spark} tone={tone} />}
    </div>
  );
}

/** Cam panel: başlık, opsiyonel sağ aksiyon ve içerik. */
export function Panel({ title, subtitle, action, children, className = "", bodyClassName = "", testId }) {
  return (
    <section className={`emt-glass-dark rounded-2xl border border-white/10 text-white ${className}`} data-testid={testId}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-heading text-[15px] font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const BADGE_TONES = {
  success: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  danger: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  info: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  brand: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  neutral: "bg-white/10 text-slate-300 ring-white/10",
};

export function StatusBadge({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${BADGE_TONES[tone] || BADGE_TONES.neutral}`}>
      {children}
    </span>
  );
}

/** Tüm veri tabloları için ortak kabuk. */
export function DataTable({ children, className = "" }) {
  return (
    <div className={`emt-table-wrap overflow-x-auto rounded-xl border border-white/10 ${className}`}>
      <table className="emt-table w-full text-left text-sm">{children}</table>
    </div>
  );
}

/** Üst sayfa aksiyonları için yuvarlak hatlı filtre/çip grubu. */
export function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
            value === o.value ? "bg-orange-500 text-white ring-orange-400" : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

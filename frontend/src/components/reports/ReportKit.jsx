import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Lock } from "lucide-react";
import { fmtMoney } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";

export const PALETTE = ["#f97316", "#22d3ee", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b", "#ec4899"];
export const AXIS_TICK = { fill: "#94a3b8", fontSize: 11 };
export const GRID_STROKE = "rgba(148,163,184,0.18)";

/** Kısaltılmış sayı: 1.250.000 → "1,3 Mn", 12.400 → "12 B". */
export const compact = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} Mn`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)} B`;
  return String(Math.round(n));
};

export const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
/** "2026-10" → "Eki 26" */
export const monthLabel = (k) => {
  const [y, m] = String(k).split("-");
  return `${MONTHS_TR[Number(m) - 1] || m} ${String(y).slice(2)}`;
};

/** Cam efektli grafik ipucu. */
export function GlassTooltip({ active, payload, label, money = true, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-slate-300">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">{money ? fmtMoney(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Büyük KPI kartı: değer, açıklama, ikon ve isteğe bağlı mini çizgi (sparkline). */
export function KpiTile({ label, value, hint, icon: Icon, tone = "orange", spark, sparkKey, testId }) {
  const color = { orange: "#f97316", cyan: "#22d3ee", emerald: "#10b981", violet: "#8b5cf6", red: "#ef4444" }[tone] || "#f97316";
  const gid = `spark-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="glass-card emt-depth relative overflow-hidden rounded-xl p-5" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="font-heading mt-2 truncate text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22`, color }}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {spark?.length > 1 && (
        <div className="-mx-1 mt-3 h-12">
          <ResponsiveContainer>
            <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={sparkKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Grafik kartı: başlık, açıklama, sağ üst eylemler ve içerik. */
export function ChartPanel({ title, description, actions, children, footer }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-slate-200/70 dark:border-white/10">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">{children}</CardContent>
      {footer && <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">{footer}</div>}
    </Card>
  );
}

/** Tutarlar gizliyken grafik yerine kilit durumu. */
export function LockedChart({ height = 240 }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400" style={{ height }}>
      <Lock className="h-5 w-5" />
      <p>Tutarlar gizli. Görmek için PIN ile kilidi açın.</p>
    </div>
  );
}

/** Ortada toplam değer bulunan halka grafik. */
export function Donut({ data, centerLabel, centerValue, height = 200 }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={d.name} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<GlassTooltip money={false} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{centerLabel}</p>
        <p className="font-heading text-xl font-bold text-slate-900 tabular-nums dark:text-white">{centerValue}</p>
      </div>
    </div>
  );
}

/** Ciro / tahsilat alan grafiği. */
export function TrendArea({ data, height = 260 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
          <Tooltip content={<GlassTooltip />} />
          <Area type="monotone" dataKey="revenue" name="Ciro" stroke="#f97316" strokeWidth={2.5} fill="url(#gRev)" />
          <Area type="monotone" dataKey="collected" name="Tahsilat" stroke="#22d3ee" strokeWidth={2.5} fill="url(#gCol)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Yatay ilerleme çubuğu. */
export function Bar({ value, max, color = "#f97316" }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Sıra rozeti. */
export function RankBadge({ n }) {
  const cls = n === 1 ? "from-amber-300 to-orange-500 text-white" : n === 2 ? "from-slate-200 to-slate-400 text-slate-800" : n === 3 ? "from-orange-200 to-orange-400 text-white" : "from-slate-100 to-slate-200 text-slate-600 dark:from-white/10 dark:to-white/5 dark:text-slate-300";
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-xs font-bold ${cls}`}>{n}</span>;
}

/** Baş harflerden avatar. */
export function Initials({ name = "" }) {
  const t = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-cyan-400 text-xs font-bold text-white">{t}</span>;
}

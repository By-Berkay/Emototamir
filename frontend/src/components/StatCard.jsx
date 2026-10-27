import React from "react";
import Tilt3D from "./Tilt3D";

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  sky: "bg-sky-50 text-sky-600",
};

/** KPI kartı: etiket, büyük değer, isteğe bağlı açıklama ve ikon. */
export default function StatCard({ label, value, hint, icon: Icon, tone = "brand", testId }) {
  return (
    <Tilt3D
      className="emt-depth flex h-full items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-5"
      data-testid={testId}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="font-heading mt-2 truncate text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone] || TONES.brand}`}>
          <Icon className="h-5 w-5" />
        </span>
      )}
    </Tilt3D>
  );
}

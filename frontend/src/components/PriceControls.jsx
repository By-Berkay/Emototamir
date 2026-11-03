import React from "react";
import { PRICE_MODES, VAT_RATES } from "../lib/pricing";

const selectCls =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-500";

/** KDV dahil / KDV hariç seçimi. Eksik değer KDV dahil kabul edilir (varsayılan). */
export function PriceModeSelect({ value, onChange, disabled = false, testId }) {
  return (
    <select
      aria-label="Fiyat tipi"
      value={value === "excl" ? "excl" : "incl"}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={selectCls}
      data-testid={testId}
    >
      {PRICE_MODES.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );
}

/** KDV oranı seçimi. Listede olmayan (ör. ileride değişen) kayıtlı bir oran da gösterilir. */
export function VatSelect({ value, onChange, disabled = false, testId }) {
  const parsed = value === null || value === undefined || value === "" ? NaN : Number(value);
  const current = Number.isFinite(parsed) ? parsed : 20;
  const options = VAT_RATES.includes(current) ? VAT_RATES : [...VAT_RATES, current].sort((a, b) => a - b);
  return (
    <select
      aria-label="KDV oranı"
      value={current}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className={selectCls}
      data-testid={testId}
    >
      {options.map((r) => (
        <option key={r} value={r}>%{r}</option>
      ))}
    </select>
  );
}

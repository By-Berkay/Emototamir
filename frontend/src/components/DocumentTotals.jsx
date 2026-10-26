import React from "react";
import { fmtMoney } from "../lib/api";

/**
 * Belge toplam satırları (servis emri, teklif, detay).
 * t: documentTotals() çıktısı ya da sunucudaki belge alanları
 *    (parts_total, services_total, labor_gross, subtotal, discount, vat_total, net_total, grand_total).
 * paid: tahsil edilen tutar; verilirse tahsilat ve kalan satırları da gösterilir.
 */
export default function DocumentTotals({ t, paid = 0, className = "" }) {
  const row = (label, value, tone = "") => (
    <div className={`flex justify-between gap-4 text-sm ${tone}`}>
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  const paidAmt = Number(paid) || 0;
  const grand = Number(t.grand_total) || 0;

  return (
    <div className={`space-y-2 ${className}`} data-testid="doc-totals">
      {row("Parça toplamı", fmtMoney(t.parts_total))}
      {row("Hizmet toplamı", fmtMoney(t.services_total))}
      {row("İşçilik", fmtMoney(t.labor_gross))}
      <div className="space-y-2 border-t pt-2">
        {row("Ara toplam (KDV dahil)", fmtMoney(t.subtotal))}
        {Number(t.discount) > 0 && row("İskonto", `-${fmtMoney(t.discount)}`, "text-red-600")}
      </div>
      <div className="space-y-2 border-t pt-2">
        {row("KDV toplamı", fmtMoney(t.vat_total))}
        {row("KDV hariç tutar", fmtMoney(t.net_total))}
      </div>
      <div className="flex justify-between border-t pt-2 text-lg font-bold">
        <span>Genel Toplam</span>
        <span className="tabular-nums">{fmtMoney(grand)}</span>
      </div>
      {paidAmt > 0 && (
        <div className="space-y-2 border-t pt-2">
          {row("Tahsil edilen", fmtMoney(paidAmt), "text-emerald-700")}
          {row("Kalan", fmtMoney(Math.max(0, grand - paidAmt)), "font-semibold")}
        </div>
      )}
    </div>
  );
}

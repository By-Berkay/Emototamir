// KDV ve toplam hesabı. Backend'deki compute_document_totals ile birebir aynı kuralları uygular.
// Kurallar:
//  - Her kalemde fiyat "KDV dahil" (incl) veya "KDV hariç" (excl) girilir; varsayılan incl.
//  - Her kalemin KDV oranı VAT_RATES içinden seçilir (%0, %1, %10, %20).
//  - Kalem brüt tutarı (KDV dahil) = adet × birim fiyat (excl ise KDV eklenerek).
//  - Genel toplam = parça + hizmet + işçilik (brüt) − iskonto. İskonto KDV dahil tutardan düşülür.
//  - KDV tutarı, iskonto oranında orantılı azaltılır; net tutar = genel toplam − KDV.
// Sunucudaki değerler yetkilidir; burada hesaplanan değerler anlık önizleme içindir.

export const VAT_RATES = [0, 1, 10, 20];

export const PRICE_MODES = [
  { value: "incl", label: "KDV dahil" },
  { value: "excl", label: "KDV hariç" },
];

export const DEFAULT_VAT = 20;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Tek kalem için brüt (KDV dahil), net (KDV hariç) ve KDV tutarları. */
export function lineAmounts(item) {
  const rate = num(item.vat ?? DEFAULT_VAT);
  const raw = num(item.qty) * num(item.unit_price);
  const gross = item.price_mode === "excl" ? raw * (1 + rate / 100) : raw;
  const net = gross / (1 + rate / 100);
  return { gross: round2(gross), net: round2(net), vat: round2(gross - net) };
}

/**
 * Belge toplamları (servis emri veya teklif).
 * items: [{kind: "part"|"service", qty, unit_price, price_mode, vat}]
 */
export function documentTotals({ items = [], labor_total = 0, labor_price_mode = "incl", labor_vat = DEFAULT_VAT, discount = 0 }) {
  const lines = items.map((it) => ({ ...it, ...lineAmounts(it) }));
  const parts = lines.filter((l) => l.kind === "part").reduce((s, l) => s + l.gross, 0);
  const services = lines.filter((l) => l.kind === "service").reduce((s, l) => s + l.gross, 0);

  const laborInput = num(labor_total);
  const laborRate = num(labor_vat);
  const laborGross = labor_price_mode === "excl" ? laborInput * (1 + laborRate / 100) : laborInput;
  const laborVat = laborGross - laborGross / (1 + laborRate / 100);

  const subtotal = parts + services + laborGross;
  const disc = Math.min(Math.max(num(discount), 0), subtotal);
  const grand = subtotal - disc;
  const ratio = subtotal > 0 ? grand / subtotal : 1;
  const vatAll = (lines.reduce((s, l) => s + l.vat, 0) + laborVat) * ratio;

  return {
    lines,
    parts_total: round2(parts),
    services_total: round2(services),
    labor_gross: round2(laborGross),
    subtotal: round2(subtotal),
    discount: round2(disc),
    grand_total: round2(grand),
    vat_total: round2(vatAll),
    net_total: round2(grand - vatAll),
  };
}

// Paket yetkileri: firmanın açabileceği modüller ve kayıt limitleri.
// Anahtarlar, sunucudaki URL segmentleriyle aynıdır (/api/<anahtar>).
export const MODULE_OPTIONS = [
  { key: "customers", label: "Müşteriler" },
  { key: "motorcycles", label: "Motosikletler" },
  { key: "service-orders", label: "Servis Kayıtları" },
  { key: "inspections", label: "Ekspertiz" },
  { key: "quotes", label: "Fiyat Teklifleri" },
  { key: "reminders", label: "Bakım Hatırlatma" },
  { key: "current-accounts", label: "Cari Hesaplar" },
  { key: "payments", label: "Tahsilatlar" },
  { key: "reports", label: "Raporlar" },
  { key: "finance", label: "Gelir & Gider / Personel" },
  { key: "products", label: "Ürünler" },
];

export const LIMIT_OPTIONS = [
  { key: "customers", label: "Müşteri" },
  { key: "motorcycles", label: "Motosiklet" },
  { key: "service_orders", label: "Servis kaydı" },
  { key: "inspections", label: "Ekspertiz" },
  { key: "quotes", label: "Teklif" },
];

export const MODULE_KEYS = MODULE_OPTIONS.map((m) => m.key);

/** Firma bu sayfaya girebilir mi? Modül tanımsızsa veya sayfa listede değilse serbesttir. */
export function moduleAllowed(tenant, path) {
  const mods = tenant?.entitlements?.modules;
  if (!Array.isArray(mods)) return true;
  const seg = String(path || "").split("/")[1];
  if (!MODULE_KEYS.includes(seg)) return true;
  return mods.includes(seg);
}

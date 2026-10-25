// Türkiye GSM numaralarını WhatsApp (wa.me) için uluslararası biçime çevirir.
// "0555 111 22 33", "+90 555 111 22 33", "5551112233" → "905551112233"
// Geçersiz/boş girdi için null döner.
export function toWhatsAppNumber(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = "90" + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("5")) digits = "90" + digits;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

"""Servis emri ve teklif toplamları (kalem bazlı KDV dahil / KDV hariç).

Kurallar frontend/src/lib/pricing.js ile birebir aynıdır; sunucudaki değerler yetkilidir.
  - Kalem fiyatı price_mode 'incl' (KDV dahil, varsayılan) ya da 'excl' (KDV hariç) olarak girilir.
  - Kalemin KDV oranı vat'tır (varsayılan 20).
  - Brüt tutar (KDV dahil) = adet x birim fiyat; 'excl' ise KDV eklenerek bulunur.
  - Genel toplam = parça + hizmet + işçilik (brüt) - iskonto. İskonto brüt tutardan düşülür.
  - KDV tutarı iskonto oranında orantılı azalır; net tutar = genel toplam - KDV.

Eski kayıtlarda price_mode / vat / labor_price_mode / labor_vat alanları yoksa
varsayılanlar (incl, %20) kullanılır; böylece önceki toplamlar değişmez.
"""
import math
from typing import Any, Dict, Iterable, List, Optional

DEFAULT_VAT = 20.0
DEFAULT_PRICE_MODE = "incl"
PRICE_MODES = ("incl", "excl")
_EPSILON = 2.220446049250313e-16  # JavaScript Number.EPSILON


def _num(value: Any, default: float = 0.0) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return n if math.isfinite(n) else default


def round2(value: float) -> float:
    """JavaScript Math.round((v + Number.EPSILON) * 100) / 100 ile aynı yuvarlama."""
    return math.floor((value + _EPSILON) * 100 + 0.5) / 100


def _vat_rate(raw: Any) -> float:
    return DEFAULT_VAT if raw is None else _num(raw)


def line_amounts(item: Dict[str, Any]) -> Dict[str, float]:
    """Tek kalem için brüt (KDV dahil), net (KDV hariç) ve KDV tutarları."""
    rate = _vat_rate(item.get("vat"))
    raw = _num(item.get("qty")) * _num(item.get("unit_price"))
    gross = raw * (1 + rate / 100) if item.get("price_mode") == "excl" else raw
    net = gross / (1 + rate / 100)
    return {"gross": round2(gross), "net": round2(net), "vat": round2(gross - net)}


def compute_document_totals(
    items: Optional[Iterable[Dict[str, Any]]],
    labor_total: Any = 0,
    labor_price_mode: Optional[str] = None,
    labor_vat: Any = None,
    discount: Any = 0,
) -> Dict[str, float]:
    """Servis emri / teklif belge toplamları. Döner: parts_total, services_total, labor_total (girilen
    işçilik tutarı), labor_gross, subtotal (işçilik dahil, iskonto öncesi), discount, grand_total,
    vat_total, net_total."""
    lines: List[Dict[str, Any]] = []
    for it in items or []:
        lines.append({"kind": it.get("kind"), **line_amounts(it)})

    parts = sum(line["gross"] for line in lines if line["kind"] == "part")
    services = sum(line["gross"] for line in lines if line["kind"] == "service")

    labor_input = _num(labor_total)
    labor_rate = _vat_rate(labor_vat)
    labor_gross = labor_input * (1 + labor_rate / 100) if labor_price_mode == "excl" else labor_input
    labor_vat_amount = labor_gross - labor_gross / (1 + labor_rate / 100)

    subtotal = parts + services + labor_gross
    disc = min(max(_num(discount), 0.0), subtotal)
    grand = subtotal - disc
    ratio = grand / subtotal if subtotal > 0 else 1.0
    vat_all = (sum(line["vat"] for line in lines) + labor_vat_amount) * ratio

    return {
        "parts_total": round2(parts),
        "services_total": round2(services),
        "labor_total": round2(labor_input),
        "labor_gross": round2(labor_gross),
        "subtotal": round2(subtotal),
        "discount": round2(disc),
        "grand_total": round2(grand),
        "vat_total": round2(vat_all),
        "net_total": round2(grand - vat_all),
    }


def validate_money_fields(
    items: Iterable[Dict[str, Any]],
    labor_total: Any,
    labor_price_mode: Any,
    labor_vat: Any,
    discount: Any,
) -> Optional[str]:
    """Belge alanlarındaki geçersiz değerler için Türkçe hata mesajı döner; geçerliyse None."""
    for it in items:
        if it.get("price_mode", DEFAULT_PRICE_MODE) not in PRICE_MODES:
            return "Fiyat modu geçersiz (KDV dahil veya KDV hariç olmalı)"
        if _num(it.get("unit_price")) < 0:
            return "Birim fiyat negatif olamaz"
        if _num(it.get("vat"), DEFAULT_VAT) < 0:
            return "KDV negatif olamaz"
    if labor_price_mode is not None and labor_price_mode not in PRICE_MODES:
        return "İşçilik fiyat modu geçersiz"
    if _num(labor_vat, DEFAULT_VAT) < 0:
        return "KDV negatif olamaz"
    if _num(labor_total) < 0:
        return "İşçilik negatif olamaz"
    if _num(discount) < 0:
        return "İskonto negatif olamaz"
    return None

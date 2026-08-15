"""PDF generation for service orders (Turkish)."""
import io
import base64
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Try to register a TTF that supports Turkish chars. Fall back to Helvetica.
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
_TR_FONTS_REGISTERED = False


def _register_fonts():
    global _TR_FONTS_REGISTERED, FONT_NAME, FONT_BOLD
    if _TR_FONTS_REGISTERED:
        return
    candidates = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ]
    for regular, bold in candidates:
        if os.path.exists(regular) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont("TR", regular))
                pdfmetrics.registerFont(TTFont("TR-Bold", bold))
                FONT_NAME = "TR"
                FONT_BOLD = "TR-Bold"
                _TR_FONTS_REGISTERED = True
                return
            except Exception:
                continue


STATUS_LABELS = {
    "new": "Yeni", "diagnosed": "Arıza Tespiti Yapıldı", "pricing": "Fiyatlandırma Bekliyor",
    "awaiting_approval": "Onay Bekliyor", "approved": "Onaylandı", "in_repair": "Tamirde",
    "parts_waiting": "Parça Bekleniyor", "completed": "Tamamlandı",
    "awaiting_delivery": "Teslim Bekliyor", "delivered": "Teslim Edildi", "cancelled": "İptal",
}
FUEL_LABELS = {"Boş": "Boş", "1/4": "1/4", "1/2": "1/2", "3/4": "3/4", "Dolu": "Dolu"}


def _fmt_money(v):
    return f"{float(v or 0):,.2f} TL".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(iso):
    if not iso:
        return "-"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return iso[:16]


def build_service_pdf(order: dict, kind: str = "kabul") -> bytes:
    """kind: 'kabul' (intake) or 'teslim' (delivery)."""
    _register_fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=15*mm, bottomMargin=15*mm)
    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("t", parent=styles["Heading1"], fontName=FONT_BOLD,
                                 fontSize=20, textColor=colors.HexColor("#0F172A"),
                                 spaceAfter=4, leading=24)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontName=FONT_NAME,
                               fontSize=10, textColor=colors.HexColor("#64748B"))
    section_style = ParagraphStyle("sec", parent=styles["Heading3"], fontName=FONT_BOLD,
                                    fontSize=11, textColor=colors.HexColor("#0F172A"),
                                    spaceBefore=10, spaceAfter=4)
    body_style = ParagraphStyle("b", parent=styles["Normal"], fontName=FONT_NAME, fontSize=9,
                                textColor=colors.HexColor("#0F172A"), leading=12)

    title = "SERVİS KABUL FORMU" if kind == "kabul" else "SERVİS TESLİM FORMU"
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"Servis No: <b>{order.get('service_no','')}</b> · Tarih: {_fmt_date(order.get('created_at'))}", sub_style))
    elements.append(Spacer(1, 6))

    # Header info: 2-column tables
    cust = order.get("customer") or {}
    moto = order.get("motorcycle") or {}
    header_data = [
        [Paragraph("<b>Müşteri</b>", body_style), Paragraph(f"{order.get('customer_name','')}", body_style),
         Paragraph("<b>Telefon</b>", body_style), Paragraph(f"{order.get('customer_phone','')}", body_style)],
        [Paragraph("<b>Motosiklet</b>", body_style), Paragraph(f"{order.get('brand','')} {order.get('model','')}", body_style),
         Paragraph("<b>Tip</b>", body_style), Paragraph(f"{order.get('moto_type','')}", body_style)],
        [Paragraph("<b>Plaka</b>", body_style), Paragraph(f"{order.get('plate','')}", body_style),
         Paragraph("<b>Kilometre</b>", body_style), Paragraph(f"{order.get('km',0):,} km".replace(",", "."), body_style)],
        [Paragraph("<b>Şase (VIN)</b>", body_style), Paragraph(f"{moto.get('vin','-')}", body_style),
         Paragraph("<b>Yakıt</b>", body_style), Paragraph(f"{order.get('fuel_level','-')}", body_style)],
    ]
    tbl = Table(header_data, colWidths=[3*cm, 6*cm, 3*cm, 5*cm])
    tbl.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#CBD5E1")),
        ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#F1F5F9")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("FONTNAME", (0,0), (-1,-1), FONT_NAME),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    elements.append(tbl)

    # Complaint & diagnosis
    elements.append(Paragraph("MÜŞTERİ ŞİKAYETİ", section_style))
    elements.append(Paragraph((order.get("complaint") or "-").replace("\n", "<br/>"), body_style))
    if kind == "teslim" or order.get("diagnosis"):
        elements.append(Paragraph("ARIZA TESPİTİ", section_style))
        elements.append(Paragraph((order.get("diagnosis") or "-").replace("\n", "<br/>"), body_style))
    if order.get("operations"):
        elements.append(Paragraph("YAPILAN / YAPILACAK İŞLEMLER", section_style))
        elements.append(Paragraph((order.get("operations") or "-").replace("\n", "<br/>"), body_style))

    # Fault zones & accessories
    if order.get("fault_zones"):
        elements.append(Paragraph("ARIZALI BÖLGELER", section_style))
        elements.append(Paragraph(", ".join(order["fault_zones"]), body_style))
    if order.get("accessories"):
        elements.append(Paragraph("AKSESUARLAR", section_style))
        elements.append(Paragraph(", ".join(order["accessories"]), body_style))

    # Items table (only for teslim, or always if items present)
    items = order.get("items") or []
    if kind == "teslim" and items:
        elements.append(Paragraph("PARÇALAR & HİZMETLER", section_style))
        rows = [["Tür", "Ad", "Adet", "Birim Fiyat", "Toplam"]]
        for it in items:
            kind_label = "Parça" if it.get("kind") == "part" else "Hizmet"
            rows.append([kind_label, it.get("name",""), str(it.get("qty",0)),
                        _fmt_money(it.get("unit_price",0)),
                        _fmt_money(float(it.get("qty",0)) * float(it.get("unit_price",0)))])
        itbl = Table(rows, colWidths=[2*cm, 8*cm, 2*cm, 3*cm, 3*cm])
        itbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONTNAME", (0,0), (-1,0), FONT_BOLD),
            ("FONTNAME", (0,1), (-1,-1), FONT_NAME),
            ("FONTSIZE", (0,0), (-1,-1), 8.5),
            ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#CBD5E1")),
            ("ALIGN", (2,1), (-1,-1), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("RIGHTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))
        elements.append(itbl)

        # Totals
        totals_data = [
            ["Parça Toplamı", _fmt_money(order.get("parts_total",0))],
            ["Hizmet Toplamı", _fmt_money(order.get("services_total",0))],
            ["İşçilik", _fmt_money(order.get("labor_total",0))],
            ["İskonto", "- " + _fmt_money(order.get("discount",0))],
            ["GENEL TOPLAM", _fmt_money(order.get("grand_total",0))],
            ["Tahsil Edilen", _fmt_money(order.get("paid_total",0))],
            ["Kalan Bakiye", _fmt_money((order.get("grand_total",0) or 0) - (order.get("paid_total",0) or 0))],
        ]
        ttbl = Table(totals_data, colWidths=[12*cm, 6*cm])
        ttbl.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), FONT_NAME),
            ("FONTNAME", (0,4), (-1,4), FONT_BOLD),
            ("FONTSIZE", (0,0), (-1,-1), 10),
            ("FONTSIZE", (0,4), (-1,4), 12),
            ("ALIGN", (1,0), (1,-1), "RIGHT"),
            ("LINEABOVE", (0,4), (-1,4), 1, colors.HexColor("#0F172A")),
            ("BACKGROUND", (0,4), (-1,4), colors.HexColor("#FFF7ED")),
            ("TEXTCOLOR", (0,4), (-1,4), colors.HexColor("#EA580C")),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))
        elements.append(Spacer(1, 6))
        elements.append(ttbl)

    # Status
    elements.append(Paragraph("DURUM", section_style))
    elements.append(Paragraph(STATUS_LABELS.get(order.get("status"), order.get("status","-")), body_style))

    # Signature area
    elements.append(Spacer(1, 20))
    sig_rows = [[
        Paragraph("<b>SERVİS YETKİLİSİ İMZA</b><br/><br/><br/>_________________________", body_style),
        _signature_cell(order.get("customer_signature"), body_style),
    ]]
    sig_tbl = Table(sig_rows, colWidths=[8.5*cm, 8.5*cm])
    sig_tbl.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#F8FAFC")),
    ]))
    elements.append(sig_tbl)

    elements.append(Spacer(1, 8))
    elements.append(Paragraph(
        "Bu formu imzalayarak yukarıda belirtilen bilgilerin doğruluğunu ve servis kabul/teslim şartlarını kabul etmiş sayılırsınız.",
        ParagraphStyle("f", parent=body_style, fontSize=7.5, textColor=colors.HexColor("#64748B"))
    ))

    doc.build(elements)
    return buf.getvalue()


def _signature_cell(sig_b64, body_style):
    if not sig_b64 or not isinstance(sig_b64, str) or "," not in sig_b64:
        return Paragraph("<b>MÜŞTERİ İMZA</b><br/><br/><br/>_________________________", body_style)
    try:
        b = base64.b64decode(sig_b64.split(",", 1)[1])
        img = Image(io.BytesIO(b), width=6*cm, height=2.5*cm)
        return [Paragraph("<b>MÜŞTERİ İMZA</b>", body_style), img]
    except Exception:
        return Paragraph("<b>MÜŞTERİ İMZA</b><br/><br/><br/>_________________________", body_style)

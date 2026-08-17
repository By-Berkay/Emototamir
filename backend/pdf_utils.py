"""PDF generation for service orders (Turkish) — moto CarizmA style."""
import io
import base64
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
_TR_FONTS_REGISTERED = False


def _register_fonts():
    global _TR_FONTS_REGISTERED, FONT_NAME, FONT_BOLD
    if _TR_FONTS_REGISTERED:
        return
    candidates = [
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/freefont/FreeSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"),
    ]
    for regular, bold in candidates:
        if os.path.exists(regular) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont("TR", regular))
                pdfmetrics.registerFont(TTFont("TR-Bold", bold))
                from reportlab.pdfbase.pdfmetrics import registerFontFamily
                registerFontFamily("TR", normal="TR", bold="TR-Bold", italic="TR", boldItalic="TR-Bold")
                FONT_NAME = "TR"; FONT_BOLD = "TR-Bold"
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


def _fmt_money(v):
    return f"{float(v or 0):,.2f} ₺".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(iso):
    if not iso:
        return "-"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y")
    except Exception:
        return iso[:10]


def build_service_pdf(order: dict, kind: str = "kabul", tenant: dict = None, logo_bytes: bytes = None) -> bytes:
    _register_fonts()
    tenant = tenant or {}
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=12*mm, bottomMargin=12*mm)
    elements = []
    styles = getSampleStyleSheet()

    primary = colors.HexColor(tenant.get("primary_color") or "#F97316")
    dark = colors.HexColor(tenant.get("secondary_color") or "#0F172A")

    p_normal = ParagraphStyle("n", fontName=FONT_NAME, fontSize=9, textColor=dark, leading=11)
    p_small = ParagraphStyle("s", fontName=FONT_NAME, fontSize=8, textColor=colors.HexColor("#475569"), leading=10)
    p_bold = ParagraphStyle("b", fontName=FONT_BOLD, fontSize=9, textColor=dark, leading=11)
    p_h1 = ParagraphStyle("h1", fontName=FONT_BOLD, fontSize=22, textColor=dark, leading=26, alignment=0)
    p_h2 = ParagraphStyle("h2", fontName=FONT_BOLD, fontSize=11, textColor=colors.white, leading=13,
                          backColor=dark, borderPadding=(4, 6, 4, 6), alignment=0)
    p_title = ParagraphStyle("t", fontName=FONT_BOLD, fontSize=14, textColor=primary, leading=16, alignment=2)

    # ---------- HEADER ----------
    logo_cell = ""
    if logo_bytes:
        try:
            logo_cell = Image(io.BytesIO(logo_bytes), width=3.5*cm, height=3.5*cm)
            logo_cell.hAlign = "LEFT"
        except Exception:
            logo_cell = ""
    if not logo_cell:
        logo_cell = Paragraph(f"<font size='24' color='{primary.hexval()}'><b>◉</b></font>", p_h1)

    company_html = (
        f"<font size='20' face='{FONT_BOLD}'>{tenant.get('name','')}</font><br/>"
        f"<font size='9' face='{FONT_BOLD}' color='#475569'>{tenant.get('subtitle','YETKİLİ SERVİS &amp; SHOWROOM')}</font><br/>"
        f"<font size='8' color='#334155'>{tenant.get('address','')}</font><br/>"
        f"<font size='8' color='#334155'>{tenant.get('district','')} / {tenant.get('city','')}</font><br/>"
        f"<font size='8' color='#334155'>GSM: {tenant.get('phone','')}</font>"
    )
    doc_kind_default = "SERVİS KABUL FORMU" if kind == "kabul" else "SERVİS TESLİM FORMU"
    tpl = tenant.get("pdf_template") or {}
    doc_kind = (tpl.get("kabul_title") if kind == "kabul" else tpl.get("teslim_title")) or doc_kind_default
    doc_meta_html = (
        f"<font size='14' face='{FONT_BOLD}' color='{primary.hexval()}'>{doc_kind}</font><br/><br/>"
        f"<font size='10'><font face='{FONT_BOLD}'>SERVİS NO:</font> {order.get('service_no','')}</font><br/>"
        f"<font size='10'><font face='{FONT_BOLD}'>TARİH:</font> {_fmt_date(order.get('created_at'))}</font>"
    )
    header_tbl = Table(
        [[logo_cell, Paragraph(company_html, p_normal), Paragraph(doc_meta_html, ParagraphStyle('r', parent=p_normal, alignment=2))]],
        colWidths=[4*cm, 8*cm, 6*cm]
    )
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ]))
    elements.append(header_tbl)
    elements.append(Spacer(1, 4))

    # Divider
    divider = Table([[""]], colWidths=[18*cm], rowHeights=[3])
    divider.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), primary)]))
    elements.append(divider)
    elements.append(Spacer(1, 8))

    # ---------- CUSTOMER/VEHICLE INFO ----------
    cust_data = [
        [Paragraph("MÜŞTERİ ADI", p_small), Paragraph(f"<font face='{FONT_BOLD}'>{order.get('customer_name','')}</font>", p_normal),
         Paragraph("MÜŞTERİ TELEFON", p_small), Paragraph(f"<font face='{FONT_BOLD}'>{order.get('customer_phone','')}</font>", p_normal)],
        [Paragraph("ARAÇ PLAKA", p_small), Paragraph(f"<font face='{FONT_BOLD}'>{order.get('plate','')}</font>", p_normal),
         Paragraph("ARAÇ MODEL", p_small), Paragraph(f"<font face='{FONT_BOLD}'>{order.get('brand','')} {order.get('model','')}</font>", p_normal)],
        [Paragraph("KİLOMETRE", p_small), Paragraph(f"{(order.get('km') or 0):,} km".replace(",","."), p_normal),
         Paragraph("YAKIT", p_small), Paragraph(order.get('fuel_level','-'), p_normal)],
    ]
    cust_tbl = Table(cust_data, colWidths=[3*cm, 6*cm, 3*cm, 6*cm])
    cust_tbl.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#F1F5F9")),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    elements.append(cust_tbl)
    elements.append(Spacer(1, 8))

    # ---------- ITEMS TABLE ----------
    items = order.get("items") or []
    rows = [["NO", "YAPILAN İŞ FORMU", "MİKTAR", "FİYAT", "TUTAR"]]
    for idx, it in enumerate(items, 1):
        rows.append([
            str(idx),
            it.get("name", ""),
            f"{float(it.get('qty', 0)):g}",
            _fmt_money(it.get("unit_price", 0)),
            _fmt_money(float(it.get("qty", 0)) * float(it.get("unit_price", 0))),
        ])
    # Add labor as a separate line item if present
    if order.get("labor_total"):
        rows.append([str(len(rows)), "İŞÇİLİK", "1", _fmt_money(order.get("labor_total",0)), _fmt_money(order.get("labor_total",0))])
    # Ensure at least 15 rows for the classic form look
    while len(rows) - 1 < 15:
        rows.append(["", "", "", "", ""])
    itbl = Table(rows, colWidths=[1.2*cm, 9.8*cm, 2*cm, 2.5*cm, 2.5*cm])
    itbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), dark),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), FONT_BOLD),
        ("FONTNAME", (0,1), (-1,-1), FONT_NAME),
        ("FONTSIZE", (0,0), (-1,-1), 8.5),
        ("ALIGN", (0,0), (0,-1), "CENTER"),
        ("ALIGN", (2,0), (4,-1), "RIGHT"),
        ("ALIGN", (2,0), (2,0), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    elements.append(itbl)
    elements.append(Spacer(1, 6))

    # ---------- Explanation + Totals ----------
    aciklama = Paragraph(f"<b>AÇIKLAMA:</b><br/>{(order.get('diagnosis') or order.get('operations') or order.get('notes') or '-').replace(chr(10), '<br/>')}", p_normal)
    parts_total = sum(float(i.get("qty",0))*float(i.get("unit_price",0)) for i in items if i.get("kind") == "part")
    services_total = sum(float(i.get("qty",0))*float(i.get("unit_price",0)) for i in items if i.get("kind") == "service")
    subtotal = parts_total + services_total + float(order.get("labor_total",0))
    discount = float(order.get("discount",0))
    subtotal_after_disc = subtotal - discount
    kdv = subtotal_after_disc * 0.20 / 1.20  # inclusive KDV extracted
    grand = order.get("grand_total", subtotal_after_disc)

    totals_data = [
        ["TOPLAM", _fmt_money(subtotal_after_disc / 1.20)],
        ["20% KDV", _fmt_money(kdv)],
        ["GENEL TOPLAM", _fmt_money(grand)],
    ]
    if order.get("discount"):
        totals_data.insert(0, ["İSKONTO", "- " + _fmt_money(discount)])
    if order.get("paid_total"):
        totals_data.append(["TAHSİL EDİLEN", _fmt_money(order.get("paid_total"))])
        remaining = max(0, grand - order.get("paid_total",0))
        totals_data.append(["KALAN", _fmt_money(remaining)])

    ttbl = Table(totals_data, colWidths=[3.5*cm, 3.5*cm])
    ttbl.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), FONT_NAME),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#CBD5E1")),
        ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#F1F5F9")),
        ("FONTNAME", (0,len(totals_data)-1 if not order.get("paid_total") else 2), (-1,len(totals_data)-1 if not order.get("paid_total") else 2), FONT_BOLD),
        ("BACKGROUND", (0,2), (-1,2), primary if not order.get("paid_total") else colors.HexColor("#FFF7ED")),
        ("TEXTCOLOR", (0,2), (-1,2), colors.white if not order.get("paid_total") else primary),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    bottom = Table([[aciklama, ttbl]], colWidths=[11*cm, 7*cm])
    bottom.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP")]))
    elements.append(bottom)
    elements.append(Spacer(1, 8))

    # ---------- Signatures ----------
    sig_data = [[
        Paragraph(f"<font face='{FONT_BOLD}'>SERVİS YETKİLİSİ</font><br/><br/><br/>_______________________<br/>Ad Soyad / İmza", p_normal),
        _sig_cell(order.get("customer_signature"), p_normal),
    ]]
    sig_tbl = Table(sig_data, colWidths=[9*cm, 9*cm], rowHeights=[3*cm])
    sig_tbl.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ("LINEBEFORE", (1,0), (1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8),
    ]))
    elements.append(sig_tbl)
    elements.append(Spacer(1, 6))

    # ---------- Bank Info ----------
    if tenant.get("iban"):
        bank_html = (
            f"<font face='{FONT_BOLD}'>IBAN BİLGİSİ:</font> {tenant.get('bank_name','')} — "
            f"{tenant.get('bank_account_name','')} — "
            f"<font face='{FONT_BOLD}'>{tenant.get('iban','')}</font>"
        )
        bank_para = Paragraph(bank_html, ParagraphStyle("bank", fontName=FONT_NAME, fontSize=9,
                                                       textColor=colors.white, backColor=dark,
                                                       borderPadding=(6, 8, 6, 8), leading=12))
        elements.append(bank_para)

    # Footer note (customizable)
    footer_note = (tenant.get("pdf_template") or {}).get("footer_note")
    if footer_note:
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(footer_note.replace("\n", "<br/>"),
                                  ParagraphStyle("fn", fontName=FONT_NAME, fontSize=8, textColor=colors.HexColor("#64748B"), leading=10, alignment=1)))
    # Brand footer
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("E-Moto Tamir · Servis Yönetim Sistemi",
                              ParagraphStyle("brand", fontName=FONT_NAME, fontSize=7, textColor=colors.HexColor("#94A3B8"), leading=8, alignment=1)))

    doc.build(elements)
    return buf.getvalue()


def _sig_cell(sig_b64, style):
    if not sig_b64 or not isinstance(sig_b64, str) or "," not in sig_b64:
        return Paragraph(f"<font face='{FONT_BOLD}'>MÜŞTERİ İMZA</font><br/><br/><br/>_______________________<br/>Ad Soyad / İmza", style)
    try:
        b = base64.b64decode(sig_b64.split(",", 1)[1])
        img = Image(io.BytesIO(b), width=7*cm, height=2.5*cm)
        return [Paragraph(f"<font face='{FONT_BOLD}'>MÜŞTERİ İMZA</font>", style), img]
    except Exception:
        return Paragraph(f"<font face='{FONT_BOLD}'>MÜŞTERİ İMZA</font><br/><br/><br/>_______________________<br/>Ad Soyad / İmza", style)

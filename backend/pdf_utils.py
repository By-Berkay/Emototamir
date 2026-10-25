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


# ---------- Ekspertiz (kontrol) raporu ----------
from xml.sax.saxutils import escape as _esc  # noqa: E402
from reportlab.platypus import PageBreak  # noqa: E402

INSPECTION_STATUS_META = {
    "good": ("İYİ", colors.HexColor("#059669")),
    "medium": ("ORTA", colors.HexColor("#D97706")),
    "service": ("BAKIM", colors.HexColor("#DC2626")),
}
BRAND_ORANGE = colors.HexColor("#F97316")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#E2E8F0")


def _p(text, size=9, bold=False, color=INK, align="left"):
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
    style = ParagraphStyle(
        "p", fontName=FONT_BOLD if bold else FONT_NAME, fontSize=size, leading=size * 1.35,
        textColor=color, alignment={"right": TA_RIGHT, "center": TA_CENTER}.get(align, TA_LEFT),
    )
    return Paragraph(_esc(str(text or "")), style)


def _section(title):
    t = Table([[_p(title, 9, bold=True)]], colWidths=[A4[0] - 30 * mm])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 1.2, BRAND_ORANGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [Spacer(1, 6 * mm), t, Spacer(1, 3 * mm)]


def _fit_image(data: bytes, max_w: float, max_h: float):
    from reportlab.lib.utils import ImageReader
    iw, ih = ImageReader(io.BytesIO(data)).getSize()
    scale = min(max_w / iw, max_h / ih)
    return Image(io.BytesIO(data), width=iw * scale, height=ih * scale)


def build_inspection_pdf(doc: dict, tenant: dict = None, photo_bytes: dict = None, logo_bytes: bytes = None) -> bytes:
    """Ekspertiz raporu: başlık, araç bilgileri, kontrol listesi, notlar, imzalar ve fotoğraflar."""
    _register_fonts()
    tenant = tenant or {}
    photo_bytes = photo_bytes or {}
    buf = io.BytesIO()
    pdf = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=16 * mm,
        title=f"Ekspertiz {doc.get('report_no', '')}", author=tenant.get("name", ""),
    )
    W = A4[0] - 30 * mm
    story = []

    # Başlık
    left = [_p(tenant.get("name") or "Servis", 14, bold=True)]
    for key in ("address", "phone"):
        if tenant.get(key):
            left.append(_p(tenant[key], 8, color=MUTED))
    logo_cell = ""
    if logo_bytes:
        try:
            logo_cell = Image(io.BytesIO(logo_bytes), width=18 * mm, height=18 * mm, kind="proportional")
        except Exception:
            logo_cell = ""
    right = [
        _p("EKSPERTİZ RAPORU", 13, bold=True, color=BRAND_ORANGE, align="right"),
        _p(f"Rapor No: {doc.get('report_no', '-')}", 9, align="right"),
        _p(f"Tarih: {_fmt_date(doc.get('inspection_date'))}", 9, color=MUTED, align="right"),
    ]
    head = Table([[logo_cell, left, right]], colWidths=[22 * mm, W * 0.45, W * 0.55 - 22 * mm])
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, BRAND_ORANGE), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(head)

    # Araç ve sahip bilgileri (2 çift sütun)
    info = [
        ("Araç Sahibi", doc.get("owner_name")), ("Telefon", doc.get("customer_phone")),
        ("Plaka", doc.get("plate")), ("Marka / Model", doc.get("make_model")),
        ("Model Yılı", doc.get("year")), ("Kilometre", doc.get("km")),
        ("Şase No", doc.get("chassis_no")),
    ]
    rows = []
    for i in range(0, len(info), 2):
        row = []
        for label, val in info[i:i + 2]:
            row += [_p(label.upper(), 7, color=MUTED), _p(val or "-", 9, bold=True)]
        row += [""] * (4 - len(row))
        rows.append(row)
    grid = Table(rows, colWidths=[W * 0.16, W * 0.34, W * 0.16, W * 0.34])
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(grid)

    # Kontrol listesi (gruplu)
    story += _section("KONTROL LİSTESİ")
    groups: dict = {}
    for it in doc.get("items", []):
        groups.setdefault(it.get("group") or "Diğer", []).append(it)
    table_rows = [[_p("Madde", 8, bold=True, color=MUTED), _p("Durum", 8, bold=True, color=MUTED, align="center"),
                   _p("Not", 8, bold=True, color=MUTED)]]
    cmds = [("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    for gname, items in groups.items():
        table_rows.append([_p(gname.upper(), 7.5, bold=True, color=BRAND_ORANGE), "", ""])
        r = len(table_rows) - 1
        cmds += [("SPAN", (0, r), (-1, r)), ("BACKGROUND", (0, r), (-1, r), colors.HexColor("#F8FAFC"))]
        for it in items:
            meta = INSPECTION_STATUS_META.get(it.get("status"))
            if meta:
                pill = Table([[_p(meta[0], 7, bold=True, color=colors.white, align="center")]],
                             colWidths=[18 * mm], hAlign="CENTER")
                pill.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), meta[1]), ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]))
                status_cell = pill
            else:
                status_cell = _p("-", 8, color=MUTED, align="center")
            table_rows.append([_p(it.get("label", ""), 9), status_cell, _p(it.get("note") or "", 8, color=MUTED)])
    if len(table_rows) > 1:
        checklist = Table(table_rows, colWidths=[W * 0.42, W * 0.18, W * 0.40], repeatRows=1)
        checklist.setStyle(TableStyle(cmds))
        story.append(checklist)
    else:
        story.append(_p("Kontrol maddesi girilmedi.", 9, color=MUTED))

    # Notlar
    if doc.get("notes"):
        story += _section("NOTLAR VE GÖZLEMLER")
        box = Table([[_p(doc["notes"], 9)]], colWidths=[W])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
            ("LINEBEFORE", (0, 0), (0, -1), 2.5, BRAND_ORANGE),
            ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(box)

    # İmzalar
    story.append(Spacer(1, 10 * mm))
    sig = Table(
        [[_p("Teknisyen", 8, color=MUTED), _p("Teslim Alan", 8, color=MUTED)],
         ["", ""],
         [_p(doc.get("technician_name") or " ", 10, bold=True), _p(doc.get("receiver_name") or " ", 10, bold=True)]],
        colWidths=[W / 2, W / 2], rowHeights=[None, 16 * mm, None],
    )
    sig.setStyle(TableStyle([("LINEABOVE", (0, 2), (-1, 2), 0.5, MUTED), ("TOPPADDING", (0, 2), (-1, 2), 4)]))
    story.append(sig)

    # Fotoğraflar (2 sütunlu ızgara)
    photos = [p for p in doc.get("photos", []) if p.get("id") in photo_bytes]
    if photos:
        story.append(PageBreak())
        story += _section("FOTOĞRAFLAR")
        label_map = {it["key"]: it.get("label", it["key"]) for it in doc.get("items", [])}
        cells = []
        for p in photos:
            try:
                img = _fit_image(photo_bytes[p["id"]], W / 2 - 8 * mm, 62 * mm)
            except Exception:
                continue
            cells.append([img, _p(label_map.get(p.get("item_key"), p.get("item_key", "")), 8, color=MUTED)])
        for i in range(0, len(cells), 2):
            pair = cells[i:i + 2] + [""] * (2 - len(cells[i:i + 2]))
            grid_row = Table([pair], colWidths=[W / 2, W / 2])
            grid_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
            story.append(grid_row)

    def _footer(canv, _doc):
        canv.saveState()
        canv.setFont(FONT_NAME, 7.5)
        canv.setFillColor(MUTED)
        canv.drawString(15 * mm, 9 * mm, f"{tenant.get('name', '')} · Ekspertiz {doc.get('report_no', '')}")
        canv.drawRightString(A4[0] - 15 * mm, 9 * mm, f"Sayfa {canv.getPageNumber()}")
        canv.restoreState()

    pdf.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()

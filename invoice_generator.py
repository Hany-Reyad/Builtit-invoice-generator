"""
BuiltIt. Invoice PDF Generator
Produces an A4 PDF invoice matching the BuiltIt. brand design.
Uses Poppins if available, falls back to Helvetica on servers without the font.
"""

import os
import sys
import json

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ── Page constants ─────────────────────────────────────────────────────────────
W, H  = A4
ML    = 18 * mm
MR    = 18 * mm
RX    = W - MR
CW    = W - ML - MR

GREEN = colors.HexColor("#00C47A")
BLACK = colors.HexColor("#0D0D0D")
LGREY = colors.HexColor("#CCCCCC")
WHITE = colors.white

# ── Font setup ─────────────────────────────────────────────────────────────────
# Try several locations where Poppins might live
_FONT_DIRS = [
    "/usr/share/fonts/truetype/google-fonts",
    "/usr/share/fonts/google-fonts",
    "/usr/share/fonts",
    os.path.join(os.path.dirname(__file__), "fonts"),
]

_FONT_MAP = {
    "PP":  ("Poppins-Regular.ttf",  "Helvetica"),
    "PPB": ("Poppins-Bold.ttf",     "Helvetica-Bold"),
    "PPM": ("Poppins-Medium.ttf",   "Helvetica"),
}

def _find_font(filename):
    for d in _FONT_DIRS:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            return p
    return None

def _setup_fonts():
    registered = {}
    for alias, (ttf_file, fallback) in _FONT_MAP.items():
        path = _find_font(ttf_file)
        if path:
            try:
                pdfmetrics.registerFont(TTFont(alias, path))
                registered[alias] = alias
            except Exception:
                registered[alias] = fallback
        else:
            registered[alias] = fallback
    return registered

_FONTS = _setup_fonts()

def F(alias):
    """Return the registered font name for the given alias."""
    return _FONTS.get(alias, "Helvetica")

# ── Drawing helpers ────────────────────────────────────────────────────────────

def hl(c, y, x1=None, x2=None, color=BLACK, lw=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x1 if x1 is not None else ML, y,
           x2 if x2 is not None else RX,  y)

def t(c, x, y, s, f="PP", sz=9, col=BLACK, align="left"):
    c.setFont(F(f), sz)
    c.setFillColor(col)
    s = str(s)
    if   align == "right":  c.drawRightString(x, y, s)
    elif align == "center": c.drawCentredString(x, y, s)
    else:                   c.drawString(x, y, s)

def sw(c, s, f, sz):
    return c.stringWidth(str(s), F(f), sz)

def wrap(c, words, f, sz, max_w):
    lines, line = [], ""
    for w in words:
        test = (line + " " + w).strip()
        if sw(c, test, f, sz) <= max_w:
            line = test
        else:
            if line: lines.append(line)
            line = w
    if line: lines.append(line)
    return lines

def draw_logo(c, rx, y, sz=22):
    it_w  = sw(c, "It",  "PPB", sz)
    dot_w = sw(c, ".",   "PPB", sz)
    x = rx - it_w - dot_w
    t(c, x,        y, "It", "PPB", sz, BLACK)
    t(c, x + it_w, y, ".",  "PPB", sz, GREEN)

# ── Main generator ─────────────────────────────────────────────────────────────

def generate_invoice(data: dict, out_path: str):
    currency = data.get("currency", "EGP")

    c = canvas.Canvas(out_path, pagesize=A4)
    c.setTitle(f"BuiltIt. Invoice — {data.get('clientName','')}")

    # ═══════════════════════════════════════════════════
    # PAGE 1
    # ═══════════════════════════════════════════════════
    y = H - 16 * mm

    # Header
    t(c, ML, y, "INVOICE", "PPB", 28, GREEN)
    draw_logo(c, RX, y, 26)
    y -= 9 * mm

    hl(c, y, lw=1)
    y -= 6 * mm

    # Billed to / Invoice no
    t(c, ML,             y, "BILLED TO:", "PPB", 8, GREEN)
    t(c, ML + 22 * mm,   y, data.get("clientName","").upper(), "PPB", 8, BLACK)

    inv_num   = data.get("invoiceNumber", "001")
    inv_lbl   = "INVOICE NO."
    inv_num_w = sw(c, inv_num, "PPB", 8)
    inv_lbl_w = sw(c, inv_lbl + " ", "PPB", 8)
    t(c, RX - inv_num_w,              y, inv_num, "PPB", 8, BLACK)
    t(c, RX - inv_num_w - inv_lbl_w,  y, inv_lbl, "PPB", 8, GREEN)

    y -= 5 * mm
    t(c, ML,           y, "DATE",                      "PPB", 8, GREEN)
    t(c, ML + 14 * mm, y, data.get("invoiceDate",""),  "PPB", 8, BLACK)

    y -= 5 * mm
    hl(c, y, lw=1)
    y -= 6 * mm

    # Payment table columns
    C_DESC  = ML
    C_PRICE = ML + 70 * mm
    C_PAID  = ML + 108 * mm
    C_INST  = RX

    for label, x, al in [
        ("PAYMENTS",     C_DESC,  "left"),
        ("PRICE",        C_PRICE, "left"),
        ("PAID BY",      C_PAID,  "left"),
        ("INSTALLMENTS", C_INST,  "right"),
    ]:
        t(c, x, y, label, "PPB", 8, GREEN, al)

    y -= 4 * mm
    hl(c, y, color=LGREY, lw=0.4)
    y -= 4 * mm

    LH = 4.2 * mm
    for row in data.get("payments", []):
        desc_words  = row.get("description","").split()
        price_lines = str(row.get("price","")).split("\n")
        paid_lines  = str(row.get("paidBy","")).split("\n")
        inst        = str(row.get("installment",""))

        desc_lines = wrap(c, desc_words, "PP", 8, 62 * mm) if desc_words else []
        row_lines  = max(len(desc_lines), len(price_lines), len(paid_lines), 1)
        row_top    = y

        for i, dl in enumerate(desc_lines):
            t(c, C_DESC,  row_top - i * LH, dl, "PP", 8, BLACK)
        for i, pl in enumerate(price_lines):
            t(c, C_PRICE, row_top - i * LH, pl, "PP", 8, BLACK)
        for i, pb in enumerate(paid_lines):
            t(c, C_PAID,  row_top - i * LH, pb, "PP", 8, BLACK)
        t(c, C_INST, row_top, inst, "PPB", 9, BLACK, "right")

        y -= row_lines * LH + 3 * mm
        hl(c, y, color=LGREY, lw=0.3)
        y -= 3 * mm

    # Grand total
    y -= 1 * mm
    t(c, C_PRICE, y, "GRAND TOTAL", "PPB", 10, GREEN)
    t(c, C_INST,  y, f"{data.get('grandTotal','')} {currency}", "PPB", 11, BLACK, "right")
    y -= 5 * mm
    hl(c, y, lw=1)
    y -= 7 * mm

    # Project Timeline
    t(c, ML, y, "PROJECT TIMELINE", "PPB", 9, GREEN)
    t(c, RX, y, "DESCRIPTION",      "PPB", 9, GREEN, "right")
    y -= 4.5 * mm
    t(c, ML, y, data.get("timelineDate", data.get("invoiceDate","")).upper(), "PPB", 8, GREEN)
    y -= 3 * mm
    hl(c, y, color=LGREY, lw=0.4)
    y -= 5 * mm

    WEEK_W    = 22 * mm
    DESC_X    = ML + WEEK_W + 2 * mm
    DESC_W    = CW - WEEK_W - 2 * mm

    for item in data.get("projectTimeline", []):
        week = item.get("week","").upper()
        desc = item.get("description","").upper()

        desc_lines = wrap(c, desc.split(), "PP", 7.5, DESC_W)
        row_h      = len(desc_lines) * 4 * mm

        week_y = y - (row_h / 2) + 2.5
        t(c, ML + WEEK_W / 2, week_y, week, "PPB", 7.5, BLACK, "center")

        c.setStrokeColor(LGREY)
        c.setLineWidth(0.3)
        c.line(ML + WEEK_W, y + 2, ML + WEEK_W, y - row_h + 2)

        for i, dl in enumerate(desc_lines):
            t(c, DESC_X, y - i * 4 * mm, dl, "PP", 7.5, BLACK)

        y -= row_h + 2 * mm

    # Footer page 1
    fy = 16 * mm
    hl(c, fy + 8 * mm, lw=0.5)
    t(c, ML, fy + 5.5 * mm, "PAYMENT INFO", "PPB", 8, GREEN)
    for i, line in enumerate(data.get("paymentInfo", [])):
        t(c, ML, fy + 1 * mm - i * 3.8 * mm, line, "PP", 7.5, BLACK)

    c.showPage()

    # ═══════════════════════════════════════════════════
    # PAGE 2
    # ═══════════════════════════════════════════════════
    y = H - 16 * mm
    draw_logo(c, RX, y, 22)
    y -= 9 * mm
    hl(c, y, lw=1)
    y -= 7 * mm

    BULLET_X = ML + 3.5 * mm
    BODY_X   = ML + 8 * mm
    BODY_W   = CW - 8 * mm
    LH2      = 4.5 * mm

    def draw_section(title, items):
        nonlocal y
        t(c, ML, y, title, "PPB", 11, GREEN)
        y -= 4.5 * mm
        hl(c, y, lw=0.8)
        y -= 5.5 * mm

        for item in items:
            ititle = item.get("title", "")
            idesc  = item.get("description", "")

            # Bullet dot
            c.setFillColor(BLACK)
            c.circle(BULLET_X, y + 2.5, 1.5, fill=1, stroke=0)

            prefix   = ititle + ": "
            prefix_w = sw(c, prefix, "PPB", 8.5)

            # Draw bold prefix
            t(c, BODY_X, y, prefix, "PPB", 8.5, BLACK)

            # Fit remaining desc on first line then wrap
            avail      = BODY_W - prefix_w
            desc_words = idesc.split()
            first_line = ""
            remaining  = list(desc_words)

            while remaining:
                test = (first_line + " " + remaining[0]).strip()
                if sw(c, test, "PP", 8.5) <= avail:
                    first_line = test
                    remaining.pop(0)
                else:
                    break

            t(c, BODY_X + prefix_w, y, first_line, "PP", 8.5, BLACK)
            y -= LH2

            if remaining:
                for rl in wrap(c, remaining, "PP", 8.5, BODY_W):
                    t(c, BODY_X, y, rl, "PP", 8.5, BLACK)
                    y -= LH2

            y -= 2.5 * mm

        y -= 3 * mm

    draw_section("DELIVERABLES",      data.get("deliverables", []))
    draw_section("TECHNOLOGIES USED", data.get("technologies", []))

    # Footer page 2
    fy = 16 * mm
    hl(c, fy + 14 * mm, lw=0.5)
    t(c, ML, fy + 10.5 * mm, "PAYMENT INFO", "PPB", 8, GREEN)
    for i, line in enumerate(data.get("paymentInfo", [])):
        t(c, ML, fy + 6 * mm - i * 3.8 * mm, line, "PP", 7.5, BLACK)

    t(c, RX, fy + 10.5 * mm, "THANK YOU FOR",  "PPB", 11, GREEN, "right")
    t(c, RX, fy + 4.5 * mm,  "YOUR BUSINESS.", "PPB", 11, GREEN, "right")

    c.save()


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Read JSON from stdin (called by server.js via spawnSync)
    raw  = sys.stdin.read().strip()
    data = json.loads(raw)
    out  = data.pop("outPath")
    generate_invoice(data, out)
    sys.exit(0)

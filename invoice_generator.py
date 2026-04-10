"""
BuiltIt. Invoice PDF Generator
Produces an A4 invoice matching the BuiltIt. brand design.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

W, H   = A4
ML     = 18 * mm   # margin left
MR     = 18 * mm   # margin right
RX     = W - MR    # right edge
CW     = W - ML - MR  # content width

GREEN  = colors.HexColor("#00C47A")
BLACK  = colors.HexColor("#0D0D0D")
GREY   = colors.HexColor("#666666")
LGREY  = colors.HexColor("#CCCCCC")

FONT_DIR = "/usr/share/fonts/truetype/google-fonts"

def register_fonts():
    for name, file in [
        ("PP",  "Poppins-Regular.ttf"),
        ("PPB", "Poppins-Bold.ttf"),
        ("PPM", "Poppins-Medium.ttf"),
    ]:
        path = os.path.join(FONT_DIR, file)
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont(name, path))

register_fonts()


# ── Low-level helpers ──────────────────────────────────────────────────────────

def hl(c, y, x1=None, x2=None, color=BLACK, lw=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x1 if x1 is not None else ML, y, x2 if x2 is not None else RX, y)

def t(c, x, y, s, f="PP", sz=9, col=BLACK, align="left"):
    c.setFont(f, sz)
    c.setFillColor(col)
    s = str(s)
    if align == "right":   c.drawRightString(x, y, s)
    elif align == "center": c.drawCentredString(x, y, s)
    else:                   c.drawString(x, y, s)

def string_w(c, s, f, sz):
    return c.stringWidth(str(s), f, sz)

def wrap_words(c, words, f, sz, max_w):
    """Split list of words into lines fitting max_w."""
    lines, line = [], ""
    for w in words:
        test = (line + " " + w).strip()
        if string_w(c, test, f, sz) <= max_w:
            line = test
        else:
            if line: lines.append(line)
            line = w
    if line: lines.append(line)
    return lines

def draw_logo(c, rx, y, sz=22):
    """Draw 'It.' right-aligned at rx."""
    dot_w = string_w(c, ".", "PPB", sz)
    it_w  = string_w(c, "It", "PPB", sz)
    x     = rx - it_w - dot_w
    t(c, x,       y, "It", "PPB", sz, BLACK)
    t(c, x + it_w, y, ".",  "PPB", sz, GREEN)


# ── Core generator ─────────────────────────────────────────────────────────────

def generate_invoice(data: dict, out_path: str):
    """
    data keys:
      clientName      str
      invoiceNumber   str
      invoiceDate     str
      timelineDate    str  (e.g. "April–June 2026")
      currency        str  (default "EGP")
      grandTotal      str
      payments        list[{description, price, paidBy, installment}]
      projectTimeline list[{week, description}]
      deliverables    list[{title, description}]
      technologies    list[{title, description}]
      paymentInfo     list[str]
    """

    currency = data.get("currency", "EGP")
    c = canvas.Canvas(out_path, pagesize=A4)
    c.setTitle(f"BuiltIt. Invoice — {data.get('clientName','')}")

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1
    # ══════════════════════════════════════════════════════════════════════════
    y = H - 16 * mm

    # Header
    t(c, ML, y, "INVOICE", "PPB", 28, GREEN)
    draw_logo(c, RX, y, 26)
    y -= 9 * mm

    hl(c, y, lw=1)
    y -= 6 * mm

    # Billed to / Invoice no
    t(c, ML, y, "BILLED TO:", "PPB", 8, GREEN)
    t(c, ML + 22 * mm, y, data.get("clientName","").upper(), "PPB", 8, BLACK)
    inv_num = data.get("invoiceNumber","001")
    inv_lbl = "INVOICE NO."
    inv_lbl_w = string_w(c, inv_lbl + " ", "PPB", 8)
    inv_num_w = string_w(c, inv_num, "PPB", 8)
    t(c, RX - inv_num_w, y, inv_num, "PPB", 8, BLACK)
    t(c, RX - inv_num_w - inv_lbl_w, y, inv_lbl, "PPB", 8, GREEN)

    y -= 5 * mm
    t(c, ML, y, "DATE", "PPB", 8, GREEN)
    t(c, ML + 14 * mm, y, data.get("invoiceDate",""), "PPB", 8, BLACK)

    y -= 5 * mm
    hl(c, y, lw=1)
    y -= 6 * mm

    # Payment table columns
    C_DESC  = ML
    C_PRICE = ML + 70 * mm
    C_PAID  = ML + 108 * mm
    C_INST  = RX

    # Table header
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

    # Payment rows
    LH = 4.2 * mm   # line height inside rows
    for row in data.get("payments", []):
        desc_words  = row.get("description","").split()
        price_lines = str(row.get("price","")).split("\n")
        paid_lines  = str(row.get("paidBy","")).split("\n")
        inst        = str(row.get("installment",""))

        desc_lines  = wrap_words(c, desc_words, "PP", 8, 62 * mm) if desc_words else []

        row_lines = max(len(desc_lines), len(price_lines), len(paid_lines), 1)
        row_top   = y

        for i, dl in enumerate(desc_lines):
            t(c, C_DESC, row_top - i * LH, dl, "PP", 8, BLACK)
        for i, pl in enumerate(price_lines):
            t(c, C_PRICE, row_top - i * LH, pl, "PP", 8, BLACK)
        for i, pb in enumerate(paid_lines):
            t(c, C_PAID, row_top - i * LH, pb, "PP", 8, BLACK)
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

    # Project Timeline — two column layout
    # Left col: label "PROJECT TIMELINE" + date, right col: "DESCRIPTION"
    t(c, ML, y, "PROJECT TIMELINE", "PPB", 9, GREEN)
    t(c, RX,  y, "DESCRIPTION",     "PPB", 9, GREEN, "right")
    y -= 4.5 * mm
    t(c, ML, y, data.get("timelineDate", data.get("invoiceDate","")).upper(), "PPB", 8, GREEN)
    y -= 3 * mm
    hl(c, y, color=LGREY, lw=0.4)
    y -= 5 * mm

    # Timeline rows: week label left, description centred across full width
    WEEK_COL_W  = 22 * mm
    DESC_COL_X  = ML + WEEK_COL_W + 2 * mm
    DESC_COL_W  = CW - WEEK_COL_W - 2 * mm

    for item in data.get("projectTimeline", []):
        week  = item.get("week", "").upper()
        desc  = item.get("description", "").upper()

        desc_lines = wrap_words(c, desc.split(), "PP", 7.5, DESC_COL_W)
        row_h = len(desc_lines) * 4 * mm

        # week label vertically centered in row
        week_y = y - (row_h / 2) + 2.5
        t(c, ML + WEEK_COL_W / 2, week_y, week, "PPB", 7.5, BLACK, "center")

        # vertical divider
        c.setStrokeColor(LGREY)
        c.setLineWidth(0.3)
        c.line(ML + WEEK_COL_W, y + 2, ML + WEEK_COL_W, y - row_h + 2)

        for i, dl in enumerate(desc_lines):
            t(c, DESC_COL_X, y - i * 4 * mm, dl, "PP", 7.5, BLACK)

        y -= row_h + 2 * mm

    # Footer page 1
    footer_y = 16 * mm
    hl(c, footer_y + 8 * mm, lw=0.5)
    t(c, ML, footer_y + 5.5 * mm, "PAYMENT INFO", "PPB", 8, GREEN)
    for i, line in enumerate(data.get("paymentInfo",[])):
        t(c, ML, footer_y + 1 * mm - i * 3.8 * mm, line, "PP", 7.5, BLACK)

    c.showPage()

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2
    # ══════════════════════════════════════════════════════════════════════════
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
            ititle = item.get("title","")
            idesc  = item.get("description","")

            # Bullet dot
            c.setFillColor(BLACK)
            c.circle(BULLET_X, y + 2.5, 1.5, fill=1, stroke=0)

            # Measure bold title prefix
            prefix    = ititle + ": "
            prefix_w  = string_w(c, prefix, "PPB", 8.5)

            # Build full text: bold prefix then normal desc
            # We'll render line by line with mixed fonts
            all_text  = prefix + idesc
            # First line: prefix bold + rest normal on same line
            # Figure out how many chars of desc fit on first line
            avail_first = BODY_W - prefix_w
            desc_words  = idesc.split()
            first_line_words, remaining_words = [], desc_words[:]
            first_line = ""
            while remaining_words:
                test = (first_line + " " + remaining_words[0]).strip()
                if string_w(c, test, "PP", 8.5) <= avail_first:
                    first_line = test
                    first_line_words.append(remaining_words.pop(0))
                else:
                    break

            # Draw first line
            t(c, BODY_X, y, prefix, "PPB", 8.5, BLACK)
            t(c, BODY_X + prefix_w, y, first_line, "PP", 8.5, BLACK)
            y -= LH2

            # Remaining lines of desc
            if remaining_words:
                rem_lines = wrap_words(c, remaining_words, "PP", 8.5, BODY_W)
                for rl in rem_lines:
                    t(c, BODY_X, y, rl, "PP", 8.5, BLACK)
                    y -= LH2

            y -= 2.5 * mm

        y -= 3 * mm

    draw_section("DELIVERABLES",     data.get("deliverables", []))
    draw_section("TECHNOLOGIES USED", data.get("technologies", []))

    # Footer page 2
    footer_y = 16 * mm
    hl(c, footer_y + 14 * mm, lw=0.5)
    t(c, ML, footer_y + 10.5 * mm, "PAYMENT INFO", "PPB", 8, GREEN)
    for i, line in enumerate(data.get("paymentInfo",[])):
        t(c, ML, footer_y + 6 * mm - i * 3.8 * mm, line, "PP", 7.5, BLACK)

    t(c, RX, footer_y + 10.5 * mm, "THANK YOU FOR",  "PPB", 11, GREEN, "right")
    t(c, RX, footer_y + 4.5 * mm,  "YOUR BUSINESS.", "PPB", 11, GREEN, "right")

    c.save()


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys, json
    if not sys.stdin.isatty():
        # Called by server — read JSON from stdin
        raw  = sys.stdin.read()
        data = json.loads(raw)
        out  = data.pop("outPath")
        generate_invoice(data, out)
        sys.exit(0)
    # Manual test
    sample = {
        "clientName":    "Ammar Mamdoh",
        "invoiceNumber": "001",
        "invoiceDate":   "June 2026",
        "timelineDate":  "April–June 2026",
        "currency":      "EGP",
        "grandTotal":    "180,000",
        "payments": [
            {"description": "SIGHT Application Phase 1", "price": "70,000\npaid via Instapay", "paidBy": "7 April 2026",                        "installment": "35%"},
            {"description": "",                          "price": "30,000",                    "paidBy": "@80%\nonly 4 installments left",       "installment": "15%"},
            {"description": "",                          "price": "100,000",                   "paidBy": "7 June 2026\nat delivery",             "installment": "50%"},
        ],
        "projectTimeline": [
            {"week": "Week 1", "description": "Discovery, Business Requirements, User Flows, Architecture Planning"},
            {"week": "Week 2", "description": "Wireframes, UI Design, Prototype/Demo, Client Approval"},
            {"week": "Week 3", "description": "Landing Page, Authentication, Database Setup, Backend Foundation"},
            {"week": "Week 4", "description": "Supplier Dashboard and Buyer Dashboard Development"},
            {"week": "Week 5", "description": "Admin Dashboard, Chat/Messaging, Notifications, Reporting Integration"},
            {"week": "Week 6", "description": "Final QA, Bug Fixing, Feedback Revisions, Deployment, and Handover"},
        ],
        "deliverables": [
            {"title": "Landing Page",              "description": "Including a marketing page and a complete user sign-up flow."},
            {"title": "Supplier Dashboard",        "description": "Features include product upload capabilities, price update management, promotional tools, and an analytics suite."},
            {"title": "Buyer Dashboard",           "description": "Features include product browsing and filtering, comparison tools, procurement logs, and order tracking."},
            {"title": "Admin Dashboard",           "description": "Centralized management for users, transaction monitoring, and financial/activity reports."},
            {"title": "Communication Panel",       "description": "An in-app chat/messaging system to facilitate direct interaction between suppliers and buyers."},
            {"title": "Notification System",       "description": "Automated push and in-app alerts for price changes and special offers."},
            {"title": "Auth & Security Framework", "description": "Implementation of secure login protocols, user roles, and granular permissions."},
            {"title": "Mobile App Conversion",     "description": "A Flutter-based mobile wrap of the web system for cross-platform availability."},
        ],
        "technologies": [
            {"title": "Multi-tenant System Architecture", "description": "A scalable architecture designed to host multiple independent companies/users within a single shared system while maintaining strict data privacy."},
            {"title": "API & Backend Development",        "description": "Development of the core business logic and APIs required to connect all dashboards and modules."},
            {"title": "Database Management",              "description": "Implementation of PostgreSQL or Firebase for data storage."},
            {"title": "Scalability Planning",             "description": "Architectural setup designed for future integration of logistics, financing modules, and mobile expansion."},
            {"title": "Deployment & Hosting",             "description": "Complete setup of the hosting environment and initial system deployment."},
        ],
        "paymentInfo": ["Hany Amr Reyad", "Instapay 01151061060", "www.builtit.net"],
    }

    out = "/tmp/buildit-invoice-sample.pdf"
    generate_invoice(sample, out)
    print(f"Generated: {out}")

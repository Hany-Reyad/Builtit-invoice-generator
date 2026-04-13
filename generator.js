/**
 * BuiltIt. Generator — Invoice PDF + Proposal PPTX
 * PDFKit coordinate system: y=0 is TOP, increases downward.
 */

const PDFDocument = require("pdfkit");
const PptxGenJS   = require("pptxgenjs");
const fs          = require("fs");

const GREEN = "#00C47A";
const BLACK = "#0D0D0D";
const LGREY = "#CCCCCC";

// A4 points
const PW  = 595.28;
const PH  = 841.89;
const ML  = 51;
const MR  = 51;
const RX  = PW - MR;
const CW  = PW - ML - MR;

// ── Helpers ────────────────────────────────────────────────────────────────────

function hline(doc, y, opts = {}) {
  const { x1 = ML, x2 = RX, color = BLACK, lw = 0.5 } = opts;
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

function drawText(doc, x, y, str, opts = {}) {
  const { font = "Helvetica", size = 9, color = BLACK, align = "left", maxWidth = null } = opts;
  str = String(str == null ? "" : str);
  doc.save().font(font).fontSize(size).fillColor(color);
  const strW = doc.widthOfString(str);
  if (align === "right") {
    doc.text(str, x - strW, y, { lineBreak: false });
  } else if (align === "center") {
    doc.text(str, x - strW / 2, y, { lineBreak: false });
  } else {
    doc.text(str, x, y, { lineBreak: false, ...(maxWidth ? { width: maxWidth } : {}) });
  }
  doc.restore();
}

function strWidth(doc, str, font, size) {
  doc.save().font(font).fontSize(size);
  const w = doc.widthOfString(String(str == null ? "" : str));
  doc.restore();
  return w;
}

function wrapWords(doc, words, font, size, maxW) {
  doc.save().font(font).fontSize(size);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (doc.widthOfString(test) <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  doc.restore();
  return lines;
}

function drawLogo(doc, rx, y, size = 22) {
  doc.save().font("Helvetica-Bold").fontSize(size);
  const itW = doc.widthOfString("It");
  const x   = rx - itW - doc.widthOfString(".");
  doc.fillColor(BLACK).text("It", x,      y, { lineBreak: false });
  doc.fillColor(GREEN).text(".",  x + itW, y, { lineBreak: false });
  doc.restore();
}

// ── Generator ──────────────────────────────────────────────────────────────────

function generateInvoice(data, outPath) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", margin: 0, info: { Title: `BuiltIt. Invoice — ${data.clientName || ""}` } });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    stream.on("finish", resolve);
    stream.on("error",  reject);

    const currency = data.currency || "EGP";
    const LH = 13;  // line height in points

    // ═══════════════════════════════════════════════════
    // PAGE 1  (y increases downward, starts at 0 = top)
    // ═══════════════════════════════════════════════════
    let y = 40;

    // Header
    drawText(doc, ML, y, "INVOICE", { font: "Helvetica-Bold", size: 28, color: GREEN });
    drawLogo(doc, RX, y, 26);
    y += 34;

    hline(doc, y, { lw: 1 });
    y += 14;

    // Billed to / Invoice no
    const clientUpper = (data.clientName || "").toUpperCase();
    const invNum      = data.invoiceNumber || "001";
    const invLbl      = "INVOICE NO.";

    drawText(doc, ML,           y, "BILLED TO:",  { font: "Helvetica-Bold", size: 8, color: GREEN });
    drawText(doc, ML + 65,      y, clientUpper,   { font: "Helvetica-Bold", size: 8 });
    drawText(doc, RX,           y, invNum,         { font: "Helvetica-Bold", size: 8, align: "right" });
    drawText(doc, RX - strWidth(doc, invNum, "Helvetica-Bold", 8) - 4,
                                y, invLbl,         { font: "Helvetica-Bold", size: 8, color: GREEN, align: "right" });

    y += 13;
    drawText(doc, ML,      y, "DATE",                   { font: "Helvetica-Bold", size: 8, color: GREEN });
    drawText(doc, ML + 40, y, data.invoiceDate || "",   { font: "Helvetica-Bold", size: 8 });

    y += 13;
    hline(doc, y, { lw: 1 });
    y += 14;

    // Payment table columns
    const CD = ML;
    const CP = ML + 200;
    const CA = ML + 310;
    const CI = RX;

    [["PAYMENTS", CD, "left"], ["PRICE", CP, "left"], ["PAID BY", CA, "left"], ["INSTALLMENTS", CI, "right"]].forEach(([lbl, x, al]) => {
      drawText(doc, x, y, lbl, { font: "Helvetica-Bold", size: 8, color: GREEN, align: al });
    });

    y += 10;
    hline(doc, y, { color: LGREY, lw: 0.4 });
    y += 10;

    for (const row of (data.payments || [])) {
      const descWords  = (row.description || "").split(" ").filter(Boolean);
      const priceLines = String(row.price   || "").split("\n");
      const paidLines  = String(row.paidBy  || "").split("\n");
      const inst       = String(row.installment || "");

      const descLines = descWords.length ? wrapWords(doc, descWords, "Helvetica", 8, 190) : [];
      const rowLines  = Math.max(descLines.length, priceLines.length, paidLines.length, 1);
      const rowTop    = y;

      descLines.forEach((dl, i)  => drawText(doc, CD, rowTop + i * LH, dl,  { size: 8 }));
      priceLines.forEach((pl, i) => drawText(doc, CP, rowTop + i * LH, pl,  { size: 8 }));
      paidLines.forEach((pb, i)  => drawText(doc, CA, rowTop + i * LH, pb,  { size: 8 }));
      drawText(doc, CI, rowTop, inst, { font: "Helvetica-Bold", size: 9, align: "right" });

      y += rowLines * LH + 8;
      hline(doc, y, { color: LGREY, lw: 0.3 });
      y += 8;
    }

    // Grand total
    y += 3;
    drawText(doc, CP, y, "GRAND TOTAL", { font: "Helvetica-Bold", size: 10, color: GREEN });
    drawText(doc, CI, y, `${data.grandTotal || ""} ${currency}`, { font: "Helvetica-Bold", size: 11, align: "right" });

    y += 14;
    hline(doc, y, { lw: 1 });
    y += 18;

    // Project Timeline
    drawText(doc, ML, y, "PROJECT TIMELINE", { font: "Helvetica-Bold", size: 9, color: GREEN });
    drawText(doc, RX, y, "DESCRIPTION",      { font: "Helvetica-Bold", size: 9, color: GREEN, align: "right" });
    y += 12;
    drawText(doc, ML, y, (data.timelineDate || data.invoiceDate || "").toUpperCase(), { font: "Helvetica-Bold", size: 8, color: GREEN });
    y += 8;
    hline(doc, y, { color: LGREY, lw: 0.4 });
    y += 12;

    const WEEK_W = 62;
    const DESC_X = ML + WEEK_W + 6;
    const DESC_W = CW - WEEK_W - 6;

    for (const item of (data.projectTimeline || [])) {
      const week      = (item.week        || "").toUpperCase();
      const desc      = (item.description || "").toUpperCase();
      const dLines    = wrapWords(doc, desc.split(" "), "Helvetica", 7.5, DESC_W);
      const rowH      = dLines.length * 11;
      const weekY     = y + rowH / 2 - 4;

      drawText(doc, ML + WEEK_W / 2, weekY, week, { font: "Helvetica-Bold", size: 7.5, align: "center" });
      doc.save().strokeColor(LGREY).lineWidth(0.3)
         .moveTo(ML + WEEK_W, y - 2).lineTo(ML + WEEK_W, y + rowH + 2).stroke().restore();
      dLines.forEach((dl, i) => drawText(doc, DESC_X, y + i * 11, dl, { font: "Helvetica", size: 7.5 }));
      y += rowH + 6;
    }

    // Footer page 1
    const fy1 = PH - 55;
    hline(doc, fy1, { lw: 0.5 });
    drawText(doc, ML, fy1 + 10, "PAYMENT INFO", { font: "Helvetica-Bold", size: 8, color: GREEN });
    (data.paymentInfo || []).forEach((line, i) => drawText(doc, ML, fy1 + 22 + i * 11, line, { font: "Helvetica", size: 7.5 }));

    // ═══════════════════════════════════════════════════
    // PAGE 2
    // ═══════════════════════════════════════════════════
    doc.addPage({ size: "A4", margin: 0 });
    y = 40;

    drawLogo(doc, RX, y, 22);
    y += 28;
    hline(doc, y, { lw: 1 });
    y += 18;

    const BULLET_X = ML + 10;
    const BODY_X   = ML + 22;
    const BODY_W   = CW - 22;

    function drawSection(title, items) {
      drawText(doc, ML, y, title, { font: "Helvetica-Bold", size: 11, color: GREEN });
      y += 13;
      hline(doc, y, { lw: 0.8 });
      y += 14;

      for (const item of items) {
        const ititle  = item.title       || "";
        const idesc   = item.description || "";
        const prefix  = ititle + ": ";
        const prefW   = strWidth(doc, prefix, "Helvetica-Bold", 8.5);

        doc.save().fillColor(BLACK).circle(BULLET_X, y + 4, 1.8).fill().restore();
        drawText(doc, BODY_X, y, prefix, { font: "Helvetica-Bold", size: 8.5 });

        // Fit desc on first line then wrap remainder
        const avail  = BODY_W - prefW;
        const dWords = idesc.split(" ").filter(Boolean);
        let first    = "";
        const rem    = [...dWords];
        doc.save().font("Helvetica").fontSize(8.5);
        while (rem.length) {
          const test = first ? first + " " + rem[0] : rem[0];
          if (doc.widthOfString(test) <= avail) { first = test; rem.shift(); } else break;
        }
        doc.restore();

        drawText(doc, BODY_X + prefW, y, first, { font: "Helvetica", size: 8.5 });
        y += 13;

        if (rem.length) {
          wrapWords(doc, rem, "Helvetica", 8.5, BODY_W).forEach(rl => {
            drawText(doc, BODY_X, y, rl, { font: "Helvetica", size: 8.5 });
            y += 13;
          });
        }
        y += 6;
      }
      y += 10;
    }

    drawSection("DELIVERABLES",      data.deliverables  || []);
    drawSection("TECHNOLOGIES USED", data.technologies  || []);

    // Footer page 2
    const fy2 = PH - 65;
    hline(doc, fy2, { lw: 0.5 });
    drawText(doc, ML, fy2 + 10, "PAYMENT INFO", { font: "Helvetica-Bold", size: 8, color: GREEN });
    (data.paymentInfo || []).forEach((line, i) => drawText(doc, ML, fy2 + 22 + i * 11, line, { font: "Helvetica", size: 7.5 }));
    drawText(doc, RX, fy2 + 10, "THANK YOU FOR",  { font: "Helvetica-Bold", size: 11, color: GREEN, align: "right" });
    drawText(doc, RX, fy2 + 24, "YOUR BUSINESS.", { font: "Helvetica-Bold", size: 11, color: GREEN, align: "right" });

    doc.end();
  });
}

// ── Proposal PPTX Generator ────────────────────────────────────────────────────

/**
 * Generates a professional BuiltIt. proposal deck (.pptx).
 *
 * @param {Object} data
 *   clientName, clientIndustry, clientLogoBase64, clientLogoExt,
 *   projectTitle, projectType, projectSummary,
 *   scopeItems[], deliverables[], timeline, priceEGP,
 *   prototypeUrl, preparedBy, date, notes, theme
 * @param {string} outPath  Absolute path where the .pptx should be written.
 * @returns {Promise<void>}
 */
function generateProposal(data, outPath) {
  return new Promise((resolve, reject) => {
    try {
      const pptx = new PptxGenJS();

      // ── Presentation-level defaults ──────────────────────────────────────────
      pptx.layout   = "LAYOUT_WIDE";   // 13.33 × 7.5 inches
      pptx.author   = data.preparedBy || "BuiltIt.";
      pptx.company  = "BuiltIt.";
      pptx.subject  = `Proposal — ${data.projectTitle || ""}`;
      pptx.title    = `BuiltIt. Proposal — ${data.clientName || ""}`;

      // ── Palette ──────────────────────────────────────────────────────────────
      const C_GREEN  = "00C47A";
      const C_BLACK  = "0D0D0D";
      const C_WHITE  = "FFFFFF";
      const C_GREY   = "888888";
      const C_DARK   = "141414";
      const C_CARD   = "1E1E1E";
      const C_BORDER = "2A2A2A";

      // Slide dimensions (inches, LAYOUT_WIDE)
      const SW = 13.33;
      const SH = 7.5;

      // ── Shared helpers ───────────────────────────────────────────────────────

      /** Full-bleed dark background */
      function addBg(slide, color = C_BLACK) {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: SW, h: SH,
          fill: { color },
          line: { color, width: 0 },
        });
      }

      /** Thin horizontal rule */
      function addRule(slide, y, opts = {}) {
        const { x = 0.55, w = SW - 1.1, color = C_BORDER, size = 0.01 } = opts;
        slide.addShape(pptx.ShapeType.line, {
          x, y, w, h: 0,
          line: { color, width: size * 72 },
        });
      }

      /** BuiltIt. wordmark — "Built" in white, "It." in green */
      function addLogo(slide, x, y, fontSize = 22) {
        slide.addText(
          [
            { text: "Built", options: { color: C_WHITE } },
            { text: "It.", options: { color: C_GREEN } },
          ],
          { x, y, w: 1.5, h: 0.4, fontSize, bold: true, fontFace: "Calibri", valign: "top" }
        );
      }

      /** Slide-number badge (bottom-right) */
      function addSlideNum(slide, num, total) {
        slide.addText(`${num} / ${total}`, {
          x: SW - 1.1, y: SH - 0.38, w: 0.8, h: 0.25,
          fontSize: 7, color: C_GREY, align: "right", fontFace: "Calibri",
        });
      }

      /** Section label pill (small caps, green) */
      function addLabel(slide, text, x, y) {
        slide.addText(text.toUpperCase(), {
          x, y, w: 3, h: 0.22,
          fontSize: 7.5, bold: true, color: C_GREEN,
          fontFace: "Calibri", charSpacing: 2,
        });
      }

      /** Card rectangle */
      function addCard(slide, x, y, w, h, color = C_CARD) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x, y, w, h,
          rectRadius: 0.08,
          fill: { color },
          line: { color: C_BORDER, width: 0.75 },
        });
      }

      /** Accent left-border bar */
      function addAccentBar(slide, x, y, h) {
        slide.addShape(pptx.ShapeType.rect, {
          x, y, w: 0.045, h,
          fill: { color: C_GREEN },
          line: { color: C_GREEN, width: 0 },
        });
      }

      // ── Collect data ─────────────────────────────────────────────────────────
      const clientName    = data.clientName    || "Client";
      const clientInd     = data.clientIndustry || "";
      const projectTitle  = data.projectTitle  || "Project";
      const projectType   = data.projectType   || "";
      const projectSummary = data.projectSummary || "";
      const scopeItems    = Array.isArray(data.scopeItems)   ? data.scopeItems   : [];
      const deliverables  = Array.isArray(data.deliverables) ? data.deliverables : [];
      const timeline      = data.timeline  || "";
      const priceEGP      = data.priceEGP  ? Number(data.priceEGP).toLocaleString("en-EG") : "—";
      const prototypeUrl  = data.prototypeUrl || "";
      const preparedBy    = data.preparedBy || "Hanno — BuiltIt.";
      const date          = data.date       || "";
      const notes         = data.notes      || "";

      // Total slide count (prototype slide is conditional)
      const hasPrototype = Boolean(prototypeUrl);
      const TOTAL = 6 + (hasPrototype ? 1 : 0);

      // ── SLIDE 1 — Cover ──────────────────────────────────────────────────────
      {
        const slide = pptx.addSlide();
        addBg(slide);

        // Green accent strip (left edge)
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 0.18, h: SH,
          fill: { color: C_GREEN },
          line: { color: C_GREEN, width: 0 },
        });

        // Logo (top-right)
        addLogo(slide, SW - 1.8, 0.38, 24);

        // Prepared for label
        slide.addText("PREPARED FOR", {
          x: 0.55, y: 1.6, w: 4, h: 0.25,
          fontSize: 8, bold: true, color: C_GREEN,
          fontFace: "Calibri", charSpacing: 3,
        });

        // Client name
        slide.addText(clientName, {
          x: 0.55, y: 1.95, w: SW - 1.1, h: 1.1,
          fontSize: 52, bold: true, color: C_WHITE,
          fontFace: "Calibri", charSpacing: -1,
        });

        // Industry tag
        if (clientInd) {
          slide.addText(clientInd.toUpperCase(), {
            x: 0.55, y: 3.1, w: 5, h: 0.3,
            fontSize: 9, color: C_GREY,
            fontFace: "Calibri", charSpacing: 2,
          });
        }

        // Divider
        addRule(slide, 3.55, { color: C_BORDER });

        // Project title
        slide.addText(projectTitle, {
          x: 0.55, y: 3.75, w: SW - 1.1, h: 0.7,
          fontSize: 26, bold: true, color: C_WHITE,
          fontFace: "Calibri",
        });

        // Meta row: type · date · prepared by
        const metaParts = [projectType, date, preparedBy].filter(Boolean).join("   ·   ");
        slide.addText(metaParts, {
          x: 0.55, y: 4.55, w: SW - 1.1, h: 0.3,
          fontSize: 9, color: C_GREY, fontFace: "Calibri",
        });

        // Client logo (if provided)
        if (data.clientLogoBase64) {
          try {
            const ext  = (data.clientLogoExt || "png").replace(/^\./, "").toLowerCase();
            const b64  = data.clientLogoBase64.replace(/^data:[^;]+;base64,/, "");
            slide.addImage({
              data: `image/${ext};base64,${b64}`,
              x: SW - 2.4, y: SH - 1.8, w: 1.8, h: 1.2,
              sizing: { type: "contain", w: 1.8, h: 1.2 },
            });
          } catch (_) { /* skip bad logo data */ }
        }

        addSlideNum(slide, 1, TOTAL);
      }

      // ── SLIDE 2 — Project Overview ───────────────────────────────────────────
      {
        const slide = pptx.addSlide();
        addBg(slide);
        addLogo(slide, SW - 1.8, 0.32, 18);
        addRule(slide, 0.78);

        addLabel(slide, "Overview", 0.55, 0.32);

        slide.addText("Project Overview", {
          x: 0.55, y: 0.9, w: SW - 1.1, h: 0.55,
          fontSize: 28, bold: true, color: C_WHITE, fontFace: "Calibri",
        });

        // Summary card
        addCard(slide, 0.55, 1.6, SW - 1.1, 2.1);
        addAccentBar(slide, 0.55, 1.6, 2.1);
        slide.addText(projectSummary, {
          x: 0.75, y: 1.68, w: SW - 1.5, h: 1.95,
          fontSize: 12, color: C_WHITE, fontFace: "Calibri",
          valign: "top", wrap: true,
        });

        // Stats row: 3 cards
        const stats = [
          { label: "PROJECT TYPE", value: projectType || "Custom" },
          { label: "TIMELINE",     value: timeline    || "TBD"    },
          { label: "INVESTMENT",   value: `EGP ${priceEGP}`       },
        ];
        const cardW = (SW - 1.1 - 0.3) / 3;
        stats.forEach((s, i) => {
          const cx = 0.55 + i * (cardW + 0.15);
          addCard(slide, cx, 3.9, cardW, 1.35);
          slide.addText(s.label, {
            x: cx + 0.18, y: 4.0, w: cardW - 0.3, h: 0.25,
            fontSize: 7.5, bold: true, color: C_GREEN,
            fontFace: "Calibri", charSpacing: 1.5,
          });
          slide.addText(s.value, {
            x: cx + 0.18, y: 4.3, w: cardW - 0.3, h: 0.75,
            fontSize: i === 2 ? 18 : 16, bold: true, color: C_WHITE,
            fontFace: "Calibri", valign: "middle",
          });
        });

        addSlideNum(slide, 2, TOTAL);
      }

      // ── SLIDE 3 — Scope of Work ──────────────────────────────────────────────
      {
        const slide = pptx.addSlide();
        addBg(slide);
        addLogo(slide, SW - 1.8, 0.32, 18);
        addRule(slide, 0.78);

        addLabel(slide, "Scope of Work", 0.55, 0.32);

        slide.addText("What We're Building", {
          x: 0.55, y: 0.9, w: SW - 1.1, h: 0.55,
          fontSize: 28, bold: true, color: C_WHITE, fontFace: "Calibri",
        });

        // Two-column grid of scope items
        const items = scopeItems.length ? scopeItems : ["Full website build", "Mobile-responsive design", "Handover of all files"];
        const half  = Math.ceil(items.length / 2);
        const col1  = items.slice(0, half);
        const col2  = items.slice(half);
        const colW  = (SW - 1.1 - 0.25) / 2;
        const itemH = 0.52;
        const startY = 1.65;

        [col1, col2].forEach((col, ci) => {
          const cx = 0.55 + ci * (colW + 0.25);
          col.forEach((item, ri) => {
            const iy = startY + ri * (itemH + 0.1);
            addCard(slide, cx, iy, colW, itemH, C_CARD);
            // Green dot
            slide.addShape(pptx.ShapeType.ellipse, {
              x: cx + 0.18, y: iy + 0.19, w: 0.1, h: 0.1,
              fill: { color: C_GREEN },
              line: { color: C_GREEN, width: 0 },
            });
            slide.addText(item, {
              x: cx + 0.36, y: iy + 0.1, w: colW - 0.5, h: itemH - 0.2,
              fontSize: 10.5, color: C_WHITE, fontFace: "Calibri", valign: "middle",
            });
          });
        });

        addSlideNum(slide, 3, TOTAL);
      }

      // ── SLIDE 4 — Deliverables & Timeline ───────────────────────────────────
      {
        const slide = pptx.addSlide();
        addBg(slide);
        addLogo(slide, SW - 1.8, 0.32, 18);
        addRule(slide, 0.78);

        addLabel(slide, "Deliverables & Timeline", 0.55, 0.32);

        slide.addText("What You Receive", {
          x: 0.55, y: 0.9, w: SW - 1.1, h: 0.55,
          fontSize: 28, bold: true, color: C_WHITE, fontFace: "Calibri",
        });

        // Left column — Deliverables
        const leftW = (SW - 1.1) * 0.55;
        addLabel(slide, "Deliverables", 0.55, 1.65);
        const dels = deliverables.length ? deliverables : ["Complete source code", "Hosting credentials"];
        dels.forEach((d, i) => {
          const dy = 1.95 + i * 0.62;
          addCard(slide, 0.55, dy, leftW, 0.52, C_CARD);
          addAccentBar(slide, 0.55, dy, 0.52);
          slide.addText(d, {
            x: 0.75, y: dy + 0.1, w: leftW - 0.35, h: 0.35,
            fontSize: 10.5, color: C_WHITE, fontFace: "Calibri", valign: "middle",
          });
        });

        // Right column — Timeline card
        const rightX = 0.55 + leftW + 0.25;
        const rightW = SW - 1.1 - leftW - 0.25;
        addLabel(slide, "Timeline", rightX, 1.65);
        addCard(slide, rightX, 1.95, rightW, 2.2, C_CARD);
        addAccentBar(slide, rightX, 1.95, 2.2);

        // Clock icon (simple circle)
        slide.addShape(pptx.ShapeType.ellipse, {
          x: rightX + 0.25, y: 2.15, w: 0.55, h: 0.55,
          fill: { color: "00000000", transparency: 100 },
          line: { color: C_GREEN, width: 1.5 },
        });
        slide.addText("⏱", {
          x: rightX + 0.22, y: 2.12, w: 0.6, h: 0.6,
          fontSize: 20, color: C_GREEN, align: "center", fontFace: "Calibri",
        });

        slide.addText(timeline || "TBD", {
          x: rightX + 0.2, y: 2.85, w: rightW - 0.4, h: 0.65,
          fontSize: 20, bold: true, color: C_WHITE,
          fontFace: "Calibri", align: "center",
        });
        slide.addText("estimated delivery", {
          x: rightX + 0.2, y: 3.55, w: rightW - 0.4, h: 0.3,
          fontSize: 9, color: C_GREY, fontFace: "Calibri", align: "center",
        });

        addSlideNum(slide, 4, TOTAL);
      }

      // ── SLIDE 5 — Investment ─────────────────────────────────────────────────
      {
        const slide = pptx.addSlide();
        addBg(slide);
        addLogo(slide, SW - 1.8, 0.32, 18);
        addRule(slide, 0.78);

        addLabel(slide, "Investment", 0.55, 0.32);

        slide.addText("Your Investment", {
          x: 0.55, y: 0.9, w: SW - 1.1, h: 0.55,
          fontSize: 28, bold: true, color: C_WHITE, fontFace: "Calibri",
        });

        // Hero price card
        addCard(slide, 0.55, 1.65, SW - 1.1, 2.5, C_CARD);
        addAccentBar(slide, 0.55, 1.65, 2.5);

        slide.addText("TOTAL INVESTMENT", {
          x: 0.75, y: 1.85, w: SW - 1.5, h: 0.3,
          fontSize: 9, bold: true, color: C_GREEN,
          fontFace: "Calibri", charSpacing: 2,
        });
        slide.addText(`EGP ${priceEGP}`, {
          x: 0.75, y: 2.2, w: SW - 1.5, h: 1.0,
          fontSize: 52, bold: true, color: C_WHITE,
          fontFace: "Calibri", charSpacing: -1,
        });
        slide.addText("one-time · all-inclusive", {
          x: 0.75, y: 3.25, w: SW - 1.5, h: 0.3,
          fontSize: 10, color: C_GREY, fontFace: "Calibri",
        });

        // Notes / terms
        if (notes) {
          addCard(slide, 0.55, 4.35, SW - 1.1, 1.55, C_CARD);
          slide.addText("TERMS & NOTES", {
            x: 0.75, y: 4.45, w: SW - 1.5, h: 0.25,
            fontSize: 7.5, bold: true, color: C_GREEN,
            fontFace: "Calibri", charSpacing: 1.5,
          });
          slide.addText(notes, {
            x: 0.75, y: 4.75, w: SW - 1.5, h: 1.05,
            fontSize: 10, color: C_WHITE, fontFace: "Calibri",
            valign: "top", wrap: true,
          });
        } else {
          // Default payment terms
          const terms = [
            "50% deposit required to commence work.",
            "Remaining 50% due upon delivery.",
            "One revision round included.",
          ];
          addCard(slide, 0.55, 4.35, SW - 1.1, 1.55, C_CARD);
          slide.addText("PAYMENT TERMS", {
            x: 0.75, y: 4.45, w: SW - 1.5, h: 0.25,
            fontSize: 7.5, bold: true, color: C_GREEN,
            fontFace: "Calibri", charSpacing: 1.5,
          });
          terms.forEach((t, i) => {
            slide.addShape(pptx.ShapeType.ellipse, {
              x: 0.78, y: 4.82 + i * 0.32, w: 0.08, h: 0.08,
              fill: { color: C_GREEN },
              line: { color: C_GREEN, width: 0 },
            });
            slide.addText(t, {
              x: 0.95, y: 4.76 + i * 0.32, w: SW - 1.7, h: 0.28,
              fontSize: 10, color: C_WHITE, fontFace: "Calibri",
            });
          });
        }

        addSlideNum(slide, 5, TOTAL);
      }

      // ── SLIDE 6 (optional) — Prototype ──────────────────────────────────────
      let nextSlide = 6;
      if (hasPrototype) {
        const slide = pptx.addSlide();
        addBg(slide);
        addLogo(slide, SW - 1.8, 0.32, 18);
        addRule(slide, 0.78);

        addLabel(slide, "Interactive Prototype", 0.55, 0.32);

        slide.addText("See It in Action", {
          x: 0.55, y: 0.9, w: SW - 1.1, h: 0.55,
          fontSize: 28, bold: true, color: C_WHITE, fontFace: "Calibri",
        });

        // Browser-frame card
        addCard(slide, 0.55, 1.65, SW - 1.1, 3.8, C_CARD);

        // Browser chrome bar
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.55, y: 1.65, w: SW - 1.1, h: 0.38,
          fill: { color: C_BORDER },
          line: { color: C_BORDER, width: 0 },
        });
        // Traffic lights
        ["FF5F57", "FEBC2E", "28C840"].forEach((c, i) => {
          slide.addShape(pptx.ShapeType.ellipse, {
            x: 0.78 + i * 0.22, y: 1.79, w: 0.1, h: 0.1,
            fill: { color: c },
            line: { color: c, width: 0 },
          });
        });
        // URL bar
        slide.addText(prototypeUrl, {
          x: 1.6, y: 1.69, w: SW - 3.2, h: 0.28,
          fontSize: 8, color: C_GREY, fontFace: "Calibri",
          align: "center", valign: "middle",
        });

        // CTA
        slide.addText("Click to open interactive prototype →", {
          x: 0.55, y: 2.2, w: SW - 1.1, h: 0.5,
          fontSize: 14, color: C_GREEN, fontFace: "Calibri",
          align: "center", bold: true,
          hyperlink: { url: prototypeUrl },
        });
        slide.addText(prototypeUrl, {
          x: 0.55, y: 2.8, w: SW - 1.1, h: 0.35,
          fontSize: 10, color: C_GREY, fontFace: "Calibri",
          align: "center",
          hyperlink: { url: prototypeUrl },
        });

        slide.addText("Built with Stitch AI · Fully interactive · Click through the real flows", {
          x: 0.55, y: 3.3, w: SW - 1.1, h: 0.3,
          fontSize: 9, color: C_GREY, fontFace: "Calibri", align: "center",
        });

        addSlideNum(slide, nextSlide, TOTAL);
        nextSlide++;
      }

      // ── SLIDE 7 — Sign-off ───────────────────────────────────────────────────
      {
        const slide = pptx.addSlide();
        addBg(slide);

        // Green accent strip (right edge this time)
        slide.addShape(pptx.ShapeType.rect, {
          x: SW - 0.18, y: 0, w: 0.18, h: SH,
          fill: { color: C_GREEN },
          line: { color: C_GREEN, width: 0 },
        });

        addLogo(slide, SW - 1.8, 0.38, 24);

        slide.addText("Let's build", {
          x: 0.55, y: 1.8, w: SW - 1.1, h: 0.9,
          fontSize: 52, bold: true, color: C_WHITE,
          fontFace: "Calibri", charSpacing: -1,
        });
        slide.addText("something great.", {
          x: 0.55, y: 2.65, w: SW - 1.1, h: 0.9,
          fontSize: 52, bold: true, color: C_GREEN,
          fontFace: "Calibri", charSpacing: -1,
        });

        addRule(slide, 3.75, { color: C_BORDER });

        slide.addText(preparedBy, {
          x: 0.55, y: 3.95, w: 5, h: 0.35,
          fontSize: 12, bold: true, color: C_WHITE, fontFace: "Calibri",
        });
        slide.addText(date, {
          x: 0.55, y: 4.35, w: 5, h: 0.28,
          fontSize: 10, color: C_GREY, fontFace: "Calibri",
        });

        // Client name echo (bottom-right)
        slide.addText(clientName, {
          x: SW - 5.5, y: 3.95, w: 5.1, h: 0.35,
          fontSize: 12, bold: true, color: C_WHITE,
          fontFace: "Calibri", align: "right",
        });
        slide.addText(projectTitle, {
          x: SW - 5.5, y: 4.35, w: 5.1, h: 0.28,
          fontSize: 10, color: C_GREY,
          fontFace: "Calibri", align: "right",
        });

        addSlideNum(slide, nextSlide, TOTAL);
      }

      // ── Write to disk ────────────────────────────────────────────────────────
      pptx.writeFile({ fileName: outPath })
        .then(() => resolve())
        .catch(reject);

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateProposal, generateInvoice };

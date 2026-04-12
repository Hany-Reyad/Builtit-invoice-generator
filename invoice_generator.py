/**
 * BuiltIt. Invoice PDF Generator — Pure Node.js (no Python)
 * PDFKit coordinate system: y=0 is TOP, increases downward.
 */

const PDFDocument = require("pdfkit");
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

module.exports = { generateInvoice };

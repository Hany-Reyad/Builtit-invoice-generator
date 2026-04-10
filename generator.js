const pptxgen = require("pptxgenjs");

// ── Theme palettes ─────────────────────────────────────────────────────────────
const DARK = {
  bg1:      "0D0D0D",
  bg2:      "1A1A1A",
  bg3:      "2A2A2A",
  accent:   "4FFFB0",
  text1:    "FFFFFF",
  text2:    "F5F5F0",
  text3:    "888888",
  border:   "333333",
  footerBg: "1A1A1A",
};

const LIGHT = {
  bg1:      "F5F5F0",
  bg2:      "EAEAE5",
  bg3:      "FFFFFF",
  accent:   "00C47A",
  text1:    "0D0D0D",
  text2:    "1A1A1A",
  text3:    "666666",
  border:   "CCCCCC",
  footerBg: "E0E0DA",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function builtItWordmark(fontSize, T) {
  return [
    { text: "Built", options: { bold: true, fontSize, color: T.text1, charSpacing: -0.5, fontFace: "Poppins" } },
    { text: "It.",   options: { bold: true, fontSize, color: T.accent, charSpacing: -0.5, fontFace: "Poppins" } },
  ];
}

function accentBar(slide, pres, x, y, h, T) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.05, h,
    fill: { color: T.accent },
    line: { color: T.accent, width: 0 },
  });
}

function card(slide, pres, x, y, w, h, T) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: T.bg3 },
    line: { color: T.border, width: 0.5 },
    shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: T === DARK ? 0.3 : 0.08 },
  });
}

function iconSquare(slide, pres, x, y, T) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.22, h: 0.22,
    fill: { color: T.accent },
    line: { color: T.accent, width: 0 },
  });
}

async function generateProposal(data, outPath) {
  const {
    clientName,
    clientIndustry,
    clientLogoBase64,
    clientLogoExt,
    projectTitle,
    projectType,
    projectSummary,
    scopeItems,
    deliverables,
    timeline,
    priceEGP,
    prototypeUrl,
    preparedBy,
    date,
    notes,
    theme,
  } = data;

  const T = theme === "light" ? LIGHT : DARK;

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title  = `BuiltIt. Proposal — ${clientName}`;
  pres.author = "BuiltIt.";

  function txt(s, str, opts) {
    s.addText(str, { fontFace: "Poppins", ...opts });
  }

  // ── SLIDE 1 — Cover ──────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg1 };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.07, h: 5.625, fill: { color: T.accent }, line: { color: T.accent, width: 0 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.4, w: 10, h: 1.225, fill: { color: T.footerBg }, line: { color: T.footerBg, width: 0 } });

    s.addText(builtItWordmark(18, T), { x: 0.38, y: 0.28, w: 3.5, h: 0.5, margin: 0 });
    txt(s, "PAY ONCE · OWN FOREVER", { x: 0.38, y: 0.72, w: 4, h: 0.25, fontSize: 7, color: T.text3, charSpacing: 3, margin: 0 });
    txt(s, clientName, { x: 0.38, y: 1.35, w: 7.5, h: 1.1, fontSize: 52, bold: true, color: T.text1, charSpacing: -1, margin: 0 });
    txt(s, projectTitle, { x: 0.38, y: 2.55, w: 7, h: 0.55, fontSize: 20, color: T.accent, margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.38, y: 3.2, w: 2.8, h: 0.025, fill: { color: T.bg3 }, line: { color: T.bg3, width: 0 } });
    txt(s, `Project Type: ${projectType}`, { x: 0.38, y: 3.32, w: 5, h: 0.28, fontSize: 10, color: T.text3, margin: 0 });
    txt(s, `Date: ${date}`, { x: 0.38, y: 3.6, w: 5, h: 0.28, fontSize: 10, color: T.text3, margin: 0 });
    txt(s, `Prepared by: ${preparedBy}  ·  BuiltIt.  ·  Alexandria, Egypt`, { x: 0.38, y: 4.52, w: 8, h: 0.28, fontSize: 9, color: T.text3, margin: 0 });
    txt(s, "No subscriptions · No lock-in · 1-day delivery · Full ownership at handover", { x: 0.38, y: 4.88, w: 9.3, h: 0.28, fontSize: 8, color: T.border, margin: 0 });

    if (clientLogoBase64) {
      try {
        const ext  = (clientLogoExt || "png").toLowerCase();
        const mime = ext === "svg" ? "image/svg+xml" : (ext === "jpg" || ext === "jpeg") ? "image/jpeg" : "image/png";
        const raw  = clientLogoBase64.replace(/^data:[^;]+;base64,/, "");
        s.addImage({ data: `${mime};base64,${raw}`, x: 7.6, y: 0.2, w: 2.1, h: 1.1, sizing: { type: "contain", w: 2.1, h: 1.1 } });
      } catch (e) {
        txt(s, `[${clientName}]`, { x: 7.6, y: 0.3, w: 2.1, h: 0.6, fontSize: 14, bold: true, color: T.accent, align: "center", margin: 0 });
      }
    }
  }

  // ── SLIDE 2 — About BuiltIt. (3 cards: Pay Once, Own It, Fast Delivery) ──────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg2 };

    txt(s, "About BuiltIt.", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "Who We Are", { x: 0.5, y: 0.7, w: 9, h: 0.7, fontSize: 34, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    const cards2 = [
      { title: "Pay Once",      body: "One invoice. One time. No monthly platform fees, no agency retainers — ever. Your investment is fixed from day one." },
      { title: "You Own It",    body: "Files, code, and hosting credentials handed to you at delivery. Full ownership — no dependency on us or anyone else." },
      { title: "Fast Delivery", body: "Most projects go live within 1–4 business days. No drawn-out timelines, no waiting — we move at the speed of business." },
    ];

    cards2.forEach((c, i) => {
      const x = 0.5 + i * 3.1;
      card(s, pres, x, 1.75, 2.85, 2.85, T);
      accentBar(s, pres, x, 1.75, 2.85, T);
      iconSquare(s, pres, x + 0.2, 2.05, T);
      txt(s, c.title, { x: x + 0.2, y: 2.42, w: 2.5, h: 0.4, fontSize: 13, bold: true, color: T.text1, margin: 0 });
      txt(s, c.body,  { x: x + 0.2, y: 2.88, w: 2.52, h: 1.45, fontSize: 9.5, color: T.text3, margin: 0 });
    });

    txt(s, "Your platform owns you. BuiltIt. means you own it.", {
      x: 0.5, y: 4.82, w: 9, h: 0.38, fontSize: 11, italic: true, color: T.text3, align: "center", margin: 0,
    });
  }

  // ── SLIDE 3 — Project Overview ───────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg1 };

    txt(s, "Project Overview", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, projectTitle, { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 32, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    card(s, pres, 0.5, 1.55, 9, 2.3, T);
    accentBar(s, pres, 0.5, 1.55, 2.3, T);
    txt(s, "PROJECT SUMMARY", { x: 0.72, y: 1.72, w: 8.5, h: 0.3, fontSize: 8, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, projectSummary, { x: 0.72, y: 2.08, w: 8.5, h: 1.65, fontSize: 11.5, color: T.text1, margin: 0 });

    const meta = [
      { label: "Client",   value: clientName },
      { label: "Industry", value: clientIndustry || "—" },
      { label: "Type",     value: projectType },
      { label: "Timeline", value: timeline },
    ];
    meta.forEach((m, i) => {
      const x = 0.5 + i * 2.28;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 4.08, w: 2.1, h: 0.88, fill: { color: T.bg3 }, line: { color: T.border, width: 0.5 } });
      txt(s, m.label.toUpperCase(), { x: x + 0.12, y: 4.14, w: 1.9, h: 0.25, fontSize: 7, color: T.text3, charSpacing: 2, margin: 0 });
      txt(s, m.value, { x: x + 0.12, y: 4.4, w: 1.9, h: 0.42, fontSize: 11, bold: true, color: T.text1, margin: 0 });
    });
  }

  // ── SLIDE 4 — Scope of Work ──────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg2 };

    txt(s, "Scope of Work", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "What's Included", { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 32, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    card(s, pres, 0.5, 1.55, 9, 3.5, T);
    accentBar(s, pres, 0.5, 1.55, 3.5, T);

    const mid  = Math.ceil(scopeItems.length / 2);
    const col1 = scopeItems.slice(0, mid);
    const col2 = scopeItems.slice(mid);

    const makeItems = (items) => items.map((item, idx) => ({
      text: item,
      options: { bullet: true, color: idx % 2 === 0 ? T.text1 : T.text3, fontSize: 11, fontFace: "Poppins", breakLine: idx < items.length - 1 },
    }));

    s.addText(makeItems(col1), { x: 0.72, y: 1.82, w: 4.0, h: 3.1, margin: 0 });
    if (col2.length) s.addText(makeItems(col2), { x: 4.95, y: 1.82, w: 4.0, h: 3.1, margin: 0 });
  }

  // ── SLIDE 5 — Deliverables ───────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg1 };

    txt(s, "Deliverables", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "What You Receive at Handover", { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 30, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    // Remove indices 1, 4, 5 then take up to 6
    const filtered = deliverables.filter((_, i) => ![1, 4, 5].includes(i)).slice(0, 6);
    const perRow   = filtered.length <= 3 ? filtered.length : Math.ceil(filtered.length / 2);
    const cardW    = (9.0 - (perRow - 1) * 0.2) / perRow;

    filtered.forEach((item, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x   = 0.5 + col * (cardW + 0.2);
      const y   = 1.65 + row * 1.75;
      card(s, pres, x, y, cardW, 1.5, T);
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 0.06, fill: { color: T.accent }, line: { color: T.accent, width: 0 } });
      iconSquare(s, pres, x + 0.15, y + 0.22, T);
      txt(s, item, { x: x + 0.15, y: y + 0.62, w: cardW - 0.28, h: 0.72, fontSize: 10, color: T.text1, margin: 0 });
    });
  }

  // ── SLIDE 6 — Timeline ───────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg2 };

    txt(s, "Timeline", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "Project Delivery", { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 32, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    const phases = [
      { phase: "Kickoff & Brief",    desc: "Discovery call, site map review, content collection", day: "Day 1" },
      { phase: "Design & Build",     desc: "Full development — responsive, RTL, Fawry & shipping", day: "Day 1–2" },
      { phase: "Review & Revisions", desc: "Client review round, feedback applied, final QA pass", day: "Day 2–3" },
      { phase: "Handover",           desc: "Files, code, hosting credentials, docs delivered", day: "Day 3–4" },
    ];

    s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 2.67, w: 8.3, h: 0.03, fill: { color: T.bg3 }, line: { color: T.bg3, width: 0 } });

    phases.forEach((p, i) => {
      const x = 0.5 + i * 2.3;
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 2.42, w: 0.48, h: 0.48, fill: { color: T.accent }, line: { color: T.accent, width: 0 } });
      txt(s, String(i + 1), { x: x + 0.2, y: 2.42, w: 0.48, h: 0.48, fontSize: 10, bold: true, color: T.bg1, align: "center", valign: "middle", margin: 0 });
      txt(s, p.day,   { x, y: 1.92, w: 2.1, h: 0.35, fontSize: 9,  bold: true, color: T.accent, align: "center", margin: 0 });
      txt(s, p.phase, { x, y: 3.05, w: 2.1, h: 0.4,  fontSize: 10, bold: true, color: T.text1,  align: "center", margin: 0 });
      txt(s, p.desc,  { x, y: 3.52, w: 2.1, h: 1.35, fontSize: 9,              color: T.text3,  align: "center", margin: 0 });
    });

    s.addShape(pres.shapes.RECTANGLE, { x: 3.2, y: 4.95, w: 3.6, h: 0.45, fill: { color: T.accent }, line: { color: T.accent, width: 0 } });
    txt(s, `Estimated Delivery: ${timeline}`, { x: 3.2, y: 4.95, w: 3.6, h: 0.45, fontSize: 11, bold: true, color: T.bg1, align: "center", valign: "middle", margin: 0 });
  }

  // ── SLIDE 7 — Investment ─────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg1 };

    txt(s, "Investment", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "One Time. Yours Forever.", { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 32, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    card(s, pres, 0.5, 1.55, 5.8, 2.8, T);
    accentBar(s, pres, 0.5, 1.55, 2.8, T);
    txt(s, "ONE-TIME PAYMENT", { x: 0.72, y: 1.8, w: 5.3, h: 0.3, fontSize: 8, bold: true, color: T.accent, charSpacing: 3, margin: 0 });
    txt(s, `EGP ${parseInt(priceEGP).toLocaleString()}`, { x: 0.72, y: 2.12, w: 5.3, h: 0.92, fontSize: 54, bold: true, color: T.text1, charSpacing: -1, margin: 0 });
    txt(s, `${projectType} Package`, { x: 0.72, y: 3.1, w: 5.3, h: 0.35, fontSize: 12, color: T.text3, margin: 0 });
    txt(s, "No subscriptions · No lock-in · Full ownership at handover", { x: 0.72, y: 3.5, w: 5.3, h: 0.3, fontSize: 9, color: T.text3, margin: 0 });

    card(s, pres, 6.5, 1.55, 3.0, 2.8, T);
    txt(s, "INCLUDED", { x: 6.65, y: 1.8, w: 2.7, h: 0.3, fontSize: 8, bold: true, color: T.accent, charSpacing: 3, margin: 0 });
    const included = ["Source code & files", "Hosting credentials", "Fawry & shipping setup", "Arabic RTL support", "Mobile responsive", "1 revision round"];
    s.addText(
      included.map((t, i) => ({ text: t, options: { bullet: true, fontSize: 9.5, fontFace: "Poppins", color: i % 2 === 0 ? T.text1 : T.text3, breakLine: i < included.length - 1 } })),
      { x: 6.65, y: 2.15, w: 2.7, h: 2.0, margin: 0 }
    );

    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.65, w: 9.0, h: 0.65, fill: { color: T.bg3 }, line: { color: T.border, width: 0.5 } });
    txt(s, "vs. EGP 25,200/yr on ExpandCart Professional — you break even in under 12 months, then it costs nothing.", {
      x: 0.7, y: 4.72, w: 8.6, h: 0.45, fontSize: 10, color: T.text3, italic: true, margin: 0,
    });
  }

  // ── SLIDE 8 — Prototype ──────────────────────────────────────────────────────
  if (prototypeUrl && prototypeUrl.startsWith("http")) {
    const s = pres.addSlide();
    s.background = { color: T.bg2 };

    txt(s, "Design Preview", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "Interactive Prototype", { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 32, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    card(s, pres, 0.5, 1.55, 9, 2.8, T);
    accentBar(s, pres, 0.5, 1.55, 2.8, T);
    txt(s, "LIVE PREVIEW", { x: 0.72, y: 1.85, w: 8, h: 0.3, fontSize: 8, bold: true, color: T.accent, charSpacing: 3, margin: 0 });
    txt(s, "Your website design is ready to explore:", { x: 0.72, y: 2.25, w: 8, h: 0.4, fontSize: 13, color: T.text1, margin: 0 });
    txt(s, prototypeUrl, { x: 0.72, y: 2.75, w: 8, h: 0.45, fontSize: 14, color: T.accent, bold: true, margin: 0, hyperlink: { url: prototypeUrl } });
    txt(s, "Built with Stitch AI · Click the link above to view the interactive prototype", { x: 0.72, y: 3.3, w: 8, h: 0.3, fontSize: 9, color: T.text3, margin: 0 });
    txt(s, "Prototype shows design direction and UX — final build may include minor enhancements.", {
      x: 0.5, y: 4.7, w: 9, h: 0.4, fontSize: 9, color: T.border, italic: true, align: "center", margin: 0,
    });
  }

  // ── SLIDE 9 — Notes ──────────────────────────────────────────────────────────
  if (notes && notes.trim()) {
    const s = pres.addSlide();
    s.background = { color: T.bg1 };

    txt(s, "Notes & Terms", { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 11, bold: true, color: T.accent, charSpacing: 2, margin: 0 });
    txt(s, "Additional Information", { x: 0.5, y: 0.7, w: 9, h: 0.65, fontSize: 32, bold: true, color: T.text1, charSpacing: -0.5, margin: 0 });

    card(s, pres, 0.5, 1.55, 9, 2.8, T);
    accentBar(s, pres, 0.5, 1.55, 2.8, T);
    txt(s, notes, { x: 0.72, y: 1.82, w: 8.5, h: 2.4, fontSize: 11, color: T.text1, margin: 0 });
  }

  // ── SLIDE — Closing ──────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: T.bg1 };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: T.accent }, line: { color: T.accent, width: 0 } });
    s.addText(builtItWordmark(28, T), { x: 3.5, y: 1.15, w: 3, h: 0.72, align: "center", margin: 0 });
    txt(s, "PAY ONCE · OWN FOREVER", { x: 2.5, y: 1.88, w: 5, h: 0.3, fontSize: 8, color: T.text3, charSpacing: 4, align: "center", margin: 0 });
    txt(s, `Ready to own your digital presence, ${clientName}?`, {
      x: 0.5, y: 2.52, w: 9, h: 0.65, fontSize: 24, bold: true, color: T.text1, align: "center", charSpacing: -0.3, margin: 0,
    });
    txt(s, "Reach out to get started — one invoice, one time, forever yours.", {
      x: 1.5, y: 3.22, w: 7, h: 0.4, fontSize: 12, color: T.text3, align: "center", italic: true, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 3.0, y: 3.88, w: 4.0, h: 0.55, fill: { color: T.accent }, line: { color: T.accent, width: 0 } });
    txt(s, preparedBy, { x: 3.0, y: 3.88, w: 4.0, h: 0.55, fontSize: 13, bold: true, color: T.bg1, align: "center", valign: "middle", margin: 0 });
    txt(s, "www.builtit.net", {
      x: 1, y: 4.58, w: 8, h: 0.3, fontSize: 11, bold: true, color: T.accent, align: "center", margin: 0,
      hyperlink: { url: "https://www.builtit.net" },
    });
    txt(s, "BuiltIt.  ·  Alexandria, Egypt", { x: 1, y: 4.9, w: 8, h: 0.25, fontSize: 8, color: T.border, align: "center", margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.45, w: 10, h: 0.175, fill: { color: T.footerBg }, line: { color: T.footerBg, width: 0 } });
  }

  await pres.writeFile({ fileName: outPath });
}

module.exports = { generateProposal };

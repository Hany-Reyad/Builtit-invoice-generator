const express  = require("express");
const path     = require("path");
const fs       = require("fs");
const multer   = require("multer");
const { spawnSync } = require("child_process");
const { generateProposal } = require("./generator");

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// ── Multer — invoice PDF upload ───────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, "output");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "-");
      cb(null, `invoice-${Date.now()}-${safe}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are accepted."));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));

const rootDir = __dirname;
app.use(express.static(rootDir));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

// Invoice page — explicit routes so it's always reachable
app.get("/invoice", (req, res) => {
  res.sendFile(path.join(rootDir, "invoice.html"));
});
app.get("/invoice.html", (req, res) => {
  res.sendFile(path.join(rootDir, "invoice.html"));
});

// Generate proposal PPTX
app.post("/api/generate", async (req, res) => {
  try {
    const data = req.body;
    if (!data.clientName || !data.projectTitle || !data.priceEGP) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const outDir   = path.join(__dirname, "output");
    fs.mkdirSync(outDir, { recursive: true });
    const slug     = data.clientName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `BuiltIt-Proposal-${slug}-${Date.now()}.pptx`;
    const outPath  = path.join(outDir, filename);
    await generateProposal(data, outPath);
    res.download(outPath, filename, (err) => {
      if (err) console.error("Download error:", err);
      setTimeout(() => fs.unlink(outPath, () => {}), 60_000);
    });
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ error: err.message || "Failed to generate proposal." });
  }
});

// Generate invoice PDF (calls Python)
app.post("/api/generate-invoice", (req, res) => {
  try {
    const data = req.body;
    if (!data.clientName) {
      return res.status(400).json({ error: "clientName is required." });
    }

    const outDir   = path.join(__dirname, "output");
    fs.mkdirSync(outDir, { recursive: true });
    const slug     = data.clientName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `BuiltIt-Invoice-${slug}-${Date.now()}.pdf`;
    const outPath  = path.join(outDir, filename);
    const pyScript = path.join(__dirname, "invoice_generator.py");

    // Pass data as JSON via stdin — try python3 then python as fallback
    let result = spawnSync(
      "python3",
      [pyScript],
      {
        input:    JSON.stringify({ ...data, outPath }),
        encoding: "utf8",
        timeout:  30_000,
      }
    );

    // Fallback to 'python' if python3 not found
    if (result.error && result.error.code === "ENOENT") {
      result = spawnSync(
        "python",
        [pyScript],
        {
          input:    JSON.stringify({ ...data, outPath }),
          encoding: "utf8",
          timeout:  30_000,
        }
      );
    }

    console.log("Python stdout:", result.stdout);
    console.log("Python stderr:", result.stderr);
    console.log("Python exit code:", result.status);

    if (result.error) {
      throw new Error(`Python not found: ${result.error.message}. Install python3 and reportlab.`);
    }
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "PDF generation failed.");
    }

    res.download(outPath, filename, (err) => {
      if (err) console.error("Invoice download error:", err);
      setTimeout(() => fs.unlink(outPath, () => {}), 60_000);
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Upload existing invoice PDF
app.post("/api/upload-invoice", upload.single("invoice"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received." });
  const filePath = req.file.path;
  const fileName = req.file.originalname;
  res.download(filePath, fileName, (err) => {
    if (err) console.error("Invoice download error:", err);
    setTimeout(() => fs.unlink(filePath, () => {}), 60_000);
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`\n  BuiltIt. Proposal Generator`);
  console.log(`  Running at http://${HOST}:${PORT}`);
  console.log(`  index.html: ${fs.existsSync(path.join(rootDir, "index.html"))}`);
  console.log(`  invoice_generator.py: ${fs.existsSync(path.join(rootDir, "invoice_generator.py"))}\n`);
});

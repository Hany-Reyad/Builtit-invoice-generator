const express = require("express");
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const { spawnSync } = require("child_process");
const { generateProposal } = require("./generator");

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Ensure the absolute root directory is captured correctly
const rootDir = path.resolve(__dirname);

// ── Multer Configuration ─────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(rootDir, "output");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
app.use(express.static(rootDir));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

// Refined Invoice route with existence check
app.get("/invoice", (req, res) => {
  const targetPath = path.join(rootDir, "invoice.html");
  if (fs.existsSync(targetPath)) {
    res.sendFile(targetPath);
  } else {
    // This will help you debug in the browser if the file is missing
    res.status(404).json({
      error: "ENOENT",
      message: "invoice.html not found in root",
      searchedPath: targetPath,
      currentDirectory: __dirname,
      filesInDir: fs.readdirSync(rootDir)
    });
  }
});

// Alias for direct .html access
app.get("/invoice.html", (req, res) => {
  res.redirect("/invoice");
});

// Generate proposal PPTX
app.post("/api/generate", async (req, res) => {
  try {
    const data = req.body;
    if (!data.clientName || !data.projectTitle || !data.priceEGP) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const outDir = path.join(rootDir, "output");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const slug = data.clientName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `BuiltIt-Proposal-${slug}-${Date.now()}.pptx`;
    const outPath = path.join(outDir, filename);

    await generateProposal(data, outPath);

    res.download(outPath, filename, (err) => {
      if (err) console.error("Download error:", err);
      setTimeout(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); }, 60000);
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

    const outDir = path.join(rootDir, "output");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const slug = data.clientName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `BuiltIt-Invoice-${slug}-${Date.now()}.pdf`;
    const outPath = path.join(outDir, filename);
    const pyScript = path.join(rootDir, "invoice_generator.py");

    const result = spawnSync(
      "python3",
      [pyScript],
      {
        input: JSON.stringify({ ...data, outPath }),
        encoding: "utf8",
        timeout: 30000,
      }
    );

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "PDF generation failed.");
    }

    res.download(outPath, filename, (err) => {
      if (err) console.error("Invoice download error:", err);
      setTimeout(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); }, 60000);
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Global error:", err.message);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`\n  BuiltIt. Proposal Generator`);
  console.log(`  Working Dir: ${rootDir}`);
  console.log(`  index.html exists: ${fs.existsSync(path.join(rootDir, "index.html"))}`);
  console.log(`  invoice.html exists: ${fs.existsSync(path.join(rootDir, "invoice.html"))}`);
});

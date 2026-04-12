/**
 * Downloads Poppins font files from Google Fonts GitHub repository
 * into the fonts/ directory. Runs automatically via the postinstall hook.
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");

const FONTS_DIR = path.join(__dirname, "fonts");

const FONTS = [
  {
    name: "Poppins-Regular.ttf",
    url:  "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf",
  },
  {
    name: "Poppins-Bold.ttf",
    url:  "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf",
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    function get(url) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirects
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      }).on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    console.log("Created fonts/ directory");
  }

  for (const font of FONTS) {
    const dest = path.join(FONTS_DIR, font.name);
    if (fs.existsSync(dest)) {
      console.log(`${font.name} already exists, skipping`);
      continue;
    }
    process.stdout.write(`Downloading ${font.name}...`);
    await download(font.url, dest);
    console.log(" done");
  }
}

main().catch((err) => {
  console.error("Font download failed:", err.message);
  process.exit(1);
});

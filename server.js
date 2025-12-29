import express from "express";
import cors from "cors";
import Dramabox from "./src/services/Dramabox.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "public")));

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.locals.request = req;
  next();
});

// --- HALAMAN UTAMA (DOKUMENTASI) ---
app.get("/", (req, res) => {
  // Logika protokol/baseUrl telah dihapus
  res.render("docs", {
    PORT: PORT,
  });
});

// --- API ROUTES ---

// 1. Search Drama
app.get("/api/search", async (req, res) => {
  try {
    const { keyword, page, lang } = req.query;
    if (!keyword)
      return res.status(400).json({ error: "Parameter keyword wajib diisi" });

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.searchDrama(keyword, page || 1);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Home List
app.get("/api/home", async (req, res) => {
  try {
    const { page, size, lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getDramaList(page || 1, size || 10);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get VIP / Theater List (BARU)
app.get("/api/vip", async (req, res) => {
  try {
    const { lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getVip();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Detail Drama V2
app.get("/api/detail/:bookId/v2", async (req, res) => {
  try {
    const { bookId } = req.params;
    const { lang } = req.query;
    if (!bookId) return res.status(400).json({ error: "Book ID required" });

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getDramaDetailV2(bookId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Get Chapters List
app.get("/api/chapters/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const { lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getChapters(bookId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Get Stream URL (BARU)
app.get("/api/stream", async (req, res) => {
  try {
    const { bookId, episode, lang } = req.query;

    if (!bookId || !episode) {
      return res
        .status(400)
        .json({ error: "Parameter bookId dan episode wajib diisi." });
    }

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getStreamUrl(bookId, episode);

    // Method getStreamUrl sudah mengembalikan format JSON lengkap { status: "success", ... }
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 7. Batch Download (Scraping)
app.get("/download/:bookId", async (req, res) => {
  const { bookId } = req.params;
  const { lang } = req.query;

  if (!bookId) {
    return res.status(400).json({ error: "Missing bookId" });
  }

  try {
    const dramabox = new Dramabox(lang || "in");

    const rawData = await dramabox.batchDownload(bookId);

    if (!rawData || rawData.length === 0) {
      return res.status(404).json({
        status: "failed",
        message: "Tidak ada data yang ditemukan atau terjadi error.",
      });
    }

    res.json({
      status: "success",
      total: rawData.length,
      data: rawData,
    });
  } catch (error) {
    console.error("Download Error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 8. Categories List
app.get("/api/categories", async (req, res) => {
  try {
    const { lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getCategories();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Get Book By Category
app.get("/api/category/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { page, size, lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getBookFromCategories(
      id,
      page || 1,
      size || 10
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Recommend
app.get("/api/recommend", async (req, res) => {
  try {
    const { lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const result = await dramabox.getRecommendedBooks();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Generate Header (Utility)
app.get("/api/generate-header", async (req, res) => {
  try {
    const { lang } = req.query;

    const dramabox = new Dramabox(lang || "in");

    const tokenData = await dramabox.getToken();
    const timestamp = Date.now();
    const baseHeaders = dramabox.buildHeaders(tokenData, timestamp);
    const body = JSON.stringify({});
    const sn = dramabox.util.sign(
      `timestamp=${timestamp}${body}${tokenData.deviceId}${tokenData.androidId}${baseHeaders["tn"]}`
    );

    const finalHeaders = {
      ...baseHeaders,
      sn: sn,
      "request-timestamp": timestamp,
    };

    res.json({
      message: "Header lengkap dengan SN dan Timestamp berhasil dibuat.",
      language_used: dramabox.lang,
      timestamp_ms: timestamp,
      target_url_ref: `${dramabox.baseUrl_Dramabox}/ENDPOINT_EXAMPLE?timestamp=${timestamp}`,
      generated_headers: finalHeaders,
      token_cache_info: {
        deviceId: tokenData.deviceId,
        androidId: tokenData.androidId,
        spoffer: tokenData.spoffer,
        token_valid_until: new Date(tokenData.expiry).toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal memproses permintaan header.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                                                          ║");
  console.log("║   🎬  DRAMABOX API SERVER                                ║");
  console.log("║                                                          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║                                                          ║");
  console.log(`║   🚀  Status  : Running                                  ║`);
  console.log(
    `║   🌐  Local   : http://localhost:${PORT}                      ║`
  );
  console.log(
    "║   📖  Docs    : http://localhost:" + PORT + "/                      ║"
  );
  console.log("║                                                          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║   Available Endpoints:                                   ║");
  console.log("║   • GET  /api/search?keyword=...    Search drama         ║");
  console.log("║   • GET  /api/home                  Home list            ║");
  console.log("║   • GET  /api/detail/:id/v2         Drama detail         ║");
  console.log("║   • GET  /api/chapters/:id          Episode list         ║");
  console.log("║   • GET  /api/stream?bookId&episode Stream URL           ║");
  console.log("║   • GET  /api/categories            Categories           ║");
  console.log("║   • GET  /api/recommend             Recommendations      ║");
  console.log("║                                                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");
});

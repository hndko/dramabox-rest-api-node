import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import Dramabox from "./src/services/Dramabox.js";
import path from "path";
import { fileURLToPath } from "url";

// ============================================
// CONFIGURATION
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================
// DRAMABOX INSTANCE POOL (Singleton per Language)
// ============================================
const dramaboxInstances = new Map();

function getDramaboxInstance(lang = "in") {
  if (!dramaboxInstances.has(lang)) {
    dramaboxInstances.set(lang, new Dramabox(lang));
  }
  return dramaboxInstances.get(lang);
}

// ============================================
// MIDDLEWARE
// ============================================

// Trust proxy (for Vercel, Heroku, etc.)
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for EJS templates
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Compression (gzip)
app.use(compression());

// JSON parser with size limit
app.use(express.json({ limit: "1mb" }));

// URL encoded parser
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiting - 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Terlalu banyak request. Coba lagi dalam 1 menit.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers["x-forwarded-for"] || "unknown",
});
app.use("/api/", limiter);

// Request timeout middleware (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({
      success: false,
      error: {
        code: "REQUEST_TIMEOUT",
        message: "Request timeout. Silakan coba lagi.",
      },
    });
  });
  next();
});

// Request logging (development only)
if (NODE_ENV === "development") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(
        `[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });
    next();
  });
}

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files with caching
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: NODE_ENV === "production" ? "1d" : 0,
    etag: true,
  })
);

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Standard API response builder
const apiResponse = {
  success: (data, meta = {}) => ({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }),
  error: (code, message, details = null) => ({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }),
  paginated: (data, page, size, hasMore) => ({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        page: parseInt(page),
        size: parseInt(size),
        hasMore,
      },
    },
  }),
};

// Input validation helper
const validateRequired = (params, required) => {
  const missing = required.filter((key) => !params[key]);
  if (missing.length > 0) {
    return `Parameter wajib: ${missing.join(", ")}`;
  }
  return null;
};

// Sanitize string input
const sanitizeInput = (str) => {
  if (typeof str !== "string") return str;
  return str.trim().slice(0, 200); // Limit to 200 chars
};

// Async handler wrapper (prevents unhandled promise rejections)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: "1.2.0",
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
    },
  });
});

// Documentation page
app.get("/", (req, res) => {
  res.render("docs", { PORT });
});

// ============================================
// API ROUTES
// ============================================

// 1. Search Drama
app.get(
  "/api/search",
  asyncHandler(async (req, res) => {
    const { keyword, page = 1, size = 20, lang = "in" } = req.query;

    const validationError = validateRequired({ keyword }, ["keyword"]);
    if (validationError) {
      return res
        .status(400)
        .json(apiResponse.error("VALIDATION_ERROR", validationError));
    }

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.searchDrama(
      sanitizeInput(keyword),
      parseInt(page),
      parseInt(size)
    );

    res.json(apiResponse.paginated(result.book, page, size, result.isMore));
  })
);

// 2. Home / Drama List
app.get(
  "/api/home",
  asyncHandler(async (req, res) => {
    const { page = 1, size = 10, lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getDramaList(parseInt(page), parseInt(size));

    res.json(apiResponse.paginated(result.book, page, size, result.isMore));
  })
);

// 3. VIP / Theater List
app.get(
  "/api/vip",
  asyncHandler(async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getVip();

    res.json(apiResponse.success(result));
  })
);

// 4. Drama Detail V2
app.get(
  "/api/detail/:bookId/v2",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const { lang = "in" } = req.query;

    if (!bookId || isNaN(bookId)) {
      return res
        .status(400)
        .json(
          apiResponse.error("VALIDATION_ERROR", "bookId harus berupa angka")
        );
    }

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getDramaDetailV2(bookId);

    res.json(apiResponse.success(result));
  })
);

// 5. Chapters List
app.get(
  "/api/chapters/:bookId",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const { lang = "in" } = req.query;

    if (!bookId || isNaN(bookId)) {
      return res
        .status(400)
        .json(
          apiResponse.error("VALIDATION_ERROR", "bookId harus berupa angka")
        );
    }

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getChapters(bookId);

    res.json(
      apiResponse.success(result, {
        total: result.length,
      })
    );
  })
);

// 6. Stream URL
app.get(
  "/api/stream",
  asyncHandler(async (req, res) => {
    const { bookId, episode, lang = "in" } = req.query;

    const validationError = validateRequired({ bookId, episode }, [
      "bookId",
      "episode",
    ]);
    if (validationError) {
      return res
        .status(400)
        .json(apiResponse.error("VALIDATION_ERROR", validationError));
    }

    if (isNaN(bookId) || isNaN(episode)) {
      return res
        .status(400)
        .json(
          apiResponse.error(
            "VALIDATION_ERROR",
            "bookId dan episode harus berupa angka"
          )
        );
    }

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getStreamUrl(bookId, parseInt(episode));

    res.json(apiResponse.success(result.data));
  })
);

// 7. Batch Download (Heavy operation - stricter rate limit)
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // Only 5 requests per minute for download
  message: apiResponse.error(
    "RATE_LIMIT_EXCEEDED",
    "Download dibatasi 5 request per menit"
  ),
});

app.get(
  "/download/:bookId",
  downloadLimiter,
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const { lang = "in" } = req.query;

    if (!bookId || isNaN(bookId)) {
      return res
        .status(400)
        .json(
          apiResponse.error("VALIDATION_ERROR", "bookId harus berupa angka")
        );
    }

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.batchDownload(bookId);

    if (!result || result.length === 0) {
      return res
        .status(404)
        .json(
          apiResponse.error(
            "NOT_FOUND",
            "Data tidak ditemukan atau terjadi error"
          )
        );
    }

    res.json(
      apiResponse.success(result, {
        total: result.length,
        bookId,
      })
    );
  })
);

// 8. Categories List
app.get(
  "/api/categories",
  asyncHandler(async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getCategories();

    res.json(
      apiResponse.success(result, {
        total: result.length,
      })
    );
  })
);

// 9. Drama by Category
app.get(
  "/api/category/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, size = 10, lang = "in" } = req.query;

    if (!id || isNaN(id)) {
      return res
        .status(400)
        .json(
          apiResponse.error(
            "VALIDATION_ERROR",
            "id kategori harus berupa angka"
          )
        );
    }

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getBookFromCategories(
      parseInt(id),
      parseInt(page),
      parseInt(size)
    );

    res.json(apiResponse.success(result));
  })
);

// 10. Recommendations
app.get(
  "/api/recommend",
  asyncHandler(async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getRecommendedBooks();

    res.json(
      apiResponse.success(result, {
        total: result.length,
      })
    );
  })
);

// 11. Generate Headers (Utility/Debug)
app.get(
  "/api/generate-header",
  asyncHandler(async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const tokenData = await dramabox.getToken();
    const timestamp = Date.now();
    const headers = dramabox.buildHeaders(tokenData, timestamp);

    res.json(
      apiResponse.success({
        language: dramabox.lang,
        timestamp,
        headers,
        tokenInfo: {
          deviceId: tokenData.deviceId,
          validUntil: new Date(tokenData.expiry).toISOString(),
        },
      })
    );
  })
);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json(
      apiResponse.error(
        "NOT_FOUND",
        `Endpoint ${req.method} ${req.path} tidak ditemukan`
      )
    );
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res
      .status(400)
      .json(apiResponse.error("VALIDATION_ERROR", err.message));
  }

  if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
    return res
      .status(408)
      .json(apiResponse.error("REQUEST_TIMEOUT", "Permintaan timeout"));
  }

  if (err.response?.status === 429) {
    return res
      .status(429)
      .json(
        apiResponse.error(
          "UPSTREAM_RATE_LIMIT",
          "Server sumber sedang sibuk, coba lagi nanti"
        )
      );
  }

  // Default server error
  res
    .status(500)
    .json(
      apiResponse.error(
        "INTERNAL_ERROR",
        NODE_ENV === "production" ? "Terjadi kesalahan server" : err.message
      )
    );
});

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(PORT, () => {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                                                          ║");
  console.log("║   🎬  DRAMABOX API SERVER v1.2.0                         ║");
  console.log("║                                                          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║                                                          ║");
  console.log(`║   🚀  Status  : Running (${NODE_ENV})                     `);
  console.log(
    `║   🌐  Local   : http://localhost:${PORT}                      ║`
  );
  console.log(
    `║   📖  Docs    : http://localhost:${PORT}/                      ║`
  );
  console.log(
    `║   💚  Health  : http://localhost:${PORT}/health                ║`
  );
  console.log("║                                                          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║   Features:                                              ║");
  console.log("║   ✓ Rate Limiting (100 req/min)                          ║");
  console.log("║   ✓ Gzip Compression                                     ║");
  console.log("║   ✓ Security Headers (Helmet)                            ║");
  console.log("║   ✓ Request Caching                                      ║");
  console.log("║   ✓ Auto Retry with Backoff                              ║");
  console.log("║                                                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  server.close(() => {
    console.log("[Server] HTTP server closed");

    // Clear Dramabox instances
    dramaboxInstances.clear();
    console.log("[Cache] Instances cleared");

    console.log("[Shutdown] Complete");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("[Shutdown] Force exit after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});

export default app;

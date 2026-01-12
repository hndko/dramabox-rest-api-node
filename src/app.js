import express from "express";
import { config } from "./config/config.js";
import { configureSecurity } from "./middlewares/security.js";
import { defaultLimiter } from "./middlewares/rateLimiter.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/errorHandler.js";
import apiRoutes from "./routes/api.js";
import { clearInstances } from "./controllers/dramaboxController.js";
import compression from "compression";

const app = express();

// Security Middleware (Helmet, CORS, Trust Proxy)
configureSecurity(app);

// Compression
app.use(compression());

// Body Parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate Limiting
app.use("/api/", defaultLimiter);

// Request Logging (Development)
if (config.nodeEnv === "development") {
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

// Request Timeout
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

// View Engine
app.set("view engine", "ejs");
app.set("views", config.viewsPath);

// Static Files
app.use(
  express.static(config.publicPath, {
    maxAge: config.nodeEnv === "production" ? "1d" : 0,
    etag: true,
  })
);

// Health Check
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

// Documentation
app.get("/", (req, res) => {
  res.render("docs", { PORT: config.port });
});

// API Routes
app.use(apiRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Graceful Shutdown Logic
export const shutdown = (server) => {
  server.close(() => {
    console.log("[Server] HTTP server closed");
    clearInstances();
    console.log("[Cache] Instances cleared");
    console.log("[Shutdown] Complete");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[Shutdown] Force exit after timeout");
    process.exit(1);
  }, 10000);
};

export default app;

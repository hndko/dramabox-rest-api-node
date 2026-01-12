import app, { shutdown } from "./src/app.js";
import { config } from "./src/config/config.js";

const server = app.listen(config.port, () => {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                                                          ║");
  console.log("║   🎬  DRAMABOX API SERVER v1.2.0                         ║");
  console.log("║                                                          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║                                                          ║");
  console.log(`║   🚀  Status  : Running (${config.nodeEnv})                     `);
  console.log(
    `║   🌐  Local   : http://localhost:${config.port}                      ║`
  );
  console.log(
    `║   📖  Docs    : http://localhost:${config.port}/                      ║`
  );
  console.log(
    `║   💚  Health  : http://localhost:${config.port}/health                ║`
  );
  console.log("║                                                          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║   Features:                                              ║");
  console.log("║   ✓ Rate Limiting (100 req/min)                          ║");
  console.log("║   ✓ Gzip Compression                                     ║");
  console.log("║   ✓ Security Headers (Helmet)                            ║");
  console.log("║   ✓ Request Caching                                      ║");
  console.log("║   ✓ Auto Retry with Backoff                              ║");
  console.log("║   ✓ Modular Architecture                                 ║");
  console.log("║                                                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");
});

// Graceful Shutdown
const handleShutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  shutdown(server);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  handleShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});

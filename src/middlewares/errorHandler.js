import { apiResponse } from "../utils/response.js";
import { config } from "../config/config.js";

// 404 handler
export const notFoundHandler = (req, res) => {
  res
    .status(404)
    .json(
      apiResponse.error(
        "NOT_FOUND",
        `Endpoint ${req.method} ${req.path} tidak ditemukan`
      )
    );
};

// Global error handler
export const globalErrorHandler = (err, req, res, next) => {
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
        config.nodeEnv === "production" ? "Terjadi kesalahan server" : err.message
      )
    );
};

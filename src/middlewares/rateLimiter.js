import rateLimit from "express-rate-limit";
import { apiResponse } from "../utils/response.js";

// Rate limiting - 100 requests per minute per IP
export const defaultLimiter = rateLimit({
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

// Batch Download (Heavy operation - stricter rate limit)
export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // Only 5 requests per minute for download
  message: apiResponse.error(
    "RATE_LIMIT_EXCEEDED",
    "Download dibatasi 5 request per menit"
  ),
});

import express from "express";
import { dramaboxController } from "../controllers/dramaboxController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { downloadLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// 1. Search Drama
router.get("/api/search", asyncHandler(dramaboxController.search));

// 2. Home / Drama List
router.get("/api/home", asyncHandler(dramaboxController.getHome));

// 3. VIP / Theater List
router.get("/api/vip", asyncHandler(dramaboxController.getVip));

// 4. Drama Detail V2
router.get("/api/detail/:bookId/v2", asyncHandler(dramaboxController.getDetailV2));

// 5. Chapters List
router.get("/api/chapters/:bookId", asyncHandler(dramaboxController.getChapters));

// 6. Stream URL
router.get("/api/stream", asyncHandler(dramaboxController.getStreamUrl));

// 7. Batch Download (Heavy operation - stricter rate limit)
router.get("/download/:bookId", downloadLimiter, asyncHandler(dramaboxController.batchDownload));

// 8. Categories List
router.get("/api/categories", asyncHandler(dramaboxController.getCategories));

// 9. Drama by Category
router.get("/api/category/:id", asyncHandler(dramaboxController.getBookByCategory));

// 10. Recommendations
router.get("/api/recommend", asyncHandler(dramaboxController.getRecommendations));

// 11. Generate Headers (Utility/Debug)
router.get("/api/generate-header", asyncHandler(dramaboxController.generateHeader));

export default router;

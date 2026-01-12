import Dramabox from "../services/Dramabox.js";
import { apiResponse } from "../utils/response.js";
import { validateRequired, sanitizeInput } from "../utils/validation.js";

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

export const clearInstances = () => {
  dramaboxInstances.clear();
};

export const dramaboxController = {
  search: async (req, res) => {
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
  },

  getHome: async (req, res) => {
    const { page = 1, size = 10, lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getDramaList(parseInt(page), parseInt(size));

    res.json(apiResponse.paginated(result.book, page, size, result.isMore));
  },

  getVip: async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getVip();

    res.json(apiResponse.success(result));
  },

  getDetailV2: async (req, res) => {
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
  },

  getChapters: async (req, res) => {
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
  },

  getStreamUrl: async (req, res) => {
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
  },

  batchDownload: async (req, res) => {
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
  },

  getCategories: async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getCategories();

    res.json(
      apiResponse.success(result, {
        total: result.length,
      })
    );
  },

  getBookByCategory: async (req, res) => {
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
  },

  getRecommendations: async (req, res) => {
    const { lang = "in" } = req.query;

    const dramabox = getDramaboxInstance(lang);
    const result = await dramabox.getRecommendedBooks();

    res.json(
      apiResponse.success(result, {
        total: result.length,
      })
    );
  },

  generateHeader: async (req, res) => {
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
  },
};

import axios from "axios";
import NodeCache from "node-cache";
import DramaboxUtil from "../utils/DramaboxUtil.js";

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Retry settings
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 10000, // 10 seconds
  RETRY_BACKOFF_MULTIPLIER: 2,

  // Cache settings (TTL in seconds)
  CACHE_TTL: {
    TOKEN: 3600, // 1 hour
    DRAMA_LIST: 300, // 5 minutes
    DRAMA_DETAIL: 600, // 10 minutes
    CHAPTERS: 600, // 10 minutes
    CATEGORIES: 1800, // 30 minutes
    SEARCH: 180, // 3 minutes
  },

  // Request settings
  REQUEST_TIMEOUT: 30000, // 30 seconds
  TOKEN_TIMEOUT: 15000, // 15 seconds

  // Error codes to retry
  RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504],
};

// ============================================
// GLOBAL CACHE INSTANCE
// ============================================
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

// ============================================
// HELPER FUNCTIONS
// ============================================
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt) => {
  const delay =
    CONFIG.INITIAL_RETRY_DELAY *
    Math.pow(CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, CONFIG.MAX_RETRY_DELAY);
};

const isRetryableError = (error) => {
  if (!error.response) return true; // Network errors
  return CONFIG.RETRYABLE_STATUS_CODES.includes(error.response.status);
};

const formatError = (error, context = "") => {
  const prefix = context ? `[${context}] ` : "";

  if (error.response) {
    const status = error.response.status;
    const statusText = error.response.statusText || "";

    switch (status) {
      case 400:
        return `${prefix}Bad Request - Parameter tidak valid`;
      case 401:
        return `${prefix}Unauthorized - Token tidak valid atau expired`;
      case 403:
        return `${prefix}Forbidden - Akses ditolak oleh server`;
      case 404:
        return `${prefix}Not Found - Data tidak ditemukan`;
      case 408:
        return `${prefix}Request Timeout - Server tidak merespons`;
      case 429:
        return `${prefix}Too Many Requests - Rate limit tercapai, coba lagi nanti`;
      case 500:
        return `${prefix}Internal Server Error - Server sedang bermasalah`;
      case 502:
        return `${prefix}Bad Gateway - Server upstream tidak merespons (coba lagi)`;
      case 503:
        return `${prefix}Service Unavailable - Server sedang maintenance`;
      case 504:
        return `${prefix}Gateway Timeout - Koneksi ke server timeout`;
      default:
        return `${prefix}HTTP ${status} ${statusText}`;
    }
  }

  if (error.code === "ECONNABORTED") {
    return `${prefix}Request timeout - Koneksi terlalu lama`;
  }
  if (error.code === "ENOTFOUND") {
    return `${prefix}DNS Error - Server tidak ditemukan`;
  }
  if (error.code === "ECONNREFUSED") {
    return `${prefix}Connection Refused - Server menolak koneksi`;
  }
  if (error.code === "ECONNRESET") {
    return `${prefix}Connection Reset - Koneksi terputus`;
  }

  return `${prefix}${error.message}`;
};

// ============================================
// DRAMABOX CLASS
// ============================================
export default class Dramabox {
  util;
  baseUrl_Dramabox = "https://sapi.dramaboxdb.com";
  webficUrl = "https://www.webfic.com";
  tokenCache = null;
  http;
  lang;
  instanceId;

  constructor(lang = "in") {
    this.util = new DramaboxUtil();
    this.lang = lang;
    this.instanceId = Math.random().toString(36).substring(7);

    // Create axios instance with defaults
    this.http = axios.create({
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: {
        "Accept-Encoding": "gzip, deflate",
      },
    });

    // Add response interceptor for logging
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(
          `[Dramabox:${this.instanceId}] Request failed:`,
          error.message
        );
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================
  isTokenValid() {
    if (!this.tokenCache) return false;
    // Check if token is expired (with 5 minute buffer)
    return this.tokenCache.expiry > Date.now() + 5 * 60 * 1000;
  }

  async generateNewToken(timestamp = Date.now(), attempt = 0) {
    const cacheKey = `token_${this.lang}`;

    // Check cache first
    const cachedToken = cache.get(cacheKey);
    if (cachedToken && cachedToken.expiry > Date.now()) {
      this.tokenCache = cachedToken;
      return cachedToken;
    }

    try {
      console.log(
        `[Token] Generating new token (attempt ${attempt + 1}/${
          CONFIG.MAX_RETRIES + 1
        })...`
      );

      const spoffer = this.util.generateRandomIP();
      const deviceId = this.util.generateUUID();
      const androidId = this.util.randomAndroidId();

      const headers = {
        tn: ``,
        version: "470",
        vn: "4.7.0",
        cid: "DAUAF1064291",
        "package-Name": "com.storymatrix.drama",
        Apn: "1",
        "device-id": deviceId,
        language: this.lang,
        "current-Language": this.lang,
        p: "48",
        "Time-Zone": "+0700",
        md: "Redmi Note 8",
        ov: "9",
        "over-flow": "new-fly",
        "android-id": androidId,
        "X-Forwarded-For": spoffer,
        "X-Real-IP": spoffer,
        mf: "XIAOMI",
        brand: "Xiaomi",
        "Content-Type": "application/json; charset=UTF-8",
      };

      const body = JSON.stringify({ distinctId: null });
      headers["sn"] = this.util.sign(
        `timestamp=${timestamp}${body}${deviceId}${androidId}`
      );

      const url = `${this.baseUrl_Dramabox}/drama-box/ap001/bootstrap?timestamp=${timestamp}`;

      const res = await axios.post(
        url,
        { distinctId: null },
        {
          headers,
          timeout: CONFIG.TOKEN_TIMEOUT,
        }
      );

      if (!res.data?.data?.user) {
        throw new Error("Invalid token response - user data missing");
      }

      const creationTime = Date.now();
      const tokenData = {
        token: res.data.data.user.token,
        deviceId,
        androidId,
        spoffer,
        uuid: res.data.data.user.uid,
        attributionPubParam: res.data.data.attributionPubParam,
        timestamp: creationTime,
        expiry: creationTime + 24 * 60 * 60 * 1000,
      };

      // Save to both instance and global cache
      this.tokenCache = tokenData;
      cache.set(cacheKey, tokenData, CONFIG.CACHE_TTL.TOKEN);

      console.log(`[Token] ✅ Token generated successfully`);
      return tokenData;
    } catch (error) {
      // Retry if retryable and attempts remaining
      if (attempt < CONFIG.MAX_RETRIES && isRetryableError(error)) {
        const retryDelay = getRetryDelay(attempt);
        console.log(
          `[Token] ⚠️ ${formatError(
            error,
            "Token"
          )} - Retrying in ${retryDelay}ms...`
        );
        await delay(retryDelay);
        return this.generateNewToken(Date.now(), attempt + 1);
      }

      throw new Error(formatError(error, "Token generation"));
    }
  }

  async getToken() {
    if (this.isTokenValid()) {
      return this.tokenCache;
    }
    return this.generateNewToken();
  }

  // ============================================
  // REQUEST HANDLING
  // ============================================
  buildHeaders(tokenData, timestamp) {
    return {
      tn: `Bearer ${tokenData.token}`,
      version: "451",
      vn: "4.5.1",
      cid: "DAUAF1064291",
      "package-Name": "com.storymatrix.drama",
      Apn: "1",
      "device-id": tokenData.deviceId,
      language: this.lang,
      "current-Language": this.lang,
      p: "46",
      "Time-Zone": "+0700",
      md: "Redmi Note 8",
      ov: "14",
      "over-flow": "new-fly",
      "android-id": tokenData.androidId,
      mf: "XIAOMI",
      brand: "Xiaomi",
      "X-Forwarded-For": tokenData.spoffer,
      "X-Real-IP": tokenData.spoffer,
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "okhttp/4.10.0",
    };
  }

  async request(
    endpoint,
    payload = {},
    isWebfic = false,
    method = "POST",
    attempt = 0
  ) {
    try {
      const timestamp = Date.now();
      let url, headers, tokenData;

      if (isWebfic) {
        url = `${this.webficUrl}${endpoint}`;
        headers = {
          "Content-Type": "application/json",
          pline: "DRAMABOX",
          language: this.lang,
        };
      } else {
        tokenData = await this.getToken();
        url = `${this.baseUrl_Dramabox}${endpoint}?timestamp=${timestamp}`;
        headers = this.buildHeaders(tokenData, timestamp);

        const body = JSON.stringify(payload);
        headers["sn"] = this.util.sign(
          `timestamp=${timestamp}${body}${tokenData.deviceId}${tokenData.androidId}${headers["tn"]}`
        );
      }

      const config = {
        method: method.toUpperCase(),
        url,
        headers,
        timeout: CONFIG.REQUEST_TIMEOUT,
        data: method.toUpperCase() !== "GET" ? payload : undefined,
      };

      const response = await this.http.request(config);

      // Check for API-level failures
      if (!isWebfic && response.data && response.data.success === false) {
        // Token might be invalid, refresh and retry once
        if (attempt === 0) {
          console.log(`[Request] Token refresh needed, regenerating...`);
          this.tokenCache = null;
          cache.del(`token_${this.lang}`);
          await this.generateNewToken(Date.now());
          return await this.request(endpoint, payload, isWebfic, method, 1);
        }
        throw new Error(response.data.message || "API request failed");
      }

      return response.data;
    } catch (error) {
      // Retry logic for retryable errors
      if (attempt < CONFIG.MAX_RETRIES && isRetryableError(error)) {
        const retryDelay = getRetryDelay(attempt);
        console.log(
          `[Request] ⚠️ ${formatError(error)} - Retry ${attempt + 1}/${
            CONFIG.MAX_RETRIES
          } in ${retryDelay}ms...`
        );

        // If 502/503, also regenerate token
        if (error.response?.status === 502 || error.response?.status === 503) {
          this.tokenCache = null;
          cache.del(`token_${this.lang}`);
        }

        await delay(retryDelay);
        return this.request(endpoint, payload, isWebfic, method, attempt + 1);
      }

      throw new Error(formatError(error, endpoint));
    }
  }

  // ============================================
  // CACHED API METHODS
  // ============================================
  async getVip() {
    const cacheKey = `vip_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const payload = {
        homePageStyle: 0,
        isNeedRank: 1,
        index: 4,
        type: 0,
        channelId: 205,
      };

      const data = await this.request("/drama-box/he001/theater", payload);
      cache.set(cacheKey, data, CONFIG.CACHE_TTL.DRAMA_LIST);
      return data;
    } catch (error) {
      console.error("[VIP]", error.message);
      throw error;
    }
  }

  async getStreamUrl(bookId, episode) {
    if (!bookId || !episode) {
      throw new Error("Parameter bookId dan episode wajib diisi.");
    }

    const cacheKey = `stream_${bookId}_${episode}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const DETAIL_URL = "https://regexd.com/base.php";
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${DETAIL_URL}?bookId=${bookId}`,
    };

    for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(DETAIL_URL, {
          params: {
            ajax: 1,
            bookId: bookId,
            lang: this.lang,
            episode: episode,
          },
          headers: headers,
          timeout: CONFIG.REQUEST_TIMEOUT,
        });

        const rawData = response.data;

        if (!rawData || !rawData.chapter) {
          throw new Error("Episode tidak ditemukan atau terkunci.");
        }

        const result = {
          status: "success",
          apiBy: "regexd.com",
          data: {
            bookId: bookId.toString(),
            allEps: rawData.totalEpisodes,
            chapter: {
              id: rawData.chapter.id,
              index: rawData.chapter.index,
              indexCode: rawData.chapter.indexStr,
              duration: rawData.chapter.duration,
              cover: rawData.chapter.cover,
              video: {
                mp4: rawData.chapter.mp4,
                m3u8: rawData.chapter.m3u8Url,
              },
            },
          },
        };

        cache.set(cacheKey, result, CONFIG.CACHE_TTL.CHAPTERS);
        return result;
      } catch (error) {
        if (attempt < CONFIG.MAX_RETRIES && isRetryableError(error)) {
          const retryDelay = getRetryDelay(attempt);
          console.log(
            `[Stream] ⚠️ ${formatError(error)} - Retry ${attempt + 1}/${
              CONFIG.MAX_RETRIES
            }...`
          );
          await delay(retryDelay);
          continue;
        }
        throw new Error(formatError(error, "Stream URL"));
      }
    }
  }

  async getDramaDetail(bookId, needRecommend = false, from = "book_album") {
    if (!bookId) {
      throw new Error("bookId is required!");
    }

    const cacheKey = `detail_${bookId}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request("/drama-box/chapterv2/detail", {
      needRecommend,
      from,
      bookId,
    });

    cache.set(cacheKey, result, CONFIG.CACHE_TTL.DRAMA_DETAIL);
    return result;
  }

  async getDramaDetailV2(bookId) {
    const cacheKey = `detailv2_${bookId}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request(
      `/webfic/book/detail/v2?id=${bookId}&language=${this.lang}`,
      { id: bookId, language: this.lang },
      true,
      "GET"
    );

    const { chapterList, book } = data?.data || {};
    const chapters = [];
    chapterList?.forEach((ch) => {
      chapters.push({ index: ch.index, id: ch.id });
    });

    const result = { chapters, drama: book };
    cache.set(cacheKey, result, CONFIG.CACHE_TTL.DRAMA_DETAIL);
    return result;
  }

  async getChapters(bookId) {
    const cacheKey = `chapters_${bookId}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request("/drama-box/chapterv2/batch/load", {
      boundaryIndex: 0,
      comingPlaySectionId: -1,
      index: 1,
      currencyPlaySource: "discover_new_rec_new",
      needEndRecommend: 0,
      currencyPlaySourceName: "",
      preLoad: false,
      rid: "",
      pullCid: "",
      loadDirection: 0,
      bookId,
    });

    const chapters = data?.data?.chapterList || [];
    chapters.forEach((ch) => {
      const cdn = ch.cdnList?.find((c) => c.isDefault === 1);
      ch.videoPath =
        cdn?.videoPathList?.find((v) => v.isDefault === 1)?.videoPath || "N/A";
    });

    cache.set(cacheKey, chapters, CONFIG.CACHE_TTL.CHAPTERS);
    return chapters;
  }

  async batchDownload(bookId) {
    let savedPayChapterNum = 0;
    let result = [];
    let totalChapters = 0;

    console.log(`\n${"=".repeat(50)}`);
    console.log(`🚀 Memulai scraping untuk Book ID: ${bookId}`);
    console.log(`${"=".repeat(50)}`);

    const fetchBatch = async (index, bId, isRetry = false) => {
      try {
        process.stdout.write(`📥 Fetching Index: ${index}... `);
        const data = await this.request("/drama-box/chapterv2/batch/load", {
          boundaryIndex: 0,
          comingPlaySectionId: -1,
          index: index,
          currencyPlaySourceName: "首页发现_Untukmu_推荐列表",
          rid: "",
          enterReaderChapterIndex: 0,
          loadDirection: 1,
          startUpKey: "10942710-5e9e-48f2-8927-7c387e6f5fac",
          bookId: bId,
          currencyPlaySource: "discover_175_rec",
          needEndRecommend: 0,
          preLoad: false,
          pullCid: "",
        });

        const chapters = data?.data?.chapterList || [];
        const isEndOfBook = index + 5 >= totalChapters && totalChapters !== 0;

        if (
          chapters.length <= 2 &&
          index !== savedPayChapterNum &&
          !isRetry &&
          !isEndOfBook
        ) {
          console.log(
            `⚠️ Data terbatas (${chapters.length}). Memicu Refresh Token...`
          );
          throw new Error("TriggerRetry: Data suspected limited");
        }

        if (chapters.length === 0 && index !== savedPayChapterNum) {
          throw new Error("Soft Error: Data kosong");
        }

        console.log(`✅ Success (${chapters.length} items)`);
        return data;
      } catch (error) {
        if (!isRetry) {
          console.log(`\n🔄 [RETRY] Menyegarkan sesi untuk Index ${index}...`);
          this.tokenCache = null;
          cache.del(`token_${this.lang}`);
          await this.generateNewToken(Date.now());

          if (savedPayChapterNum > 0 && index !== savedPayChapterNum) {
            await fetchBatch(savedPayChapterNum, bId, true).catch(() => {});
            await delay(1500);
          }
          await delay(2000);
          return fetchBatch(index, bId, true);
        }
        return null;
      }
    };

    try {
      const firstBatchData = await fetchBatch(1, bookId);

      if (firstBatchData?.data) {
        totalChapters = firstBatchData.data.chapterCount || 0;
        const bookName = firstBatchData.data.bookName;
        savedPayChapterNum = firstBatchData.data.payChapterNum || 0;

        console.log(`📖 Judul: ${bookName} | Total Eps: ${totalChapters}`);
        if (firstBatchData.data.chapterList)
          result.push(...firstBatchData.data.chapterList);

        let currentIdx = 6;
        let retryLoopCount = 0;

        while (currentIdx <= totalChapters) {
          const batchData = await fetchBatch(currentIdx, bookId);
          const items = batchData?.data?.chapterList || [];

          if (items.length > 0) {
            result.push(...items);
            currentIdx += 5;
            retryLoopCount = 0;
          } else {
            retryLoopCount++;
            if (retryLoopCount >= 3) {
              currentIdx += 5;
              retryLoopCount = 0;
            } else {
              await delay(4000);
            }
          }
          await delay(800);
        }
      }

      // Clean and map results
      const uniqueMap = new Map();
      result.forEach((item) => uniqueMap.set(item.chapterId, item));

      const finalResult = Array.from(uniqueMap.values())
        .sort((a, b) => (a.chapterIndex || 0) - (b.chapterIndex || 0))
        .map((ch) => {
          let cdn =
            ch.cdnList?.find((c) => c.isDefault === 1) || ch.cdnList?.[0];
          let videoPath = "N/A";
          if (cdn?.videoPathList) {
            const preferred =
              cdn.videoPathList.find((v) => v.isDefault === 1) ||
              cdn.videoPathList.find((v) => v.quality === 1080) ||
              cdn.videoPathList.find((v) => v.quality === 720) ||
              cdn.videoPathList[0];
            videoPath = preferred?.videoPath || "N/A";
          }

          return {
            chapterId: ch.chapterId,
            chapterIndex: ch.chapterIndex,
            chapterName: ch.chapterName,
            videoPath: videoPath,
          };
        });

      console.log(`\n${"=".repeat(50)}`);
      console.log(`✅ SELESAI. Output Bersih: ${finalResult.length} Episode`);
      console.log(`${"=".repeat(50)}\n`);

      return finalResult;
    } catch (error) {
      console.error("Critical Error dalam batchDownload:", error);
      return [];
    }
  }

  async getDramaList(pageNo = 1, pageSize = 10) {
    const cacheKey = `list_${pageNo}_${pageSize}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request(
      "/drama-box/he001/classify",
      {
        typeList:
          pageNo == 1
            ? []
            : [
                { type: 1, value: "" },
                { type: 2, value: "" },
                { type: 3, value: "" },
                { type: 4, value: "" },
                { type: 4, value: "" },
                { type: 5, value: "1" },
              ],
        showLabels: false,
        pageNo: pageNo.toString(),
        pageSize: pageSize.toString(),
      },
      false,
      "POST"
    );

    const rawList = data?.data?.classifyBookList?.records || [];
    const isMore = data?.data?.classifyBookList?.isMore || 0;

    const list = rawList.flatMap((item) => {
      if (item.cardType === 3 && item.tagCardVo?.tagBooks) {
        return item.tagCardVo.tagBooks;
      }
      return [item];
    });

    const uniqueList = list.filter(
      (v, i, arr) => arr.findIndex((b) => b.bookId === v.bookId) === i
    );

    const result = {
      isMore: isMore == 1,
      book: uniqueList.map((book) => ({
        id: book.bookId,
        name: book.bookName,
        cover: book.coverWap,
        chapterCount: book.chapterCount,
        introduction: book.introduction,
        tags: book.tagV3s,
        playCount: book.playCount,
        cornerName: book.corner?.name || null,
        cornerColor: book.corner?.color || null,
      })),
    };

    cache.set(cacheKey, result, CONFIG.CACHE_TTL.DRAMA_LIST);
    return result;
  }

  async getCategories(pageNo = 1, pageSize = 30) {
    const cacheKey = `categories_${pageNo}_${pageSize}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request(
      "/webfic/home/browse",
      { typeTwoId: 0, pageNo, pageSize },
      true
    );

    const result = data?.data?.types || [];
    cache.set(cacheKey, result, CONFIG.CACHE_TTL.CATEGORIES);
    return result;
  }

  async getBookFromCategories(typeTwoId = 0, pageNo = 1, pageSize = 10) {
    const cacheKey = `category_${typeTwoId}_${pageNo}_${pageSize}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request(
      "/webfic/home/browse",
      { typeTwoId, pageNo, pageSize },
      true
    );

    const result = data?.data || [];
    cache.set(cacheKey, result, CONFIG.CACHE_TTL.DRAMA_LIST);
    return result;
  }

  async getRecommendedBooks() {
    const cacheKey = `recommend_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request("/drama-box/he001/recommendBook", {
      isNeedRank: 1,
      newChannelStyle: 1,
      specialColumnId: 0,
      pageNo: 1,
      channelId: 43,
    });

    const rawList = data?.data?.recommendList?.records || [];
    const list = rawList.flatMap((item) => {
      if (item.cardType === 3 && item.tagCardVo?.tagBooks) {
        return item.tagCardVo.tagBooks;
      }
      return [item];
    });

    const result = list.filter(
      (v, i, arr) => arr.findIndex((b) => b.bookId === v.bookId) === i
    );

    cache.set(cacheKey, result, CONFIG.CACHE_TTL.DRAMA_LIST);
    return result;
  }

  async rsearchDrama(keyword, pageNo = 3) {
    const data = await this.request("/drama-box/search/suggest", {
      keyword,
      pageNo,
    });
    return (data?.data?.suggestList || []).map((item) => ({
      bookId: item.bookId,
      bookName: item.bookName.replace(/\s+/g, "-"),
      cover: item.cover,
    }));
  }

  async searchDramaIndex() {
    const cacheKey = `searchIndex_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request("/drama-box/search/index");
    const result = data?.data?.hotVideoList || [];

    cache.set(cacheKey, result, CONFIG.CACHE_TTL.SEARCH);
    return result;
  }

  async searchDrama(keyword, pageNo = 1, pageSize = 20) {
    const cacheKey = `search_${keyword}_${pageNo}_${pageSize}_${this.lang}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.request("/drama-box/search/search", {
      searchSource: "搜索按钮",
      pageNo,
      pageSize,
      from: "search_sug",
      keyword,
    });

    const rawResult = data?.data?.searchList || [];
    const isMore = data?.data?.isMore;

    const result = {
      isMore: isMore == 1,
      book: rawResult.map((book) => ({
        id: book.bookId,
        name: book.bookName,
        cover: book.cover,
        introduction: book.introduction,
        tags: book.tagNames,
        playCount: book.playCount,
      })),
    };

    cache.set(cacheKey, result, CONFIG.CACHE_TTL.SEARCH);
    return result;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  clearCache() {
    cache.flushAll();
    this.tokenCache = null;
    console.log("[Cache] All cache cleared");
  }

  getCacheStats() {
    return cache.getStats();
  }
}

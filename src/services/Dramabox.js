import axios from "axios";
import DramaboxUtil from "../utils/DramaboxUtil.js";

export default class Dramabox {
  util;
  baseUrl_Dramabox = "https://sapi.dramaboxdb.com";
  webficUrl = "https://www.webfic.com";
  tokenCache = null;
  http;
  lang;

  constructor(lang = "in") {
    this.util = new DramaboxUtil();
    this.http = axios.create({
      timeout: 10000,
    });
    this.lang = lang;
  }

  isTokenValid() {
    return this.tokenCache !== null;
  }

  async generateNewToken(timestamp = Date.now()) {
    try {
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
      const res = await axios.post(url, { distinctId: null }, { headers });

      if (!res.data?.data?.user) {
        return await this.generateNewToken(Date.now());
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

      this.tokenCache = tokenData;
      return tokenData;
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  async getToken() {
    if (this.isTokenValid()) {
      return this.tokenCache;
    }

    return this.generateNewToken();
  }

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
    isRetry = false
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
        timeout: 60000,
        data: method.toUpperCase() !== "GET" ? payload : undefined,
      };

      const response = await this.http.request(config);

      if (!isWebfic && response.data && response.data.success === false) {
        if (!isRetry) {
          this.tokenCache = null;
          await this.generateNewToken(Date.now());
          return await this.request(endpoint, payload, isWebfic, method, true);
        } else {
          throw new Error(
            `API failed after token refresh: ${
              response.data.message || "Unknown error"
            }`
          );
        }
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(
          `HTTP ${error.response.status} Error: ${error.message}`
        );
      }
      throw error;
    }
  }

  async getVip() {
    try {
      const payload = {
        homePageStyle: 0,
        isNeedRank: 1,
        index: 4,
        type: 0,
        channelId: 205,
      };

      const data = await this.request("/drama-box/he001/theater", payload);
      return data;
    } catch (error) {
      console.error("Error fetching VIP (RAW):", error);
      return null;
    }
  }

  // --- NEW METHOD: Get Stream from Regexd ---
  async getStreamUrl(bookId, episode) {
    if (!bookId || !episode) {
      throw new Error("Parameter bookId dan episode wajib diisi.");
    }

    const DETAIL_URL = "https://regexd.com/base.php";
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${DETAIL_URL}?bookId=${bookId}`,
    };

    try {
      // Melakukan request langsung menggunakan axios (bypass this.request karena beda host/auth)
      const response = await axios.get(DETAIL_URL, {
        params: {
          ajax: 1,
          bookId: bookId,
          lang: this.lang,
          episode: episode,
        },
        headers: headers,
      });

      const rawData = response.data;

      if (!rawData || !rawData.chapter) {
        throw new Error("Episode tidak ditemukan atau terkunci.");
      }

      return {
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
    } catch (error) {
      console.error("Error getStreamUrl:", error.message);
      throw error;
    }
  }
  // ------------------------------------------

  async getDramaDetail(bookId, needRecommend = false, from = "book_album") {
    if (!bookId) {
      throw new Error("bookId is required!");
    }

    return await this.request("/drama-box/chapterv2/detail", {
      needRecommend,
      from,
      bookId,
    });
  }

  async getDramaDetailV2(bookId) {
    const data = await this.request(
      `/webfic/book/detail/v2?id=${bookId}&language=${this.lang}`,
      {
        id: bookId,
        language: this.lang,
      },
      true,
      "GET"
    );
    const { chapterList, book } = data?.data || {};
    const chapters = [];
    chapterList.forEach((ch) => {
      chapters.push({ index: ch.index, id: ch.id });
    });

    return { chapters, drama: book };
  }

  async getChapters(bookId) {
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

    return chapters;
  }

  async batchDownload(bookId) {
    let savedPayChapterNum = 0;
    let result = [];
    let totalChapters = 0;
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    console.log(`\n==================================================`);
    console.log(`🚀 Memulai scraping untuk Book ID: ${bookId}`);
    console.log(`==================================================`);

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
          if (this.generateNewToken) {
            this.tokenCache = null;
            await this.generateNewToken(Date.now());
          } else if (this.getToken) await this.getToken();

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

      // --- PROSES CLEANING & MAPPING ---
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

      console.log(`\n==================================================`);
      console.log(`✅ SELESAI. Output Bersih: ${finalResult.length} Episode`);
      console.log(`==================================================\n`);

      return finalResult;
    } catch (error) {
      console.error("Critical Error dalam batchDownload:", error);
      return [];
    }
  }

  async getDramaList(pageNo = 1, pageSize = 10) {
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

    const result = uniqueList.map((book) => ({
      id: book.bookId,
      name: book.bookName,
      cover: book.coverWap,
      chapterCount: book.chapterCount,
      introduction: book.introduction,
      tags: book.tagV3s,
      playCount: book.playCount,
      cornerName: book.corner?.name || null,
      cornerColor: book.corner?.color || null,
    }));

    return { isMore: isMore == 1, book: result };
  }

  async getCategories(pageNo = 1, pageSize = 30) {
    const data = await this.request(
      "/webfic/home/browse",
      {
        typeTwoId: 0,
        pageNo,
        pageSize,
      },
      true
    );
    return data?.data?.types || [];
  }

  async getBookFromCategories(typeTwoId = 0, pageNo = 1, pageSize = 10) {
    const data = await this.request(
      "/webfic/home/browse",
      {
        typeTwoId,
        pageNo,
        pageSize,
      },
      true
    );
    return data?.data || [];
  }

  async getRecommendedBooks() {
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

    const uniqueList = list.filter(
      (v, i, arr) => arr.findIndex((b) => b.bookId === v.bookId) === i
    );

    return uniqueList;
  }

  async rsearchDrama(keyword, pageNo = 3) {
    const data = await this.request("/drama-box/search/suggest", {
      keyword,
      pageNo,
    });
    let result = data?.data?.suggestList || [];
    result = result.map((item) => {
      return {
        bookId: item.bookId,
        bookName: item.bookName.replace(/\s+/g, "-"),
        cover: item.cover,
      };
    });
    return result;
  }

  async searchDramaIndex() {
    const data = await this.request("/drama-box/search/index");
    return data?.data?.hotVideoList || [];
  }

  async searchDrama(keyword, pageNo = 1, pageSize = 20) {
    const data = await this.request("/drama-box/search/search", {
      searchSource: "搜索按钮",
      pageNo,
      pageSize,
      from: "search_sug",
      keyword,
    });
    let result = data?.data?.searchList || [];
    const isMore = data?.data?.isMore;
    result = result.map((book) => {
      return {
        id: book.bookId,
        name: book.bookName,
        cover: book.cover,
        introduction: book.introduction,
        tags: book.tagNames,
        playCount: book.playCount,
      };
    });
    return { isMore: isMore == 1, book: result };
  }
}

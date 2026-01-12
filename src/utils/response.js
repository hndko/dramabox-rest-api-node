export const apiResponse = {
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

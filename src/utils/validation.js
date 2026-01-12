export const validateRequired = (params, required) => {
  const missing = required.filter((key) => !params[key]);
  if (missing.length > 0) {
    return `Parameter wajib: ${missing.join(", ")}`;
  }
  return null;
};

export const sanitizeInput = (str) => {
  if (typeof str !== "string") return str;
  return str.trim().slice(0, 200); // Limit to 200 chars
};

/**
 * Temporary bypass for visual/design pass (e.g., Figma mapping).
 * Enable only via env var when explicitly needed.
 */
export const AUTH_BYPASS_ENABLED =
  process.env.AUTH_BYPASS_ENABLED === "true" && process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";

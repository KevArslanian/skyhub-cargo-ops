/**
 * Temporary bypass for visual/design pass (e.g., Figma mapping).
 * Enable only during local development when explicitly needed.
 */
export const AUTH_BYPASS_ENABLED =
  process.env.NODE_ENV === "development" && process.env.AUTH_BYPASS_ENABLED === "true";

export function isTrustedDevBypassHost(hostHeader?: string | null) {
  const host = hostHeader?.trim().toLowerCase();
  if (!host) {
    return false;
  }

  const normalizedHost = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  return normalizedHost === "localhost" || normalizedHost === "127.0.0.1" || normalizedHost === "::1";
}

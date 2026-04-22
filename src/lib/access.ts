import type { UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export type AccessUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  station: string;
};

export class AccessError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "AccessError";
    this.status = status;
    this.code = code;
  }
}

export const INTERNAL_ROLES: UserRole[] = ["admin", "supervisor", "operator"];
export const SETTINGS_ROLES: UserRole[] = ["admin", "supervisor"];
export const ADMIN_ROLES: UserRole[] = ["admin"];
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/shipment-ledger",
  "/awb-tracking",
  "/flight-board",
  "/activity-log",
  "/reports",
  "/settings",
  "/exports",
] as const;

function pathMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isInternalRole(role: UserRole) {
  return INTERNAL_ROLES.includes(role);
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathMatches(pathname, prefix));
}

export function getDefaultAppRoute(role: UserRole) {
  return role === "customer" ? "/awb-tracking" : "/dashboard";
}

export function canAccessPath(role: UserRole, pathname: string) {
  if (pathMatches(pathname, "/awb-tracking")) {
    return true;
  }

  if (role === "customer") {
    return false;
  }

  if (pathMatches(pathname, "/settings")) {
    return SETTINGS_ROLES.includes(role);
  }

  if (
    pathMatches(pathname, "/dashboard") ||
    pathMatches(pathname, "/shipment-ledger") ||
    pathMatches(pathname, "/flight-board") ||
    pathMatches(pathname, "/activity-log") ||
    pathMatches(pathname, "/reports") ||
    pathMatches(pathname, "/exports")
  ) {
    return isInternalRole(role);
  }

  return true;
}

export function requirePathAccess(user: AccessUser, pathname: string) {
  if (!canAccessPath(user.role, pathname)) {
    redirect(getDefaultAppRoute(user.role));
  }

  return user;
}

export function assertRoles(user: AccessUser, roles: UserRole[], message = "Akses ditolak.", code = "FORBIDDEN") {
  if (!roles.includes(user.role)) {
    throw new AccessError(message, 403, code);
  }

  return user;
}

export function assertInternalApiAccess(user: AccessUser) {
  return assertRoles(user, INTERNAL_ROLES, "Akses API ini hanya untuk pengguna internal.", "INTERNAL_ONLY");
}

export function canManageUsers(user: AccessUser) {
  return ADMIN_ROLES.includes(user.role);
}

import type { CustomerAccountStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export type AccessUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  station: string;
  customerAccountId: string | null;
  customerAccount?: {
    id: string;
    name: string;
    status: CustomerAccountStatus;
  } | null;
};

export type NavigationItem = {
  href:
    | "/dashboard"
    | "/shipment-ledger"
    | "/awb-tracking"
    | "/flight-board"
    | "/activity-log"
    | "/reports"
    | "/settings";
  label: string;
  hint: string;
  groupId: "operasional" | "pemantauan" | "sistem";
  groupLabel: string;
  roles: UserRole[];
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
export const FLIGHT_MANAGER_ROLES: UserRole[] = ["admin", "supervisor"];
export const INTERNAL_ONLY_ROUTE_PREFIXES = ["/flight-board", "/activity-log", "/reports", "/exports"];
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

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    hint: "Ringkasan operasional",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "supervisor", "operator", "customer"],
  },
  {
    href: "/shipment-ledger",
    label: "Ledger Shipment",
    hint: "Manifest dan detail kiriman",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "supervisor", "operator", "customer"],
  },
  {
    href: "/awb-tracking",
    label: "Pelacakan AWB",
    hint: "Status dan timeline AWB",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "supervisor", "operator", "customer"],
  },
  {
    href: "/flight-board",
    label: "Papan Penerbangan",
    hint: "Cutoff dan manifest flight",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "supervisor", "operator"],
  },
  {
    href: "/activity-log",
    label: "Log Aktivitas",
    hint: "Jejak audit operasional",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "supervisor", "operator"],
  },
  {
    href: "/reports",
    label: "Pusat Laporan",
    hint: "Print dan PDF formal",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "supervisor", "operator"],
  },
  {
    href: "/settings",
    label: "Pengaturan",
    hint: "Profil, akses, preferensi",
    groupId: "sistem",
    groupLabel: "Sistem",
    roles: ["admin", "supervisor", "operator", "customer"],
  },
] as const;

export function isInternalRole(role: UserRole) {
  return INTERNAL_ROLES.includes(role);
}

export function isInternalOnlyPath(pathname: string) {
  return INTERNAL_ONLY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getNavigationForRole(role: UserRole) {
  const items = NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
  const groups = Array.from(
    items.reduce(
      (map, item) =>
        map.set(item.groupId, {
          id: item.groupId,
          label: item.groupLabel,
          items: items.filter((entry) => entry.groupId === item.groupId),
        }),
      new Map<
        NavigationItem["groupId"],
        { id: NavigationItem["groupId"]; label: string; items: NavigationItem[] }
      >(),
    ).values(),
  );

  return { items, groups };
}

export function assertCustomerAccountActive(user: AccessUser) {
  if (user.role !== "customer") {
    return null;
  }

  if (!user.customerAccountId || !user.customerAccount || user.customerAccount.status !== "active") {
    throw new AccessError("Akun pelanggan tidak aktif atau belum terhubung.", 403, "CUSTOMER_ACCOUNT_INACTIVE");
  }

  return user.customerAccountId;
}

export function requireRole(user: AccessUser, roles: UserRole[], redirectTo = "/dashboard") {
  if (!roles.includes(user.role)) {
    redirect(redirectTo);
  }

  assertCustomerAccountActive(user);
  return user;
}

export function requireInternalUser(user: AccessUser, redirectTo = "/dashboard") {
  if (!isInternalRole(user.role)) {
    redirect(redirectTo);
  }

  return user;
}

export function requireCustomerOrInternal(user: AccessUser) {
  assertCustomerAccountActive(user);
  return user;
}

export function assertInternalApiAccess(user: AccessUser) {
  if (!isInternalRole(user.role)) {
    throw new AccessError("Akses API ini hanya untuk pengguna internal.", 403, "INTERNAL_API_ONLY");
  }

  return user;
}

export function canManageUsers(user: AccessUser) {
  return user.role === "admin";
}

export function canManageCustomerAccounts(user: AccessUser) {
  return user.role === "admin";
}

export function canManageShipments(user: AccessUser) {
  return isInternalRole(user.role);
}

export function canManageFlights(user: AccessUser) {
  return FLIGHT_MANAGER_ROLES.includes(user.role);
}

export function scopeShipmentWhere(user: AccessUser): Prisma.ShipmentWhereInput {
  const baseWhere: Prisma.ShipmentWhereInput = { archivedAt: null };

  if (user.role === "customer") {
    return {
      ...baseWhere,
      customerAccountId: assertCustomerAccountActive(user),
    };
  }

  return baseWhere;
}

export function scopeAwbWhere(user: AccessUser, awb: string): Prisma.ShipmentWhereInput {
  return {
    ...scopeShipmentWhere(user),
    awb,
  };
}

export function scopeFlightWhere(): Prisma.FlightWhereInput {
  return {
    archivedAt: null,
  };
}

export function scopeCustomerAccountWhere(user: AccessUser): Prisma.CustomerAccountWhereInput {
  if (user.role === "customer") {
    return { id: assertCustomerAccountActive(user) };
  }

  if (canManageCustomerAccounts(user)) {
    return {};
  }

  return { id: "__no_customer_account_access__" };
}

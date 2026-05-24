import type { CustomerAccountStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export type AccessUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
  station: string;
  customerAccountId: string | null;
  capabilityOverrides?: {
    capability: string;
    enabled: boolean;
  }[];
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
    | "/alerts"
    | "/flight-board"
    | "/activity-log"
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

export const INTERNAL_ROLES: UserRole[] = ["admin", "staff"];
export const FLIGHT_MANAGER_ROLES: UserRole[] = ["admin", "staff"];
export const CAPABILITIES = [
  "shipment:create",
  "shipment:update",
  "shipment:delete",
  "shipment:document",
  "flight:manage",
  "payment:verify",
  "reports:export",
  "users:manage",
  "customer_accounts:manage",
  "settings:workspace",
] as const;
export type Capability = (typeof CAPABILITIES)[number];
const ALL_CAPABILITIES = new Set<Capability>(CAPABILITIES);
const STAFF_DEFAULT_CAPABILITIES = new Set<Capability>([
  "shipment:create",
  "shipment:update",
  "shipment:delete",
  "shipment:document",
  "flight:manage",
  "reports:export",
]);
const CUSTOMER_DEFAULT_CAPABILITIES = new Set<Capability>();
export const INTERNAL_ONLY_ROUTE_PREFIXES = [
  "/flight-board",
  "/alerts",
  "/activity-log",
  "/exports/shipments",
  "/exports/activity-log",
  "/exports/flights",
];
export const CUSTOMER_ALLOWED_ROUTE_PREFIXES = ["/awb-tracking", "/exports/awb"] as const;
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/shipment-ledger",
  "/awb-tracking",
  "/flight-board",
  "/alerts",
  "/activity-log",
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
    roles: ["admin", "staff"],
  },
  {
    href: "/shipment-ledger",
    label: "Ledger Shipment",
    hint: "Manifest dan detail kiriman",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "staff"],
  },
  {
    href: "/awb-tracking",
    label: "Pelacakan AWB",
    hint: "Status dan timeline AWB",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "staff", "customer"],
  },
  {
    href: "/flight-board",
    label: "Papan Penerbangan",
    hint: "Cutoff dan manifest flight",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/alerts",
    label: "Alert Center",
    hint: "Exception dan eskalasi",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/activity-log",
    label: "Log Aktivitas",
    hint: "Jejak audit operasional",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/settings",
    label: "Pengaturan",
    hint: "Profil, akses, preferensi",
    groupId: "sistem",
    groupLabel: "Sistem",
    roles: ["admin", "staff"],
  },
] as const;

export function isInternalRole(role: UserRole) {
  return INTERNAL_ROLES.includes(role);
}

export function hasCapability(user: AccessUser, capability: Capability) {
  if (!ALL_CAPABILITIES.has(capability)) {
    return false;
  }

  const override = user.capabilityOverrides?.find((entry) => entry.capability === capability);
  if (override) {
    return override.enabled;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "staff") {
    return STAFF_DEFAULT_CAPABILITIES.has(capability);
  }

  return CUSTOMER_DEFAULT_CAPABILITIES.has(capability);
}

export function getDefaultCapabilitiesForRole(role: UserRole) {
  if (role === "admin") {
    return [...CAPABILITIES];
  }

  if (role === "staff") {
    return [...STAFF_DEFAULT_CAPABILITIES];
  }

  return [...CUSTOMER_DEFAULT_CAPABILITIES];
}

export function isInternalOnlyPath(pathname: string) {
  return INTERNAL_ONLY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isCustomerAllowedPath(pathname: string) {
  return CUSTOMER_ALLOWED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
  return hasCapability(user, "users:manage");
}

export function canManageCustomerAccounts(user: AccessUser) {
  return hasCapability(user, "customer_accounts:manage");
}

export function canManageShipments(user: AccessUser) {
  return hasCapability(user, "shipment:create") || hasCapability(user, "shipment:update");
}

export function canManageFlights(user: AccessUser) {
  return hasCapability(user, "flight:manage");
}

export function canDeleteShipments(user: AccessUser) {
  return hasCapability(user, "shipment:delete");
}

export function canManageShipmentDocuments(user: AccessUser) {
  return hasCapability(user, "shipment:document");
}

export function canVerifyPayments(user: AccessUser) {
  return hasCapability(user, "payment:verify");
}

export function canExportReports(user: AccessUser) {
  return hasCapability(user, "reports:export");
}

export function canManageWorkspaceSettings(user: AccessUser) {
  return hasCapability(user, "settings:workspace");
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
    const customerAccountId = assertCustomerAccountActive(user);

    if (!customerAccountId) {
      throw new AccessError("Akun pelanggan tidak aktif atau belum terhubung.", 403, "CUSTOMER_ACCOUNT_INACTIVE");
    }

    return { id: customerAccountId };
  }

  if (canManageCustomerAccounts(user)) {
    return {};
  }

  return { id: "__no_customer_account_access__" };
}

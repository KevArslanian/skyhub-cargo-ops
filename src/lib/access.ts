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
    | "/complaints"
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
  "/complaints",
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
  "/complaints",
  "/settings",
  "/exports",
] as const;

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Pusat Kendali",
    hint: "Ringkasan utama operasional hari ini",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "staff"],
  },
  {
    href: "/shipment-ledger",
    label: "Buku Pengiriman",
    hint: "Manifest dan detail kiriman",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "staff"],
  },
  {
    href: "/awb-tracking",
    label: "Pelacakan AWB",
    hint: "Status dan linimasa AWB",
    groupId: "operasional",
    groupLabel: "Operasional",
    roles: ["admin", "staff", "customer"],
  },
  {
    href: "/flight-board",
    label: "Manajemen Pesawat",
    hint: "Jadwal, kapasitas, penugasan",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/alerts",
    label: "Pusat Peringatan",
    hint: "Pengecualian dan eskalasi",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/activity-log",
    label: "Catatan Aktivitas",
    hint: "Jejak audit operasional",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/complaints",
    label: "Kotak Keluhan",
    hint: "Laporan publik Tentang Kami",
    groupId: "pemantauan",
    groupLabel: "Pemantauan",
    roles: ["admin", "staff"],
  },
  {
    href: "/settings",
    label: "Profil & Pengaturan",
    hint: "Edit profil, akses, preferensi",
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
  void user;
  return null;
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

export function canManageCustomerAccounts(user?: AccessUser) {
  return user?.role === "admin";
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

export function canExportReports(user: AccessUser) {
  return hasCapability(user, "reports:export");
}

export function canManageWorkspaceSettings(user: AccessUser) {
  return hasCapability(user, "settings:workspace");
}

const NO_SHIPMENT_ACCESS_SENTINEL = "__no_shipment_access__";

export function scopeShipmentWhere(user: AccessUser): Prisma.ShipmentWhereInput {
  const nonArchived: Prisma.ShipmentWhereInput = { archivedAt: null };

  if (user.role === "admin") {
    return nonArchived;
  }

  if (user.role === "customer") {
    if (!user.customerAccountId) {
      return { ...nonArchived, id: NO_SHIPMENT_ACCESS_SENTINEL };
    }

    return {
      ...nonArchived,
      customerAccountId: user.customerAccountId,
    };
  }

  if (user.role === "staff") {
    const station = user.station?.trim();

    if (!station) {
      return { ...nonArchived, id: NO_SHIPMENT_ACCESS_SENTINEL };
    }

    return {
      ...nonArchived,
      OR: [{ origin: station }, { destination: station }],
    };
  }

  return { ...nonArchived, id: NO_SHIPMENT_ACCESS_SENTINEL };
}


export function andShipmentScope(user: AccessUser, extra?: Prisma.ShipmentWhereInput): Prisma.ShipmentWhereInput {
  const scope = scopeShipmentWhere(user);
  if (!extra || Object.keys(extra).length === 0) {
    return scope;
  }
  return { AND: [scope, extra] };
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
  if (canManageCustomerAccounts(user)) {
    return {};
  }
  return { id: "__no_customer_account_access__" };
}

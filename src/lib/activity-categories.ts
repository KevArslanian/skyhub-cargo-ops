import type { Prisma } from "@prisma/client";

export const ACTIVITY_CATEGORY_ALL = "all" as const;

export type ActivityCategoryId =
  | typeof ACTIVITY_CATEGORY_ALL
  | "shipment"
  | "handling"
  | "alert"
  | "complaint"
  | "flight"
  | "document"
  | "accounts";

export const ACTIVITY_CATEGORIES: Array<{ id: ActivityCategoryId; label: string }> = [
  { id: ACTIVITY_CATEGORY_ALL, label: "Semua" },
  { id: "shipment", label: "Pengiriman" },
  { id: "handling", label: "Penanganan" },
  { id: "alert", label: "Peringatan" },
  { id: "complaint", label: "Keluhan" },
  { id: "flight", label: "Penerbangan" },
  { id: "document", label: "Dokumen" },
  { id: "accounts", label: "Akun & Akses" },
];

const EXCLUDED_TARGET_TYPES = ["settings", "session"] as const;

const HANDLING_ACTIONS = ["Ubah Status"] as const;

export function getActivityCategory(input: { targetType: string; action: string }): ActivityCategoryId {
  const { targetType, action } = input;

  if (targetType === "tracking") return "handling";
  if (targetType === "shipment") {
    return HANDLING_ACTIONS.includes(action as (typeof HANDLING_ACTIONS)[number]) ? "handling" : "shipment";
  }
  if (targetType === "alert") return "alert";
  if (targetType === "complaint") return "complaint";
  if (targetType === "flight") return "flight";
  if (targetType === "document") return "document";
  if (targetType === "user" || targetType === "customer-account") return "accounts";

  return ACTIVITY_CATEGORY_ALL;
}

export function getActivityCategoryLabel(categoryId: ActivityCategoryId): string {
  return ACTIVITY_CATEGORIES.find((item) => item.id === categoryId)?.label ?? "Lainnya";
}

export function buildExcludedActivityWhere(): Prisma.ActivityLogWhereInput {
  return {
    targetType: { notIn: [...EXCLUDED_TARGET_TYPES] },
  };
}

export function buildActivityCategoryWhere(category: ActivityCategoryId): Prisma.ActivityLogWhereInput | null {
  if (category === ACTIVITY_CATEGORY_ALL) return null;

  switch (category) {
    case "handling":
      return {
        OR: [
          { targetType: "tracking" },
          { targetType: "shipment", action: { in: [...HANDLING_ACTIONS] } },
        ],
      };
    case "shipment":
      return {
        targetType: "shipment",
        NOT: { action: { in: [...HANDLING_ACTIONS] } },
      };
    case "alert":
      return { targetType: "alert" };
    case "complaint":
      return { targetType: "complaint" };
    case "flight":
      return { targetType: "flight" };
    case "document":
      return { targetType: "document" };
    case "accounts":
      return { targetType: { in: ["user", "customer-account"] } };
    default:
      return null;
  }
}

export function getActivityObjectHref(input: {
  targetType: string;
  targetId: string | null;
  targetLabel: string;
}): string | null {
  const { targetType, targetId, targetLabel } = input;
  const query = encodeURIComponent(targetLabel);

  if (targetType === "shipment" || targetType === "tracking") {
    return `/shipment-ledger?query=${query}`;
  }
  if (targetType === "complaint") {
    return `/complaints?query=${query}`;
  }
  if (targetType === "flight" && targetId) {
    return `/flight-board?query=${query}`;
  }
  if (targetType === "alert") {
    return "/alerts";
  }
  if (targetType === "document" && targetId) {
    return `/shipment-ledger?query=${encodeURIComponent(targetId)}`;
  }
  if (targetType === "user") {
    return "/settings";
  }
  if (targetType === "customer-account") {
    return "/settings";
  }

  return null;
}
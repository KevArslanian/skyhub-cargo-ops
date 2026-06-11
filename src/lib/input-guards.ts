/** Keystroke-level input sanitizers shared across landing and ops forms. */

import { PUBLIC_AWB_PREFIX } from "@/lib/constants";

const PERSON_NAME_ALLOWED = /[^a-zA-Z\s.,'&()\-]/g;
const COMMODITY_ALLOWED = /[^a-zA-Z\s.,\-&()]/g;
const REFERENCE_ALLOWED = /[^a-zA-Z0-9\-/]/g;

/** 8 digit serial setelah prefix publik 160- (landing page). */
export function formatPublicAwbSuffixInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function composePublicAwb(suffix: string) {
  const normalized = formatPublicAwbSuffixInput(suffix);
  return normalized.length === 8 ? `${PUBLIC_AWB_PREFIX}-${normalized}` : "";
}

export function extractPublicAwbSuffix(awb: string) {
  const trimmed = awb.trim();
  const prefixed = trimmed.match(new RegExp(`^${PUBLIC_AWB_PREFIX}-(\\d{0,8})$`));
  if (prefixed) {
    return formatPublicAwbSuffixInput(prefixed[1] ?? "");
  }
  return formatPublicAwbSuffixInput(trimmed.replace(/-/g, ""));
}

export function formatAwbInput(value: string) {
  let next = value.replace(/[^0-9-]/g, "");
  next = next.replace(/-+/g, "-");
  const digits = next.replace(/-/g, "");
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 11)}`;
  }
  return digits;
}

export function sanitizePersonName(value: string) {
  return value.replace(PERSON_NAME_ALLOWED, "").replace(/\d/g, "");
}

export function sanitizeCommodityText(value: string) {
  return value.replace(COMMODITY_ALLOWED, "").replace(/\d/g, "");
}

export function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...fraction] = cleaned.split(".");
  if (fraction.length === 0) {
    return whole;
  }
  return `${whole}.${fraction.join("")}`;
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, "");
}

export function sanitizePhoneInput(value: string) {
  return value.replace(/[^0-9+\s-]/g, "");
}

export function sanitizeContactInput(value: string) {
  const trimmed = value.trimStart();
  if (trimmed.includes("@")) {
    return value.replace(/[^a-zA-Z0-9@._+\-]/g, "");
  }
  return sanitizePhoneInput(value);
}

export function sanitizeReferenceInput(value: string, topic?: string) {
  if (topic === "shipment") {
    return formatAwbInput(value);
  }
  return value.replace(REFERENCE_ALLOWED, "");
}

export function sanitizeFlightNumberSuffix(value: string) {
  return sanitizeIntegerInput(value).slice(0, 4);
}

export function parseDecimalValue(value: string | number | null | undefined) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
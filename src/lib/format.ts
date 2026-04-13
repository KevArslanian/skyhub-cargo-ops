import { format, formatDistanceToNowStrict } from "date-fns";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDateTime(value: string | Date) {
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

export function formatDateOnly(value: string | Date) {
  return format(new Date(value), "dd MMM yyyy");
}

export function formatTimeOnly(value: string | Date) {
  return format(new Date(value), "HH:mm");
}

export function formatRelativeShort(value: string | Date) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatWeight(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} kg`;
}

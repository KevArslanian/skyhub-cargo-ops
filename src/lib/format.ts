import { formatDistanceToNowStrict } from "date-fns";
import { id } from "date-fns/locale";
import { clsx, type ClassValue } from "clsx";

const OPS_TIME_ZONE = "Asia/Makassar";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

function getOpsDateParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: OPS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "01",
    month: parts.find((part) => part.type === "month")?.value ?? "Jan",
    year: parts.find((part) => part.type === "year")?.value ?? "1970",
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
  };
}

export function formatDateTime(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function formatDateOnly(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.day} ${parts.month} ${parts.year}`;
}

export function formatTimeOnly(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.hour}:${parts.minute}`;
}

export function formatRelativeShort(value: string | Date) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: id });
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatWeight(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} kg`;
}

export function normalizeOperationalCopy(value: string) {
  return value
    .replace(/\bfile\b/gi, "berkas")
    .replace(/\bcleanup\b/gi, "pembersihan")
    .replace(/\bblob\b/gi, "penyimpanan");
}

import { formatDistanceToNowStrict } from "date-fns";
import { id } from "date-fns/locale";
import { clsx, type ClassValue } from "clsx";
import { ORG_TIME_ZONE } from "@/lib/constants";

function getOpsTimeZone() {
  return ORG_TIME_ZONE;
}

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

function getOpsDateParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: getOpsTimeZone(),
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

/** UI operasional wajib absolut (tanggal + jam), bukan relatif atau jam tanpa tanggal. */
export function formatDateTime(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

/** Kartu/UI sempit: tetap menyertakan tanggal, tanpa tahun. */
export function formatDateTimeCompact(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
}

export function formatDateOnly(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.day} ${parts.month} ${parts.year}`;
}

/** @deprecated Jangan dipakai di UI user-facing; gunakan formatDateTime atau formatDateTimeCompact. */
export function formatTimeOnly(value: string | Date) {
  const parts = getOpsDateParts(value);
  return `${parts.hour}:${parts.minute}`;
}

/** @deprecated Jangan dipakai di UI user-facing; gunakan formatDateTime. */
export function formatRelativeShort(value: string | Date) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: id });
}

/** Hilangkan kunci internal alert: dari pesan notifikasi (data lama di DB). */
export function formatNotificationMessage(message: string) {
  return message
    .split("\n")
    .map((line) => line.replace(/alert:[^\s]+/gi, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatWeight(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} kg`;
}

/** Tampilan AWB/referensi monospace — prefix (mis. 160-) tidak pecah di tengah. */
export function formatAwbDisplay(value: string) {
  return value.trim();
}

export function normalizeOperationalCopy(value: string) {
  return value
    .replace(/\bfile\b/gi, "berkas")
    .replace(/\bcleanup\b/gi, "pembersihan")
    .replace(/\bblob\b/gi, "penyimpanan");
}

const LOG_LEVEL_LABELS: Record<string, string> = {
  success: "Sukses",
  info: "Info",
  warning: "Peringatan",
  error: "Galat",
};

export function formatLogLevel(level: string) {
  const key = level.toLowerCase();
  return LOG_LEVEL_LABELS[key] ?? level;
}

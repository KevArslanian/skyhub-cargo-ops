import { format, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ORG_TIME_ZONE } from "@/lib/constants";

export const DATE_INPUT_PLACEHOLDER = "--/--/----";
export const DATE_TO_MAX_TODAY_MESSAGE = "Tanggal akhir tidak boleh melewati hari ini.";
export const DATE_TO_BEFORE_FROM_MESSAGE = "Tanggal akhir tidak boleh lebih awal dari tanggal awal.";

export function getOpsTodayIso(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function clampIsoDateToToday(iso: string, todayIso = getOpsTodayIso()) {
  if (!iso) return iso;
  return iso > todayIso ? todayIso : iso;
}

export function formatIsoDateLabel(iso: string) {
  if (!iso) return "";
  const parsed = parse(iso, "yyyy-MM-dd", new Date());
  return format(parsed, "dd MMM yyyy", { locale: idLocale });
}

export function applyDateInputMask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let result = "";

  for (let index = 0; index < digits.length; index += 1) {
    if (index === 2 || index === 4) result += "/";
    result += digits[index];
  }

  return result;
}

export function formatIsoToDateInput(iso: string) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

export function parseDateInputToIso(input: string) {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isIsoDateInRange(iso: string, min?: string, max?: string) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}
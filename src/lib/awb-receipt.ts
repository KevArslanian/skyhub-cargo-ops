export function buildAwbReceiptUrl(awb: string) {
  const normalized = awb.trim();
  if (!normalized) return "/exports/awb";
  return `/exports/awb?awb=${encodeURIComponent(normalized)}`;
}

export function openAwbReceiptPrint(awb: string) {
  if (typeof window === "undefined") return;
  const url = buildAwbReceiptUrl(awb);
  window.open(url, "_blank", "noopener,noreferrer");
}
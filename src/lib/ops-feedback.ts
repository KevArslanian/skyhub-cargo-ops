export type OpsAlertTone = "error" | "success" | "info" | "warning";
export type OpsToastTone = "success" | "info" | "warning";

export type OpsToastInput = {
  title: string;
  description?: string;
  tone?: OpsToastTone;
};

export type OpsAlertInput = {
  title: string;
  description?: string;
  tone?: OpsAlertTone;
};

export type OpsAlertState = OpsAlertInput & {
  open: boolean;
};

export const CLOSED_OPS_ALERT: OpsAlertState = {
  open: false,
  title: "",
  tone: "error",
};

/** Opaque icon chip for feedback modals and error boundaries (not status badges). */
export const OPS_TONE_SURFACE_ICON = {
  warning:
    "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-surface)] text-[color:var(--tone-warning)]",
  danger:
    "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-surface)] text-[color:var(--tone-danger)]",
  info: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-surface)] text-[color:var(--tone-info)]",
  success:
    "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-surface)] text-[color:var(--tone-success)]",
} as const;

/** Opaque panel surface for inline feedback copy blocks. */
export const OPS_TONE_SURFACE_BOX = {
  warning:
    "border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-surface)]",
  danger: "border border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-surface)]",
  info: "border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-surface)]",
  success:
    "border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-surface)]",
} as const;

const TECHNICAL_MESSAGE_PATTERNS = [
  /^alert:[^\s]+/i,
  /\bprisma\b/i,
  /\bunauthorized\b/i,
  /\binternal_[a-z_]+\b/i,
  /\bdatabase_[a-z_]+\b/i,
  /\bp\d{4}\b/i,
  /^error:\s*/i,
  /modulo\s*7/i,
  /\biata\b.*invalid/i,
];

export function sanitizeUserMessage(raw: string | null | undefined, fallback: string) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return fallback;
  }

  if (TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }

  if (trimmed.length > 220) {
    return fallback;
  }

  return trimmed;
}

export async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return sanitizeUserMessage(payload?.error, fallback);
}

export function networkErrorMessage(action: string) {
  return `Koneksi terputus saat ${action}. Periksa jaringan lalu coba lagi.`;
}
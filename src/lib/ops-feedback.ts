export type OpsAlertTone = "error" | "success" | "info" | "warning";
export type OpsToastTone = "success" | "info";

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

export async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || fallback;
}

export function networkErrorMessage(action: string) {
  return `Koneksi terputus saat ${action}. Periksa jaringan lalu coba lagi.`;
}
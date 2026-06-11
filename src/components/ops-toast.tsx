"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/format";
import type { OpsToastTone } from "@/lib/ops-feedback";

export type OpsToastState = {
  open: boolean;
  title: string;
  description?: string;
  tone: OpsToastTone;
};

export const CLOSED_OPS_TOAST: OpsToastState = {
  open: false,
  title: "",
  tone: "success",
};

const toneIcon = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
} as const;

const toneClass = {
  success: "ops-toast-success",
  info: "ops-toast-info",
  warning: "ops-toast-warning",
} as const;

export function OpsToast({
  toast,
  onDismiss,
}: {
  toast: OpsToastState;
  onDismiss: () => void;
}) {
  if (!toast.open) {
    return null;
  }

  const Icon = toneIcon[toast.tone];

  return (
    <div className="ops-toast-host" aria-live="polite" aria-atomic="true">
      <div className={cn("ops-toast", toneClass[toast.tone])} role="status">
        <span className="ops-toast-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="ops-toast-copy">
          <p className="ops-toast-title">{toast.title}</p>
          {toast.description ? <p className="ops-toast-description">{toast.description}</p> : null}
        </div>
        <button type="button" className="ops-toast-dismiss" onClick={onDismiss} aria-label="Tutup notifikasi">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
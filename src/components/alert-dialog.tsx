"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/format";

type AlertDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  tone?: "error" | "success" | "info" | "warning";
  okLabel?: string;
  onOk: () => void;
};

const TONE_ICON = {
  error: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

const TONE_CLASSES = {
  error: {
    icon: "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
    button: "btn btn-danger",
  },
  warning: {
    icon: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
    button: "btn btn-secondary",
  },
  success: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-600",
    button: "btn btn-primary",
  },
  info: {
    icon: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
    button: "btn btn-primary",
  },
} as const;

export function AlertDialog({
  open,
  title,
  description,
  tone = "error",
  okLabel = "OK",
  onOk,
}: AlertDialogProps) {
  const okRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    okRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onOk();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.body.classList.add("confirm-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.classList.remove("confirm-open");
      previouslyFocused?.focus();
    };
  }, [open, onOk]);

  if (!open) return null;

  const Icon = TONE_ICON[tone];
  const toneClass = TONE_CLASSES[tone];

  return (
    <div className="confirm-backdrop" onMouseDown={onOk}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby={description ? "alert-dialog-desc" : undefined}
        className="confirm-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border",
              toneClass.icon,
            )}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="alert-dialog-title"
              className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]"
            >
              {title}
            </h2>
            {description ? (
              <p
                id="alert-dialog-desc"
                className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="topbar-button min-h-[34px] px-3"
            onClick={onOk}
            aria-label="Tutup"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            ref={okRef}
            type="button"
            className={toneClass.button}
            onClick={onOk}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

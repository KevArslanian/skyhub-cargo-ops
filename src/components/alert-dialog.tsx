"use client";

import { useCallback, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { LiquidGlassOverlay } from "@/components/liquid-glass-overlay";
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
  const handleOk = useCallback(() => {
    onOk();
  }, [onOk]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    okRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        handleOk();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [handleOk, open]);

  const Icon = TONE_ICON[tone];
  const toneClass = TONE_CLASSES[tone];

  return (
    <LiquidGlassOverlay
      open={open}
      onClose={handleOk}
      variant="alert"
      theme="ops"
      closeOnBackdrop={false}
      bodyLockClass="alert-open"
      role="alertdialog"
      ariaLabelledby="alert-dialog-title"
      ariaDescribedby={description ? "alert-dialog-desc" : undefined}
      zIndex={80}
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
      </div>

      <div className="mt-6 flex justify-end">
        <button
          ref={okRef}
          type="button"
          className={cn(toneClass.button, "min-w-[96px]")}
          onClick={handleOk}
        >
          {okLabel}
        </button>
      </div>
    </LiquidGlassOverlay>
  );
}
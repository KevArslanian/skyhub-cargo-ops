"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/format";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        // Capture phase + stop so an underlying drawer/modal does not also close.
        event.stopImmediatePropagation();
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    // Dedicated lock class so dismissing this dialog never unlocks an open drawer.
    document.body.classList.add("confirm-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.classList.remove("confirm-open");
      previouslyFocused?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-backdrop" onMouseDown={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
        className="confirm-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border",
              tone === "danger"
                ? "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]"
                : "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
            )}
          >
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]"
            >
              {title}
            </h2>
            {description ? (
              <p id="confirm-dialog-desc" className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="topbar-button min-h-[34px] px-3"
            onClick={onCancel}
            aria-label="Tutup dialog konfirmasi"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

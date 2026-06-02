"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

export type ToastTone = "info" | "warning" | "danger" | "success";

type OpsToastState = {
  message: string;
  tone: ToastTone;
};

type OpsToastOptions = {
  duration?: number;
};

const TONE_CLASSES: Record<ToastTone, string> = {
  info: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  warning: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  danger: "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
  success: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
};

const TONE_ICON: Record<ToastTone, React.ElementType> = {
  info: Info,
  warning: CircleAlert,
  danger: CircleAlert,
  success: CircleCheck,
};

function getDrawerOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains("drawer-open");
}

export function useOpsToast(defaultDuration = 4000) {
  const [toast, setToast] = useState<OpsToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(defaultDuration);
  const startTimeRef = useRef(0);
  const pausedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (duration: number) => {
      clearTimer();
      startTimeRef.current = Date.now();
      remainingRef.current = duration;
      pausedRef.current = false;
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [clearTimer],
  );

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info", options?: OpsToastOptions) => {
      const duration = options?.duration ?? defaultDuration;
      setToast({ message, tone });

      if (getDrawerOpen()) {
        clearTimer();
        remainingRef.current = duration;
        pausedRef.current = true;
      } else {
        startTimer(duration);
      }
    },
    [defaultDuration, clearTimer, startTimer],
  );

  const dismissToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  useEffect(() => {
    if (!toast) {
      clearTimer();
      return;
    }

    function handleDrawerChange() {
      if (getDrawerOpen()) {
        if (timerRef.current !== null && !pausedRef.current) {
          const elapsed = Date.now() - startTimeRef.current;
          remainingRef.current = Math.max(remainingRef.current - elapsed, 1200);
          clearTimer();
          pausedRef.current = true;
        }
      } else if (pausedRef.current) {
        pausedRef.current = false;
        startTimer(remainingRef.current);
      }
    }

    const observer = new MutationObserver(handleDrawerChange);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      clearTimer();
    };
  }, [toast, clearTimer, startTimer]);

  return { toast, showToast, dismissToast };
}

export function OpsToastContainer({
  toast,
  onDismiss,
}: {
  toast: OpsToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  const Icon = TONE_ICON[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[72] flex justify-center px-4 sm:top-6"
    >
      <div
        className={cn(
          "pointer-events-auto flex items-start gap-3 rounded-[20px] border px-4 py-3 text-sm font-medium shadow-[0_12px_40px_rgba(11,30,52,0.18)] backdrop-blur-sm",
          TONE_CLASSES[toast.tone],
          "max-w-[min(520px,calc(100vw-2rem))]",
        )}
      >
        <Icon size={18} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1 leading-6">{toast.message}</span>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

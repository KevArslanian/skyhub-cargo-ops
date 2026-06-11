"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { LiquidGlassOverlay } from "@/components/liquid-glass-overlay";
import { cn } from "@/lib/format";

type OpsDrawerProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
};

export function OpsDrawer({ open, title, eyebrow, description, children, footer, onClose, className }: OpsDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
      return undefined;
    }

    if (!previouslyFocusedRef.current) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <LiquidGlassOverlay
      open={open}
      onClose={onClose}
      variant="drawer"
      backdropClassName="ops-overlay--drawer"
      panelClassName={cn("ops-drawer-panel", className)}
      panelRef={panelRef}
      panelTabIndex={-1}
      ariaLabelledby="ops-drawer-title"
      bodyLockClass="drawer-open"
      zIndex={60}
    >
      <div className="ops-drawer-header">
        <div>
          {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
          <h2 id="ops-drawer-title" className="mt-2 font-[family:var(--font-heading)] text-[1.75rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
            {title}
          </h2>
          {description ? <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{description}</p> : null}
        </div>
        <button type="button" className="topbar-button" onClick={onClose} aria-label="Tutup jendela">
          <X size={16} />
        </button>
      </div>
      <div className="ops-drawer-body ops-drawer-form-readable">{children}</div>
      {footer ? <div className="ops-drawer-footer">{footer}</div> : null}
    </LiquidGlassOverlay>
  );
}
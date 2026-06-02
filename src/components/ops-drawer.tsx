"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
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
    document.body.classList.add("drawer-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("drawer-open");
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="ops-modal-backdrop ops-drawer-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ops-drawer-title"
        tabIndex={-1}
        className={cn("ops-drawer-panel", className)}
        onMouseDown={(event) => event.stopPropagation()}
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
        <div className="ops-drawer-body">{children}</div>
        {footer ? <div className="ops-drawer-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

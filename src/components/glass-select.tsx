"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LiquidGlassBackdrop } from "@/components/liquid-glass-overlay";
import { cn } from "@/lib/format";

export type GlassSelectOption = {
  value: string;
  label: string;
  /** Shorter label for the closed trigger; menu always shows `label`. */
  shortLabel?: string;
  disabled?: boolean;
};

type GlassSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  placeholder?: string;
  theme?: "default" | "premium";
};

const SELECT_BACKDROP_Z = 70;
const SELECT_MENU_Z = 71;

function getMenuMotion(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.18 } },
      exit: { opacity: 0, transition: { duration: 0.14 } },
    };
  }

  return {
    hidden: { opacity: 0, scale: 0.92, y: -8, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.85 },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      y: -4,
      filter: "blur(4px)",
      transition: { duration: 0.18 },
    },
  };
}

export function GlassSelect({
  id,
  value,
  onChange,
  options,
  className,
  disabled,
  "aria-label": ariaLabel,
  placeholder,
  theme = "default",
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [pressedValue, setPressedValue] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const reducedMotion = useReducedMotion() ?? false;

  const selected = options.find((option) => option.value === value);
  const triggerLabel = selected?.shortLabel ?? selected?.label ?? placeholder ?? "Pilih";

  const closeMenu = useCallback(() => setOpen(false), []);

  const getMenuStyle = useCallback((): CSSProperties => {
    const trigger = triggerRef.current;
    if (!trigger) return { zIndex: SELECT_MENU_Z };

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.min(
      window.innerWidth - viewportPadding * 2,
      Math.max(rect.width, 320),
    );
    const left = Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding);

    return {
      position: "fixed",
      top: rect.bottom + 18,
      left: Math.max(viewportPadding, left),
      width: menuWidth,
      zIndex: SELECT_MENU_Z,
      maxHeight: `min(320px, calc(100svh - ${rect.bottom + 34}px))`,
    };
  }, []);

  const updatePosition = useCallback(() => {
    setMenuStyle(getMenuStyle());
  }, [getMenuStyle]);

  useEffect(() => {
    if (!open) return undefined;

    updatePosition();

    function handleReposition() {
      updatePosition();
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setPressedValue(null);
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  const menuMotion = getMenuMotion(reducedMotion);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          theme === "premium"
            ? "glass-select-trigger-premium flex items-center justify-between gap-2 text-left"
            : "select-field glass-select-trigger flex items-center justify-between gap-2 text-left",
          open && "glass-select-trigger-open",
          className,
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => {
            const next = !current;
            if (next) setMenuStyle(getMenuStyle());
            return next;
          });
        }}
      >
        <span className="truncate" title={selected?.label ?? triggerLabel}>
          {triggerLabel}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-[color:var(--muted-fg)] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <LiquidGlassBackdrop
                open={open}
                onClose={closeMenu}
                theme={theme === "premium" ? "premium" : "ops"}
                zIndex={SELECT_BACKDROP_Z}
                className={cn(
                  theme === "premium" && "liquid-glass-backdrop-select liquid-glass-backdrop-premium",
                )}
              />
              <AnimatePresence>
                {open ? (
                  <motion.div
                    ref={listRef}
                    key="glass-select-menu"
                    id={listboxId}
                    role="listbox"
                    aria-label={ariaLabel}
                    className={cn(
                      "glass-select-menu",
                      theme === "premium"
                        ? "liquid-glass-panel liquid-glass-dropdown liquid-glass-dropdown-premium"
                        : "ops-select-menu",
                    )}
                    style={menuStyle}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={menuMotion}
                    onMouseDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <div className="glass-select-menu-scroll">
                      {options.map((option) => {
                        const isSelected = option.value === value;
                        const isPressed = pressedValue === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            disabled={option.disabled}
                            className={cn(
                              "glass-select-option",
                              theme === "premium" && "glass-select-option-premium",
                              isSelected && "glass-select-option-active",
                              isPressed && "glass-select-option-pressed",
                            )}
                            onPointerDown={() => {
                              if (option.disabled) return;
                              setPressedValue(option.value);
                            }}
                            onPointerUp={() => setPressedValue(null)}
                            onPointerCancel={() => setPressedValue(null)}
                            onPointerLeave={() => setPressedValue(null)}
                            onClick={() => {
                              if (option.disabled) return;
                              onChange(option.value);
                              closeMenu();
                            }}
                          >
                            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug" title={option.label}>
                              {option.label}
                            </span>
                            {isSelected ? <Check size={14} className="shrink-0 glass-select-option-check" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
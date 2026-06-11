"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LiquidGlassBackdrop } from "@/components/liquid-glass-overlay";
import {
  applyDateInputMask,
  DATE_INPUT_PLACEHOLDER,
  formatIsoDateLabel,
  formatIsoToDateInput,
  isIsoDateInRange,
  parseDateInputToIso,
} from "@/lib/date-input";
import { cn } from "@/lib/format";

type GlassDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  "aria-label"?: string;
  placeholder?: string;
};

const PICKER_BACKDROP_Z = 70;
const PICKER_MENU_Z = 71;
const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function parseDateValue(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return isValid(parsed) ? parsed : null;
}

function toInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

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

export function GlassDatePicker({
  id,
  value,
  onChange,
  className,
  disabled,
  min,
  max,
  "aria-label": ariaLabel,
  placeholder = "Pilih tanggal",
}: GlassDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const reducedMotion = useReducedMotion() ?? false;

  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(min ?? "");
  const maxDate = parseDateValue(max ?? "");

  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());

  const closeMenu = useCallback(() => setOpen(false), []);

  const getMenuStyle = useCallback((): CSSProperties => {
    const control = controlRef.current;
    if (!control) return { zIndex: PICKER_MENU_Z };

    const rect = control.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.max(rect.width, 280);
    const left = Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding);

    return {
      position: "fixed",
      top: rect.bottom + 18,
      left: Math.max(viewportPadding, left),
      width: menuWidth,
      zIndex: PICKER_MENU_Z,
    };
  }, []);

  const updatePosition = useCallback(() => {
    setMenuStyle(getMenuStyle());
  }, [getMenuStyle]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value ? formatIsoToDateInput(value) : "");
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (!open) return undefined;
    if (selectedDate) setVisibleMonth(selectedDate);
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
  }, [open, selectedDate, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [visibleMonth]);

  const isDayDisabled = useCallback(
    (day: Date) => {
      if (minDate && isBefore(day, minDate)) return true;
      if (maxDate && isAfter(day, maxDate)) return true;
      return false;
    },
    [maxDate, minDate],
  );

  const commitDraft = useCallback(() => {
    if (!draft) {
      onChange("");
      return;
    }

    const iso = parseDateInputToIso(draft);
    if (!iso || !isIsoDateInRange(iso, min, max)) {
      setDraft(value ? formatIsoToDateInput(value) : "");
      return;
    }

    onChange(iso);
  }, [draft, max, min, onChange, value]);

  const handleInputFocus = () => {
    if (disabled) return;
    setIsEditing(true);
    setDraft(value ? formatIsoToDateInput(value) : "");
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    commitDraft();
  };

  const handleInputChange = (nextValue: string) => {
    setDraft(applyDateInputMask(nextValue));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      inputRef.current?.blur();
      return;
    }

    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
      setMenuStyle(getMenuStyle());
    }
  };

  const displayValue = isEditing ? draft : value ? formatIsoDateLabel(value) : "";

  const inputPlaceholder = isEditing ? DATE_INPUT_PLACEHOLDER : placeholder;

  const menuMotion = getMenuMotion(reducedMotion);

  return (
    <>
      <div
        ref={controlRef}
        className={cn(
          "glass-date-picker-control input-field input-field-trailing",
          open && "glass-date-picker-control-open",
          disabled && "glass-date-picker-control-disabled",
          className,
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={panelId}
          placeholder={inputPlaceholder}
          value={displayValue}
          suppressHydrationWarning
          className="glass-date-picker-input"
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <button
          type="button"
          className="glass-date-picker-icon-btn"
          aria-label={ariaLabel ? `${ariaLabel}, buka kalender` : "Buka kalender"}
          disabled={disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => {
              const next = !current;
              if (next) setMenuStyle(getMenuStyle());
              return next;
            });
          }}
        >
          <Calendar size={16} />
        </button>
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <LiquidGlassBackdrop
                open={open}
                onClose={closeMenu}
                theme="ops"
                zIndex={PICKER_BACKDROP_Z}
              />
              <AnimatePresence>
                {open ? (
                  <motion.div
                    key="glass-date-picker-menu"
                    id={panelId}
                    role="dialog"
                    aria-label={ariaLabel ?? "Kalender"}
                    className="ops-date-picker-panel glass-date-picker-panel"
                    style={menuStyle}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={menuMotion}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <div className="glass-date-picker-head">
                      <button
                        type="button"
                        className="glass-date-picker-nav"
                        aria-label="Bulan sebelumnya"
                        onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <p className="glass-date-picker-month">
                        {format(visibleMonth, "MMMM yyyy", { locale: idLocale })}
                      </p>
                      <button
                        type="button"
                        className="glass-date-picker-nav"
                        aria-label="Bulan berikutnya"
                        onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="glass-date-picker-weekdays" aria-hidden="true">
                      {WEEKDAY_LABELS.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>

                    <div className="glass-date-picker-grid" role="grid" aria-label={ariaLabel ?? "Kalender"}>
                      {calendarDays.map((day) => {
                        const inMonth = isSameMonth(day, visibleMonth);
                        const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                        const dayDisabled = isDayDisabled(day);

                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            role="gridcell"
                            aria-selected={selected}
                            disabled={dayDisabled}
                            className={cn(
                              "glass-date-picker-day",
                              !inMonth && "glass-date-picker-day-muted",
                              selected && "glass-date-picker-day-active",
                            )}
                            onClick={() => {
                              if (dayDisabled) return;
                              onChange(toInputValue(day));
                              setIsEditing(false);
                              closeMenu();
                            }}
                          >
                            {format(day, "d")}
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
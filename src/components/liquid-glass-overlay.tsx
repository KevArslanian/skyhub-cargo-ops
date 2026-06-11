"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/format";

const APPLE_EASE = [0.32, 0.72, 0, 1] as const;
const DISMISS_EASE = [0.4, 0, 1, 1] as const;

export type LiquidGlassVariant = "alert" | "sheet" | "drawer" | "sidebar";
export type LiquidGlassTheme = "ops" | "premium";

type LiquidGlassOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  variant?: LiquidGlassVariant;
  theme?: LiquidGlassTheme;
  zIndex?: number;
  closeOnBackdrop?: boolean;
  role?: string;
  ariaModal?: boolean;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  bodyLockClass?: string;
  panelTabIndex?: number;
  panelRef?: RefObject<HTMLDivElement | null>;
};

const VARIANT_Z: Record<LiquidGlassVariant, number> = {
  sidebar: 40,
  drawer: 60,
  sheet: 80,
  alert: 80,
};

function getPanelMotion(
  reducedMotion: boolean,
  variant: LiquidGlassVariant,
  centered: boolean,
  theme: LiquidGlassTheme = "ops",
) {
  if (reducedMotion) {
    const drawerPose = variant === "drawer" ? { x: "-50%" } : {};
    const centeredPose = centered ? { x: "-50%", y: "-50%" } : drawerPose;
    return {
      hidden: { opacity: 0, ...centeredPose },
      visible: { opacity: 1, ...centeredPose, transition: { duration: 0.24, ease: APPLE_EASE } },
      exit: { opacity: 0, ...centeredPose, transition: { duration: 0.18, ease: DISMISS_EASE } },
    };
  }

  if (variant === "alert" && theme === "ops") {
    return {
      hidden: { opacity: 0, scale: 0.98, x: "-50%", y: "-50%" },
      visible: {
        opacity: 1,
        scale: 1,
        x: "-50%",
        y: "-50%",
        transition: { duration: 0.2, ease: APPLE_EASE },
      },
      exit: {
        opacity: 0,
        scale: 0.99,
        x: "-50%",
        y: "-50%",
        transition: { duration: 0.16, ease: DISMISS_EASE },
      },
    };
  }

  if (variant === "drawer") {
    return {
      hidden: { opacity: 0, scale: 0.96, x: "-50%", y: 24, filter: "blur(10px)" },
      visible: {
        opacity: 1,
        scale: 1,
        x: "-50%",
        y: 0,
        filter: "blur(0px)",
        transition: {
          type: "spring" as const,
          stiffness: 220,
          damping: 22,
          mass: 1.05,
        },
      },
      exit: {
        opacity: 0,
        scale: 0.98,
        x: "-50%",
        y: 12,
        filter: "blur(4px)",
        transition: { duration: 0.3, ease: DISMISS_EASE },
      },
    };
  }

  if (variant === "sidebar") {
    return {
      hidden: { opacity: 0, x: "-104%" },
      visible: {
        opacity: 1,
        x: 0,
        transition: { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.9 },
      },
      exit: {
        opacity: 0,
        x: "-104%",
        transition: { duration: 0.28, ease: DISMISS_EASE },
      },
    };
  }

  if (centered) {
    return {
      hidden: { opacity: 0, scale: 0.72, x: "-50%", y: "calc(-50% + 48px)", filter: "blur(14px)" },
      visible: {
        opacity: 1,
        scale: 1,
        x: "-50%",
        y: "-50%",
        filter: "blur(0px)",
        transition: {
          type: "spring" as const,
          stiffness: 220,
          damping: 22,
          mass: 1.05,
        },
      },
      exit: {
        opacity: 0,
        scale: 0.9,
        x: "-50%",
        y: "calc(-50% + 20px)",
        filter: "blur(6px)",
        transition: { duration: 0.3, ease: DISMISS_EASE },
      },
    };
  }

  return {
    hidden: { opacity: 0, scale: 0.72, y: 48, filter: "blur(14px)" },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 220,
        damping: 22,
        mass: 1.05,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      filter: "blur(6px)",
      transition: { duration: 0.3, ease: DISMISS_EASE },
    },
  };
}

function getBackdropMotion(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.24, ease: APPLE_EASE } },
      exit: { opacity: 0, transition: { duration: 0.18, ease: DISMISS_EASE } },
    };
  }

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.48, ease: APPLE_EASE },
    },
    exit: { opacity: 0, transition: { duration: 0.32, ease: DISMISS_EASE } },
  };
}

function getPanelLayout(variant: LiquidGlassVariant): CSSProperties {
  if (variant === "sidebar") {
    return {
      position: "fixed",
      inset: "0 auto 0 0",
      margin: 0,
      maxHeight: "100svh",
    };
  }

  if (variant === "drawer") {
    return {
      position: "fixed",
      left: "50%",
      top: "max(16px, env(safe-area-inset-top))",
      bottom: "max(16px, env(safe-area-inset-bottom))",
      margin: 0,
      translate: "none",
      maxHeight: "none",
      height: "auto",
    };
  }

  return {
    position: "fixed",
    left: "50%",
    top: "50%",
    margin: 0,
    translate: "none",
  };
}

export function LiquidGlassOverlay({
  open,
  onClose,
  children,
  panelClassName,
  backdropClassName,
  variant = "alert",
  theme = "ops",
  zIndex,
  closeOnBackdrop = true,
  role = "dialog",
  ariaModal = true,
  ariaLabelledby,
  ariaDescribedby,
  bodyLockClass,
  panelTabIndex,
  panelRef,
}: LiquidGlassOverlayProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const resolvedZ = zIndex ?? VARIANT_Z[variant];
  const isSidebar = variant === "sidebar";
  const isCentered = variant !== "sidebar" && variant !== "drawer";

  useEffect(() => {
    if (!open || !bodyLockClass) return undefined;
    document.body.classList.add(bodyLockClass);
    return () => {
      document.body.classList.remove(bodyLockClass);
    };
  }, [bodyLockClass, open]);

  if (typeof document === "undefined") {
    return null;
  }

  const backdropMotion = getBackdropMotion(reducedMotion);
  const panelMotion = getPanelMotion(reducedMotion, variant, isCentered, theme);
  const panelLayout = getPanelLayout(variant);
  const isOpsTheme = theme === "ops";
  const isAlertVariant = variant === "alert";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="liquid-glass-backdrop"
            className={cn(
              isOpsTheme ? "ops-overlay" : "liquid-glass-backdrop",
              theme === "premium" && "liquid-glass-backdrop-premium",
              isOpsTheme && isSidebar && "ops-overlay-sidebar",
              !isOpsTheme && isSidebar && "liquid-glass-backdrop-sidebar",
              isOpsTheme && isAlertVariant && "ops-overlay--alert",
              backdropClassName,
            )}
            style={{ zIndex: resolvedZ }}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropMotion}
            onMouseDown={closeOnBackdrop ? onClose : undefined}
          />
          <motion.div
            key="liquid-glass-panel"
            ref={panelRef}
            role={role}
            aria-modal={ariaModal}
            aria-labelledby={ariaLabelledby}
            aria-describedby={ariaDescribedby}
            tabIndex={panelTabIndex}
            className={cn(
              isOpsTheme ? "ops-overlay-panel" : "liquid-glass-panel",
              theme === "premium" && "liquid-glass-panel-premium",
              variant === "alert" &&
                (isOpsTheme ? "ops-alert-panel confirm-panel" : "liquid-glass-panel-alert confirm-panel"),
              variant === "sheet" && "liquid-glass-panel-sheet",
              variant === "drawer" &&
                (isOpsTheme ? "ops-overlay-panel-drawer ops-drawer-panel" : "liquid-glass-panel-drawer ops-drawer-panel"),
              variant === "sidebar" && (isOpsTheme ? "ops-sidebar-panel" : "liquid-glass-panel-sidebar"),
              panelClassName,
            )}
            style={{ ...panelLayout, zIndex: resolvedZ + 1 }}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={panelMotion}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

type LiquidGlassBackdropProps = {
  open: boolean;
  onClose: () => void;
  theme?: LiquidGlassTheme;
  zIndex?: number;
  className?: string;
};

export function LiquidGlassBackdrop({
  open,
  onClose,
  theme = "ops",
  zIndex = 40,
  className,
}: LiquidGlassBackdropProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const backdropMotion = getBackdropMotion(reducedMotion);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="liquid-glass-backdrop"
          className={cn(
            theme === "ops" ? "ops-overlay" : "liquid-glass-backdrop",
            theme === "premium" && "liquid-glass-backdrop-premium",
            className,
          )}
          style={{ zIndex }}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={backdropMotion}
          onMouseDown={onClose}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
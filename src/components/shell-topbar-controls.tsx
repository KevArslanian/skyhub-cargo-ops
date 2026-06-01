"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

type ShellTopbarControlsContextValue = {
  setControls: (controls: ReactNode) => void;
};

export const ShellTopbarControlsContext = createContext<ShellTopbarControlsContextValue | null>(null);

export function useShellTopbarControls(controls: ReactNode) {
  const context = useContext(ShellTopbarControlsContext);

  useEffect(() => {
    if (!context) {
      return undefined;
    }

    context.setControls(controls);
    return () => context.setControls(null);
  }, [context, controls]);
}

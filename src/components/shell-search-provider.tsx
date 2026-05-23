"use client";

import { createContext, useContext } from "react";

export type ShellSearchEventDetail = {
  pathname: string;
  query: string;
};

export type ShellSearchConfig = {
  scope: string;
  placeholder: string;
  filterSummary?: string;
};

const ShellSearchContext = createContext<ShellSearchConfig>({
  scope: "global",
  placeholder: "Cari AWB, shipment, atau flight",
});

export function ShellSearchProvider({ children, value }: { children: React.ReactNode; value: ShellSearchConfig }) {
  return <ShellSearchContext.Provider value={value}>{children}</ShellSearchContext.Provider>;
}

export function useShellSearchConfig() {
  return useContext(ShellSearchContext);
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useDashboardData, type DashboardDataContext } from "@/hooks/use-dashboard-data";

const DashboardContext = createContext<DashboardDataContext | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const value = useDashboardData();
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardContext must be used within DashboardProvider");
  return ctx;
}
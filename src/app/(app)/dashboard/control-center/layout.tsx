"use client";

import type { ReactNode } from "react";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";
import { ControlCenterShell } from "@/components/dashboard/control-center-shell";

export default function ControlCenterLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <ControlCenterShell>{children}</ControlCenterShell>
    </DashboardProvider>
  );
}
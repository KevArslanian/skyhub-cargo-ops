"use client";

import type { ReactNode } from "react";
import { OpsAlertProvider } from "@/components/ops-alert-provider";

export function LoginProviders({ children }: { children: ReactNode }) {
  return <OpsAlertProvider>{children}</OpsAlertProvider>;
}
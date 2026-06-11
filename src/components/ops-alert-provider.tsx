"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "@/components/alert-dialog";
import { CLOSED_OPS_TOAST, OpsToast } from "@/components/ops-toast";
import {
  CLOSED_OPS_ALERT,
  readApiError,
  type OpsAlertInput,
  type OpsAlertState,
  type OpsToastInput,
} from "@/lib/ops-feedback";

const TOAST_AUTO_DISMISS_MS = 4200;

type OpsAlertContextValue = {
  alert: OpsAlertState;
  showAlert: (input: OpsAlertInput) => void;
  showToast: (input: OpsToastInput) => void;
  closeAlert: () => void;
  readApiError: typeof readApiError;
};

const OpsAlertContext = createContext<OpsAlertContextValue | null>(null);

export function OpsAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<OpsAlertState>(CLOSED_OPS_ALERT);
  const [toast, setToast] = useState(CLOSED_OPS_TOAST);
  const toastTimerRef = useRef<number | null>(null);

  const closeToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast((current) => ({ ...current, open: false }));
  }, []);

  const showAlert = useCallback((input: OpsAlertInput) => {
    setAlert({
      open: true,
      title: input.title,
      description: input.description,
      tone: input.tone ?? "error",
    });
  }, []);

  const showToast = useCallback(
    (input: OpsToastInput) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      setToast({
        open: true,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "success",
      });

      toastTimerRef.current = window.setTimeout(() => {
        closeToast();
      }, TOAST_AUTO_DISMISS_MS);
    },
    [closeToast],
  );

  const closeAlert = useCallback(() => {
    setAlert((current) => ({ ...current, open: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <OpsAlertContext.Provider value={{ alert, showAlert, showToast, closeAlert, readApiError }}>
      {children}
      <AlertDialog
        open={alert.open}
        title={alert.title}
        description={alert.description}
        tone={alert.tone}
        onOk={closeAlert}
      />
      <OpsToast toast={toast} onDismiss={closeToast} />
    </OpsAlertContext.Provider>
  );
}

export function useOpsAlert() {
  const context = useContext(OpsAlertContext);
  if (!context) {
    throw new Error("useOpsAlert must be used within OpsAlertProvider");
  }
  return context;
}
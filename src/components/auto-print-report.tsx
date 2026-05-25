"use client";

import { useEffect, useRef } from "react";

export function AutoPrintReport() {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;

    let cancelled = false;
    let timeoutId: number | undefined;

    async function triggerPrint() {
      await document.fonts?.ready.catch(() => undefined);

      window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => {
          if (!cancelled) window.print();
        }, 350);
      });
    }

    void triggerPrint();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}

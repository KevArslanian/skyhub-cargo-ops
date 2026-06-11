"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, ServerCrash } from "lucide-react";
import { OPS_TONE_SURFACE_ICON } from "@/lib/ops-feedback";
import { cn } from "@/lib/format";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-[color:var(--app-bg)] px-4 py-10 text-[color:var(--app-fg)]">
      <div className="w-full max-w-md rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-8 text-center shadow-[var(--shadow-soft)]">
        <span
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border",
            OPS_TONE_SURFACE_ICON.danger,
          )}
        >
          <ServerCrash size={26} />
        </span>
        <h1 className="mt-5 font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
          Sistem sedang bermasalah
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-fg)]">
          Terjadi kendala saat memuat data dari server atau database. Coba muat ulang halaman. Jika masih berlanjut,
          hubungi tim operasional.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            <RotateCcw size={16} />
            Coba lagi
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            Kembali ke dasbor
          </Link>
        </div>
      </div>
    </div>
  );
}

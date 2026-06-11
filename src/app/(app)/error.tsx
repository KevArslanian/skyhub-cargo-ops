"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, ServerCrash } from "lucide-react";
import { cn } from "@/lib/format";
import { OPS_TONE_SURFACE_ICON } from "@/lib/ops-feedback";

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ops-route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-8 text-center shadow-[var(--shadow-soft)]">
        <span
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border",
            OPS_TONE_SURFACE_ICON.danger,
          )}
        >
          <ServerCrash size={26} />
        </span>
        <h2 className="mt-5 font-[family:var(--font-heading)] text-xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
          Halaman operasional gagal dimuat
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-fg)]">
          Data dari server atau database belum bisa ditampilkan. Muat ulang halaman atau kembali ke Pusat Kendali.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            <RotateCcw size={16} />
            Coba lagi
          </button>
          <Link href="/dashboard" className="btn btn-secondary">
            Pusat Kendali
          </Link>
        </div>
      </div>
    </div>
  );
}
import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[color:var(--app-bg)] px-4 py-10 text-[color:var(--app-fg)]">
      <div className="w-full max-w-md rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-8 text-center shadow-[var(--shadow-soft)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--brand-primary)]">
          <Compass size={26} />
        </span>
        <h1 className="mt-5 font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-fg)]">
          Alamat yang kamu tuju tidak tersedia atau sudah dipindahkan.
        </p>
        <div className="mt-6">
          <Link href="/dashboard" className="btn btn-primary">
            Kembali ke dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

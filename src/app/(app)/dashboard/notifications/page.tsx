"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { PageHeader, OpsPanel } from "@/components/ops-ui";

/** Daftar pemberitahuan penuh — path unik untuk tombol lonceng */
export default function DashboardNotificationsPage() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-4">
      <PageHeader eyebrow="Pusat Kendali" title="Pemberitahuan" />
      <OpsPanel className="rounded-[18px] p-6">
        <div className="flex flex-col items-center py-10 text-center">
          <Bell size={32} className="text-[color:var(--brand-primary)]" aria-hidden="true" />
          <p className="mt-4 text-base font-semibold text-[color:var(--text-strong)]">Pemberitahuan in-app</p>
          <p className="mt-2 max-w-md text-sm text-[color:var(--muted-fg)]">
            Gunakan ikon lonceng di bilah atas untuk melihat notifikasi terbaru. Tandai dibaca atau buka detail dari sana.
          </p>
          <Link href={DASHBOARD_ROUTES.summary} className="btn btn-primary mt-6">
            Kembali ke Ringkasan
          </Link>
        </div>
      </OpsPanel>
    </div>
  );
}
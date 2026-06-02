import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, FileText, PlaneTakeoff, Printer, Radar } from "lucide-react";
import { canExportReports, requireInternalUser } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { DataCard, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

export const dynamic = "force-dynamic";

const reportRoutes = [
  {
    title: "Buku Pengiriman",
    href: "/exports/shipments",
    description: "Cetak manifest aktif, data pengirim, penerima, rute, tarif, kendaraan, dan status.",
    icon: FileText,
  },
  {
    title: "Management Pesawat",
    href: "/exports/flights",
    description: "Cetak jadwal, assignment pesawat, registrasi, gate, status, dan jumlah pengiriman per penerbangan.",
    icon: PlaneTakeoff,
  },
  {
    title: "Pelacakan AWB",
    href: "/awb-tracking",
    description: "Cari AWB terlebih dahulu, lalu buka penampil cetak dari hasil pelacakan.",
    icon: Radar,
    sameTab: true,
  },
  {
    title: "Catatan Aktivitas",
    href: "/exports/activity-log",
    description: "Cetak jejak audit aktivitas pengguna, perubahan pengiriman, penerbangan, dokumen, dan peringatan.",
    icon: Activity,
  },
] as const;

export default async function ReportsPage() {
  const user = await requireUser();
  requireInternalUser(user);

  if (!canExportReports(user)) {
    redirect("/dashboard");
  }

  return (
    <main className="page-main space-y-6">
      <PageHeader
        eyebrow="Pusat Laporan"
        title="Laporan"
        subtitle="Dokumen operasional siap cetak untuk pengiriman, penerbangan, AWB, dan audit aktivitas."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <DataCard
          label="Mode"
          value="Penampil Peramban"
          note="Setiap laporan dibuka di tab baru dengan penampil cetak bawaan peramban."
          icon={Printer}
          tone="primary"
        />
        <DataCard
          label="Akses"
          value={user.role === "admin" ? "Administrator" : "Staf"}
          note="Pelanggan tidak mendapat akses laporan internal. AWB pelanggan tetap lewat halaman pelacakan."
          icon={FileText}
          tone="info"
        />
        <DataCard
          label="Keluaran"
          value="3 Dokumen + AWB"
          note="Pengiriman, management pesawat, dan log langsung dibuka ke penampil cetak. AWB dicetak setelah nomor resi ditemukan."
          icon={Activity}
          tone="success"
        />
      </section>

      <OpsPanel className="p-5">
        <SectionHeader
          title="Penampil Cetak Terpisah"
          subtitle="Pilih dokumen yang dibutuhkan. Tab kerja tetap terbuka, penampil cetak muncul di tab baru."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reportRoutes.map((report) => {
            const Icon = report.icon;
            const sameTab = "sameTab" in report && report.sameTab;
            return (
              <Link
                key={report.href}
                href={report.href}
                target={sameTab ? undefined : "_blank"}
                rel={sameTab ? undefined : "noopener noreferrer"}
                className="group min-w-0 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 transition hover:-translate-y-[1px] hover:border-[color:var(--brand-primary)]/30 hover:bg-[color:var(--brand-primary-soft)]"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--border-soft)] bg-white/70 text-[color:var(--brand-primary)] dark:bg-white/5">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 font-[family:var(--font-heading)] text-xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  {report.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{report.description}</p>
                <span className="mt-4 inline-flex text-sm font-bold text-[color:var(--brand-primary)]">
                  {sameTab ? "Cari AWB" : "Buka penampil cetak"}
                </span>
              </Link>
            );
          })}
        </div>
      </OpsPanel>
    </main>
  );
}

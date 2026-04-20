import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
  COMPANY_HERO_METRICS,
} from "@/lib/company-profile";

const ABOUT_POINTS = [
  "Pantau shipment, flight, dan exception dalam satu ruang kontrol.",
  "Timeline AWB, ledger, audit, dan notifikasi memakai data source yang sama.",
  "Akses role-based untuk admin, staff operasional, dan portal pelanggan.",
] as const;

export default function AboutUsPage() {
  return (
    <div className="auth-atmosphere text-[color:var(--text-strong)]">
      <div className="auth-min-shell">
        <div className="auth-min-frame">
          <header className="auth-min-header">
            <BrandMark
              className="gap-4"
              tileClassName="h-14 w-14 rounded-[18px] border border-[#d5c9b7] bg-white/88"
              titleClassName="text-[1.2rem] text-[#10213d]"
              subtitleClassName="text-[#667487]"
            />
            <span className="auth-metric-pill">
              <Sparkles size={14} className="text-[color:var(--brand-primary)]" />
              Halaman awal
            </span>
          </header>

          <main className="auth-min-main">
            <div className="auth-min-grid">
              <section className="auth-min-card p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a765a]">SkyHub Cargo Ops</p>
                <h1 className="mt-4 font-[family:var(--font-heading)] text-[clamp(2rem,3.5vw,3rem)] font-black leading-tight tracking-[-0.05em] text-[#10213d]">
                  {COMPANY_HERO_HEADLINE}
                </h1>
                <p className="mt-4 text-sm leading-7 text-[#5e6676]">{COMPANY_HERO_COPY}</p>
                <p className="mt-3 text-sm leading-7 text-[#5e6676]">{COMPANY_ABOUT_COPY}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {COMPANY_HERO_METRICS.map((metric) => (
                    <div key={metric.label} className="rounded-[18px] border border-[#dfd3c3] bg-white/74 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f806a]">{metric.label}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#172236]">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="auth-min-card p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a765a]">Akses Cepat</p>
                <h2 className="mt-3 font-[family:var(--font-heading)] text-[1.45rem] font-extrabold tracking-[-0.03em] text-[#172236]">
                  Ringkas, jelas, dan siap lanjut login.
                </h2>

                <div className="mt-4 space-y-3">
                  {ABOUT_POINTS.map((item) => (
                    <div key={item} className="rounded-[18px] border border-[#dfd3c3] bg-white/74 px-4 py-3">
                      <p className="text-sm leading-7 text-[#5e6676]">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[20px] border border-[#d8ccba] bg-[#17315f] px-4 py-4 text-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-white/82" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/62">Portal Auth</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/86">
                    Halaman login dipisahkan khusus untuk autentikasi agar proses masuk tetap cepat dan fokus.
                  </p>
                </div>

                <form action="/api/auth/intro" method="POST" className="mt-5">
                  <button type="submit" className="btn btn-primary w-full">
                    <ArrowRight size={16} />
                    Lanjut ke Login
                  </button>
                </form>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

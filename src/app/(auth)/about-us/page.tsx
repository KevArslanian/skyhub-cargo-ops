import { Building2, ShieldCheck, Workflow } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_CONTACT_ITEMS,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
  COMPANY_OPERATOR_NOTE,
} from "@/lib/company-profile";

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-6 text-[color:var(--app-fg)] lg:px-6 lg:py-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
        <header className="ops-panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <BrandMark />
          <form action="/api/auth/intro" method="POST">
            <button type="submit" className="btn btn-primary">
              Lanjut ke Login
            </button>
          </form>
        </header>

        <section className="ops-panel px-6 py-7 lg:px-8 lg:py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_320px]">
            <div>
              <p className="ops-eyebrow">Profil Perusahaan</p>
              <h1 className="mt-4 font-[family:var(--font-heading)] text-[clamp(2.5rem,5vw,4.4rem)] font-black leading-[0.96] tracking-[-0.07em] text-[color:var(--text-strong)]">
                {COMPANY_HERO_HEADLINE}
              </h1>
              <p className="mt-5 max-w-[760px] text-[0.98rem] leading-8 text-[color:var(--muted-fg)]">
                {COMPANY_HERO_COPY}
              </p>
              <p className="mt-5 max-w-[760px] text-[0.98rem] leading-8 text-[color:var(--muted-fg)]">
                {COMPANY_ABOUT_COPY}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="ops-panel-muted px-5 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary-2)]">
                    <Workflow size={20} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                      Fokus Platform
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
                      Monitoring shipment, manifest, papan flight, audit, dan notifikasi dalam satu alur kerja formal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ops-panel-muted px-5 py-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary-2)]">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                      Kualitas Operasional
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
                      Antarmuka dirancang untuk shift kerja panjang: hierarki jelas, panel stabil, dan akses data yang cepat.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ops-panel-muted px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                  Akses Sistem
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
                  Lanjutkan ke login untuk masuk ke dashboard internal atau portal pelanggan sesuai role akun Anda.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="ops-panel px-6 py-6">
            <p className="ops-eyebrow">Catatan Operasional</p>
            <p className="mt-4 text-[0.98rem] leading-8 text-[color:var(--muted-fg)]">{COMPANY_OPERATOR_NOTE}</p>
          </div>

          <div className="ops-panel px-6 py-6">
            <div className="inline-flex min-h-[44px] items-center gap-2 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 text-sm font-semibold text-[color:var(--muted-fg)]">
              <Building2 size={16} />
              SkyHub Pusat Operasional
            </div>
            <div className="mt-5 grid gap-3">
              {COMPANY_CONTACT_ITEMS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="ops-panel-muted px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary-2)]">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                        {label}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--text-strong)]">{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

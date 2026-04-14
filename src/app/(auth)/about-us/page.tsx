import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_CONTACT_ITEMS,
  COMPANY_FACTS,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
  COMPANY_OPERATOR_NOTE,
} from "@/lib/company-profile";

const heroImage =
  "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=1800&q=80";

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="about-shell">
        <div className="about-frame">
          <header className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <BrandMark />
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn btn-secondary">
                Login
              </Link>
              <Link href="/" className="btn btn-primary">
                Open App
              </Link>
            </div>
          </header>

          <section className="about-hero ops-panel-strong relative overflow-hidden px-7 py-7 lg:px-9 lg:py-9">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-28"
              style={{ backgroundImage: `url('${heroImage}')` }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,17,34,0.92),rgba(30,64,175,0.78),rgba(37,99,235,0.38))]" />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "42px 42px",
              }}
            />

            <div className="about-hero-grid relative z-10">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                  SkyHub Company Profile
                </p>
                <h1 className="mt-5 max-w-[760px] font-[family:var(--font-heading)] text-[clamp(2.7rem,5vw,5rem)] font-black leading-[0.97] tracking-[-0.07em] text-white">
                  Sistem cargo udara yang formal, stabil, dan siap dipakai untuk ritme operasional bandara.
                </h1>
                <p className="mt-6 max-w-[760px] text-[1rem] leading-8 text-white/82">{COMPANY_HERO_COPY}</p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/14 bg-white/10 px-5 py-5 backdrop-blur-md">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                    Platform Focus
                  </p>
                  <p className="mt-3 font-[family:var(--font-heading)] text-[1.8rem] font-black tracking-[-0.05em] text-white">
                    Cargo Ops Control
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/78">
                    Monitoring shipment, manifest, flight board, dan audit log dalam satu control surface.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/14 bg-white/10 px-5 py-5 backdrop-blur-md">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                    Why SkyHub
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/82">
                    {COMPANY_HERO_HEADLINE} Desain dan alur sistem disusun agar operator tetap cepat membaca
                    informasi penting walau bekerja panjang di depan monitor.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="about-content-grid">
            <div className="panel px-6 py-6">
              <p className="ops-eyebrow">About SkyHub</p>
              <h2 className="mt-3 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                Company Profile
              </h2>
              <p className="mt-4 text-[0.98rem] leading-8 text-[color:var(--muted-fg)]">
                {COMPANY_ABOUT_COPY}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="ops-panel-muted px-5 py-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary-2)]">
                      <Workflow size={20} />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                        Operational Model
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--muted-fg)]">
                        SkyHub menyatukan lookup AWB, flight board, manifest control, dan alert audit untuk
                        operator, supervisor, dan tim gudang udara.
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
                        Reliability
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--muted-fg)]">
                        Antarmuka difokuskan pada keterbacaan, stabilitas, dan alur kerja cepat untuk kebutuhan
                        decision making selama shift operasional.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel px-6 py-6">
              <p className="ops-eyebrow">Company Facts</p>
              <h2 className="mt-3 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                Cakupan dan layanan utama
              </h2>
              <div className="mt-6 grid gap-4">
                {COMPANY_FACTS.map((item) => (
                  <div key={item.label} className="ops-panel-muted px-5 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                      {item.label}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--text-strong)]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ops-eyebrow">Contact Information</p>
                <h2 className="mt-3 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                  Direktori contact terpadu
                </h2>
              </div>
              <div className="inline-flex min-h-[44px] items-center gap-2 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 text-sm font-semibold text-[color:var(--muted-fg)]">
                <Building2 size={16} />
                SkyHub Operations Center
              </div>
            </div>

            <div className="about-contact-grid mt-6">
              {COMPANY_CONTACT_ITEMS.map(({ icon: Icon, label, value, href }) => {
                const content = (
                  <div className="ops-panel-muted h-full px-5 py-5 transition hover:-translate-y-[1px]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary-2)]">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                          {label}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-[color:var(--text-strong)]">{value}</p>
                      </div>
                    </div>
                  </div>
                );

                return href ? (
                  <a
                    key={label}
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={label}>{content}</div>
                );
              })}
            </div>
          </section>

          <section className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="max-w-[860px]">
              <p className="ops-eyebrow">Operator Note</p>
              <p className="mt-4 text-[0.98rem] leading-8 text-[color:var(--muted-fg)]">{COMPANY_OPERATOR_NOTE}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-secondary">
                <ArrowLeft size={16} />
                Kembali ke login
              </Link>
              <Link href="/" className="btn btn-primary">
                Masuk ke aplikasi
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  Building2,
  Clock3,
  Eye,
  EyeOff,
  Globe2,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  MessageCircleMore,
  Phone,
  PlaneTakeoff,
  Radar,
  ScrollText,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const featureCards = [
  {
    icon: Radar,
    title: "AWB Tracking",
    copy: "Lookup status kiriman secara cepat dan jelas.",
  },
  {
    icon: PlaneTakeoff,
    title: "Flight Board",
    copy: "Pantau keberangkatan, cutoff, dan delay dalam satu tampilan.",
  },
  {
    icon: ScrollText,
    title: "Audit & Alerts",
    copy: "Lihat log aktivitas, notifikasi, dan exception state untuk kebutuhan pengawasan.",
  },
] as const;

const contactSections = [
  {
    title: "Office & Access",
    items: [
      {
        icon: Building2,
        label: "Office",
        value: "SkyHub Operations Center",
      },
      {
        icon: MapPin,
        label: "Address",
        value: "Jl. Kargo Internasional No. 12, Area Logistik Bandara, Jakarta 15126, Indonesia",
      },
      {
        icon: Clock3,
        label: "Working Hours",
        value: "Senin sampai Jumat, 08.00 sampai 20.00 WIB",
      },
      {
        icon: ShieldCheck,
        label: "Emergency Ops Line",
        value: "24 jam monitoring support",
      },
    ],
  },
  {
    title: "Direct Channels",
    items: [
      {
        icon: Mail,
        label: "General Email",
        value: "info@skyhub.co",
        href: "mailto:info@skyhub.co",
      },
      {
        icon: Mail,
        label: "Operations Email",
        value: "ops@skyhub.co",
        href: "mailto:ops@skyhub.co",
      },
      {
        icon: Mail,
        label: "Support Email",
        value: "support@skyhub.co",
        href: "mailto:support@skyhub.co",
      },
      {
        icon: Phone,
        label: "Phone",
        value: "+62 21 500 780",
        href: "tel:+6221500780",
      },
      {
        icon: Smartphone,
        label: "Mobile Ops",
        value: "+62 812 9000 1122",
        href: "tel:+6281290001122",
      },
      {
        icon: Globe2,
        label: "Website",
        value: "www.skyhub.co",
        href: "https://www.skyhub.co",
      },
    ],
  },
  {
    title: "Business Presence",
    items: [
      {
        icon: Instagram,
        label: "Instagram",
        value: "@skyhub.official",
        href: "https://instagram.com/skyhub.official",
      },
      {
        icon: Linkedin,
        label: "LinkedIn",
        value: "SkyHub Cargo Systems",
        href: "https://www.linkedin.com",
      },
      {
        icon: MessageCircleMore,
        label: "WhatsApp Business",
        value: "+62 812 9000 3344",
        href: "https://wa.me/6281290003344",
      },
    ],
  },
] as const;

const companyDetails = [
  {
    label: "Industry",
    value: "Air Cargo Operations and Digital Logistics",
  },
  {
    label: "Services",
    value: "AWB Tracking, Flight Board, Manifest Monitoring, Audit and Alerts",
  },
  {
    label: "Coverage",
    value: "Domestic and International Cargo Coordination",
  },
  {
    label: "Status",
    value: "Enterprise Cargo Operations Platform",
  },
] as const;

const demoCredentials = [
  "Operator: operator@skyhub.test / operator123",
  "Supervisor: supervisor@skyhub.test / operator123",
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("operator@skyhub.test");
  const [password, setPassword] = useState("operator123");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};

    if (!email.trim()) nextErrors.email = "Email wajib diisi.";
    if (!password.trim()) nextErrors.password = "Password wajib diisi.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember }),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setErrors({ form: payload.error || "Login gagal." });
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="light min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)] lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[448px_minmax(0,1fr)]">
        <section className="relative border-b border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.98))] lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_32%)]" />

          <div className="ops-scrollbar relative z-10 h-full overflow-y-auto px-6 py-8 lg:px-7 lg:py-8">
            <div className="mx-auto flex max-w-[392px] flex-col gap-5 pb-8">
              <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-4">
                  <BrandMark iconOnly tileClassName="h-[74px] w-[74px]" className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-primary-2)]">
                      Cargo Ops Control
                    </p>
                    <h1 className="mt-2 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                      SkyHub
                    </h1>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary-2)]">
                  Operator Login
                </p>
                <h2 className="mt-3 font-[family:var(--font-heading)] text-[2.2rem] font-black leading-[1.04] tracking-[-0.06em] text-[color:var(--text-strong)]">
                  Masuk ke ruang kendali
                </h2>
                <p className="mt-4 text-[0.95rem] leading-7 text-[color:var(--muted-fg)]">
                  SkyHub adalah platform operasional cargo udara yang membantu tim memantau shipment,
                  status penerbangan, manifest, dan aktivitas logistik secara lebih cepat, rapi, dan mudah dibaca.
                </p>

                <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input-field"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="operator@skyhub.test"
                    />
                    {errors.email ? (
                      <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.email}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <input
                        className="input-field input-field-trailing"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Masukkan password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-fg)]"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.password}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <label className="flex items-center gap-2 text-[color:var(--muted-fg)]">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                      />
                      Ingat saya
                    </label>
                    <button
                      type="button"
                      className="font-semibold text-[color:var(--brand-primary-2)]"
                    >
                      Lupa password
                    </button>
                  </div>

                  {errors.form ? (
                    <div className="rounded-[20px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm text-[color:var(--tone-warning)]">
                      {errors.form}
                    </div>
                  ) : null}

                  <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {submitting ? "Memproses..." : "Masuk ke Dashboard"}
                  </button>
                </form>

                <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                    Demo Access
                  </p>
                  <div className="mt-3 space-y-2">
                    {demoCredentials.map((item) => (
                      <p key={item} className="text-sm leading-6 text-[color:var(--text-strong)]">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary-2)]">
                  About SkyHub
                </p>
                <p className="mt-4 text-sm leading-7 text-[color:var(--muted-fg)]">
                  SkyHub menghadirkan sistem monitoring cargo udara yang berfokus pada kecepatan informasi,
                  keterbacaan tinggi, dan kendali operasional yang lebih presisi untuk kebutuhan bandara,
                  gudang, dan tim supervisor.
                </p>
              </div>

              <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary-2)]">
                  Contact Information
                </p>

                <div className="mt-5 space-y-5">
                  {contactSections.map((section) => (
                    <div
                      key={section.title}
                      className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                        {section.title}
                      </p>

                      <div className="mt-4 grid gap-3">
                        {section.items.map(({ icon: Icon, label, value, href }) => {
                          const content = (
                            <div className="flex items-start gap-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-3 transition-colors hover:bg-[color:var(--panel-muted)]">
                              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                                <Icon size={17} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                                  {label}
                                </span>
                                <span className="mt-1 block text-sm leading-6 text-[color:var(--text-strong)]">
                                  {value}
                                </span>
                              </span>
                            </div>
                          );

                          return href ? (
                            <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
                              {content}
                            </a>
                          ) : (
                            <div key={label}>{content}</div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary-2)]">
                  Company Details
                </p>

                <div className="mt-5 grid gap-3">
                  {companyDetails.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--text-strong)]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
                <p className="text-sm leading-7 text-[color:var(--muted-fg)]">
                  SkyHub dirancang untuk membantu operator bekerja lebih cepat, lebih tenang, dan lebih
                  presisi dalam satu sistem operasional yang stabil.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative hidden overflow-hidden lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=1800&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(132deg,rgba(15,23,42,0.94),rgba(30,64,175,0.84),rgba(37,99,235,0.42))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.38))]" />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between px-10 py-9 xl:px-12 xl:py-10">
            <div className="flex justify-end">
              <div className="w-full max-w-[320px] rounded-[28px] border border-white/14 bg-white/10 px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.2)] backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/72">
                  Shift Status
                </p>
                <p className="mt-2 font-[family:var(--font-heading)] text-[1.9rem] font-black tracking-[-0.05em] text-white">
                  Ready for Ops
                </p>
                <p className="mt-1 text-sm leading-6 text-white/78">
                  Manifest, flight board, dan AWB lookup tersedia.
                </p>
              </div>
            </div>

            <div className="max-w-[860px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                Enterprise Cargo Operations Portal
              </p>
              <h2 className="mt-5 max-w-[760px] font-[family:var(--font-heading)] text-[clamp(3rem,4.4vw,5rem)] font-black leading-[0.94] tracking-[-0.08em] text-white">
                Tracking kargo udara yang cepat, padat, dan tetap tenang dibaca.
              </h2>
              <p className="mt-6 max-w-[740px] text-[1.02rem] leading-8 text-white/80">
                SkyHub membantu operator memantau AWB, flight board, manifest, dan audit log dalam satu
                sistem yang stabil, rapi, dan siap digunakan sepanjang shift operasional.
              </p>

              <div className="mt-10 grid gap-4 xl:grid-cols-3">
                {featureCards.map(({ icon: Icon, title, copy }) => (
                  <div
                    key={title}
                    className="rounded-[28px] border border-white/14 bg-white/10 px-5 py-5 shadow-[0_20px_44px_rgba(15,23,42,0.16)] backdrop-blur-md"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/12 text-white">
                      <Icon size={20} />
                    </div>
                    <h3 className="mt-5 font-[family:var(--font-heading)] text-[1.55rem] font-extrabold tracking-[-0.05em] text-white">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-white/76">{copy}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 max-w-[780px] rounded-[30px] border border-white/14 bg-white/10 px-6 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white/12 text-white">
                    <BellRing size={18} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                      Operator Note
                    </p>
                    <p className="mt-2 text-sm leading-7 text-white/80">
                      Tampilan dibuat dengan fokus pada keterbacaan cepat, struktur yang stabil, dan
                      navigasi yang mudah dipahami untuk kebutuhan operasional harian.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

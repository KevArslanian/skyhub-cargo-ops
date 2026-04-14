"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MoonStar,
  PlaneTakeoff,
  Radar,
  ScrollText,
  SunMedium,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_CONTACT_TEASER,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
} from "@/lib/company-profile";
import { useTheme } from "next-themes";

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

const demoCredentials = [
  "Operator: operator@skyhub.test / operator123",
  "Supervisor: supervisor@skyhub.test / operator123",
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
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

  function handleThemeToggle() {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="login-shell">
        <section className="login-rail">
          <div className="login-rail-inner">
            <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-4">
                <BrandMark iconOnly tileClassName="h-[72px] w-[72px]" className="shrink-0" />
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
              <h2 className="mt-3 font-[family:var(--font-heading)] text-[2.1rem] font-black leading-[1.02] tracking-[-0.06em] text-[color:var(--text-strong)]">
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
          </div>
        </section>

        <section className="login-hero">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?auto=format&fit=crop&w=1800&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,64,175,0.82),rgba(37,99,235,0.42))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.36))]" />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />

          <div className="login-hero-scroll ops-scrollbar">
            <div className="login-hero-inner">
              <div className="login-hero-actions">
                <button
                  type="button"
                  onClick={handleThemeToggle}
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-[24px] border border-white/14 bg-white/10 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-md transition hover:-translate-y-[1px] hover:bg-white/12"
                >
                  {resolvedTheme === "dark" ? <SunMedium size={18} /> : <MoonStar size={18} />}
                  <span suppressHydrationWarning>{resolvedTheme === "dark" ? "Light" : "Dark"}</span>
                </button>
                <Link
                  href="/about-us"
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-[24px] border border-white/14 bg-white/10 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-md transition hover:-translate-y-[1px] hover:bg-white/12"
                >
                  <Info size={18} />
                  About Us
                </Link>

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

              <div className="login-hero-copy">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                  Enterprise Cargo Operations Portal
                </p>
                <h2 className="login-hero-title mt-5 font-[family:var(--font-heading)] font-black text-white">
                  {COMPANY_HERO_HEADLINE}
                </h2>
                <p className="mt-6 max-w-[760px] text-[1rem] leading-8 text-white/82">{COMPANY_HERO_COPY}</p>
              </div>

              <div className="login-feature-grid">
                {featureCards.map(({ icon: Icon, title, copy }) => (
                  <div
                    key={title}
                    className="login-feature-card rounded-[28px] border border-white/14 bg-white/10 px-5 py-5 shadow-[0_20px_44px_rgba(15,23,42,0.16)] backdrop-blur-md"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/12 text-white">
                      <Icon size={20} />
                    </div>
                    <h3 className="mt-5 font-[family:var(--font-heading)] text-[1.45rem] font-extrabold tracking-[-0.05em] text-white">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-white/78">{copy}</p>
                  </div>
                ))}
              </div>

              <div className="login-company-panel rounded-[32px] border border-white/14 bg-white/10 px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/68">
                      Company Profile
                    </p>
                    <h3 className="mt-3 font-[family:var(--font-heading)] text-[1.55rem] font-black tracking-[-0.05em] text-white">
                      SkyHub Cargo Systems
                    </h3>
                  </div>

                  <Link
                    href="/about-us"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] border border-white/16 bg-white/10 px-4 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:bg-white/12"
                  >
                    Lihat profil lengkap
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <p className="mt-5 max-w-[840px] text-sm leading-7 text-white/82">{COMPANY_ABOUT_COPY}</p>

                <div className="login-company-teaser-grid mt-6">
                  {COMPANY_CONTACT_TEASER.map(({ icon: Icon, label, value, href }) => {
                    const content = (
                      <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-4 transition hover:-translate-y-[1px] hover:bg-white/12">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/12 text-white">
                            <Icon size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/64">
                              {label}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-white/84">{value}</p>
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

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/12 pt-5">
                  <p className="max-w-[620px] text-sm leading-7 text-white/76">
                    Company profile lengkap, layanan, coverage, dan direktori contact tersedia di halaman terpisah
                    agar panel login tetap ringkas dan fokus pada akses operasional.
                  </p>
                  <Link
                    href="/about-us"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] border border-white/16 bg-white/10 px-4 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:bg-white/12"
                  >
                    Buka About Us
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

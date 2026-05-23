"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  PlaneTakeoff,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  getLoginErrorDetail,
  LOGIN_ERROR_CODES,
  type LoginErrorCode,
  type LoginResponse,
} from "@/lib/auth-login";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_CONTACT_ITEMS,
  COMPANY_HERO_COPY,
  COMPANY_SUPPORT_TIMELINE,
  COMPANY_SWIPE_CARDS,
} from "@/lib/company-profile";
import { APP_CANONICAL_URL } from "@/lib/constants";
import { cn } from "@/lib/format";

type CounterState = {
  shipments: number;
  flights: number;
  accuracy: number;
  uptime: number;
};

type LandingMetricsResponse = {
  shipmentsToday: number;
  activeFlights: number;
  onTimeAccuracy: number;
  platformUptime: number;
  generatedAt: string;
};

const capabilityCard = COMPANY_SWIPE_CARDS.find((card) => card.id === "fokus");
const CAPABILITIES = capabilityCard?.highlights?.slice(0, 3) ?? [
  {
    icon: PlaneTakeoff,
    title: "Live Flight Board",
    description: "Status flight, cutoff kargo, dan assignment terlihat dari sumber data operasional yang sama.",
  },
  {
    icon: FileCheck2,
    title: "AWB Intelligence",
    description: "Tracking AWB, dokumen, exception, dan status readiness tetap dekat ke konteks shipment.",
  },
  {
    icon: ShieldCheck,
    title: "Exception Command",
    description: "Hold, dokumen incomplete, dan alert operasional disatukan untuk respons cepat.",
  },
];

const OPERATIONS = COMPANY_SUPPORT_TIMELINE.map((item) => ({
  index: item.label,
  title: item.title,
  duration: item.label === "01" ? "Intake" : item.label === "02" ? "Manifest" : item.label === "03" ? "Monitor" : "Audit",
  copy: item.description,
}));

function getContact(label: string) {
  return COMPANY_CONTACT_ITEMS.find((item) => item.label === label);
}

const officeContact = getContact("Kantor");
const addressContact = getContact("Alamat");
const phoneContact = getContact("Telepon");
const opsEmailContact = getContact("Email operasional");
const infoEmailContact = getContact("Email umum");
const supportEmailContact = getContact("Email dukungan");
const hoursContact = getContact("Jam operasional");
const supportPathContact = getContact("Support path");

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">{label}</p>
      <p className="mt-2 font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
        {value}
      </p>
    </div>
  );
}

export default function AboutUsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("staff@skyhub.test");
  const [password, setPassword] = useState("operator123");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<{ code?: LoginErrorCode; message: string } | null>(null);
  const [contactState, setContactState] = useState({ name: "", email: "", message: "" });
  const [contactNotice, setContactNotice] = useState("");
  const [counter, setCounter] = useState<CounterState>({
    shipments: 0,
    flights: 0,
    accuracy: 0,
    uptime: 0,
  });

  const resolvedLoginError = useMemo(() => {
    if (!loginError) return null;
    return getLoginErrorDetail(loginError.code, loginError.message);
  }, [loginError]);

  const loadLandingMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/public/landing-metrics", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as LandingMetricsResponse;
      setCounter({
        shipments: Number(payload.shipmentsToday) || 0,
        flights: Number(payload.activeFlights) || 0,
        accuracy: Number(payload.onTimeAccuracy) || 0,
        uptime: Number(payload.platformUptime) || 0,
      });
    } catch {
      setCounter({ shipments: 0, flights: 0, accuracy: 0, uptime: 0 });
    }
  }, []);

  useEffect(() => {
    void loadLandingMetrics();
  }, [loadLandingMetrics]);

  useEffect(() => {
    if (!contactNotice) return undefined;
    const timer = window.setTimeout(() => setContactNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [contactNotice]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setLoginError({
        code: LOGIN_ERROR_CODES.INVALID_INPUT,
        message: "Email dan password wajib diisi.",
      });
      return;
    }

    setSubmitting(true);
    setLoginError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: true }),
      });

      const payload = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setLoginError({
          code: payload.code,
          message: payload.error || "Login gagal.",
        });
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setLoginError({
        code: LOGIN_ERROR_CODES.AUTH_UNAVAILABLE,
        message: "Tidak dapat menjangkau layanan login saat ini.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!contactState.name.trim() || !contactState.email.trim() || !contactState.message.trim()) {
      setContactNotice("Lengkapi nama, email, dan pesan terlebih dahulu.");
      return;
    }

    const subject = encodeURIComponent(`SkyHub Inquiry - ${contactState.name}`);
    const body = encodeURIComponent(
      `Name: ${contactState.name}\nEmail: ${contactState.email}\n\nMessage:\n${contactState.message}`,
    );

    window.location.href = `mailto:${opsEmailContact?.value ?? "ops@skyhub.co"}?subject=${subject}&body=${body}`;
    setContactNotice("Membuka email client...");
  }

  return (
    <main className="min-h-screen bg-[color:var(--app-bg)] px-4 py-4 text-[color:var(--app-fg)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        <header className="ops-panel flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <BrandMark />
          <nav className="flex flex-wrap items-center gap-2">
            <a href="#platform" className="topbar-button">
              Platform
            </a>
            <a href="#operations" className="topbar-button">
              Operasi
            </a>
            <a href="#contact" className="topbar-button">
              Kontak
            </a>
            <Link href="/login" className="btn btn-primary">
              <LockKeyhole size={16} />
              Login
            </Link>
          </nav>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          <div className="ops-panel p-5 sm:p-7">
            <p className="ops-eyebrow">SkyHub Cargo Ops</p>
            <h1 className="mt-3 max-w-4xl font-[family:var(--font-heading)] text-[clamp(2.25rem,5vw,4.8rem)] font-black leading-[0.98] tracking-[-0.05em] text-[color:var(--text-strong)]">
              Air cargo control, tanpa halaman hias yang memperlambat kerja.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[color:var(--muted-fg)] sm:text-lg">
              {COMPANY_HERO_COPY}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Shipment hari ini" value={Math.floor(counter.shipments).toLocaleString()} />
              <Metric label="Flight aktif" value={Math.floor(counter.flights).toLocaleString()} />
              <Metric label="Akurasi tepat waktu" value={`${counter.accuracy.toFixed(1)}%`} />
              <Metric label="Uptime platform" value={`${counter.uptime.toFixed(2)}%`} />
            </div>
          </div>

          <section className="ops-panel p-5 sm:p-6" aria-label="Login operator">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                <LockKeyhole size={18} />
              </span>
              <div>
                <h2 className="font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Masuk Operator
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Form langsung tersedia, tanpa popup.</p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  autoComplete="username"
                  className="input-field mt-2"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="staff@skyhub.test"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="input-field mt-2"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                />
              </div>

              {resolvedLoginError ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className={cn(
                    "rounded-[20px] border px-4 py-4",
                    "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <CircleAlert size={18} className="mt-0.5 shrink-0 text-[color:var(--tone-warning)]" />
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-strong)]">{resolvedLoginError.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{resolvedLoginError.message}</p>
                      {resolvedLoginError.note ? (
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted-fg)]">{resolvedLoginError.note}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                <ArrowRight size={18} />
                {submitting ? "Memproses..." : "Masuk ke dashboard"}
              </button>
            </form>
          </section>
        </section>

        <section id="platform" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="ops-panel p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--panel-muted)] text-[color:var(--brand-primary)]">
                <Building2 size={18} />
              </span>
              <div>
                <p className="ops-eyebrow">About Us</p>
                <h2 className="mt-1 font-[family:var(--font-heading)] text-3xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  {officeContact?.value ?? "SkyHub Operations Center"}
                </h2>
              </div>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[color:var(--muted-fg)] sm:text-base">
              <p>{COMPANY_ABOUT_COPY}</p>
              <p>
                Tampilan publik dibuat ringkas agar operator, staff, dan customer cepat menemukan login, kontak, dan
                konteks operasional tanpa melewati elemen visual yang tidak dibutuhkan.
              </p>
            </div>
          </div>

          <div className="ops-panel p-5 sm:p-6">
            <p className="ops-eyebrow">Kontak Operasional</p>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex gap-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-[color:var(--brand-primary)]" />
                <div>
                  <p className="font-semibold text-[color:var(--text-strong)]">{addressContact?.label ?? "Alamat"}</p>
                  <p className="mt-1 text-[color:var(--muted-fg)]">{addressContact?.value ?? "-"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Phone size={18} className="mt-0.5 shrink-0 text-[color:var(--brand-primary)]" />
                <div>
                  <p className="font-semibold text-[color:var(--text-strong)]">{phoneContact?.label ?? "Telepon"}</p>
                  <p className="mt-1 text-[color:var(--muted-fg)]">{phoneContact?.value ?? "-"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-[color:var(--brand-primary)]" />
                <div>
                  <p className="font-semibold text-[color:var(--text-strong)]">{opsEmailContact?.label ?? "Email operasional"}</p>
                  <p className="mt-1 text-[color:var(--muted-fg)]">{opsEmailContact?.value ?? "-"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-[color:var(--brand-primary)]" />
                <div>
                  <p className="font-semibold text-[color:var(--text-strong)]">{hoursContact?.label ?? "Jam operasional"}</p>
                  <p className="mt-1 text-[color:var(--muted-fg)]">
                    {hoursContact?.value ?? "-"}<br />
                    {supportPathContact?.value ?? "24 jam monitoring support untuk eskalasi operasional"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="operations" className="grid gap-5 xl:grid-cols-3">
          {CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="ops-panel p-5 sm:p-6">
                <Icon size={22} className="text-[color:var(--brand-primary)]" />
                <h3 className="mt-4 font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted-fg)]">{item.description}</p>
              </div>
            );
          })}
        </section>

        <section className="ops-panel p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Truck size={20} className="text-[color:var(--brand-primary)]" />
            <h2 className="font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
              Alur Kargo
            </h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {OPERATIONS.map((item) => (
              <div key={item.index} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">{item.index} / {item.duration}</p>
                <h3 className="mt-2 font-semibold text-[color:var(--text-strong)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
          <div className="ops-panel p-5 sm:p-6">
            <p className="ops-eyebrow">Kontak</p>
            <h2 className="mt-2 font-[family:var(--font-heading)] text-3xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
              Jalur komunikasi dibuat jelas.
            </h2>
            <div className="mt-5 space-y-4 text-sm">
              <p>
                <span className="font-semibold text-[color:var(--text-strong)]">{infoEmailContact?.label ?? "Email umum"}: </span>
                <a href={infoEmailContact?.href ?? "mailto:info@skyhub.co"} className="text-[color:var(--brand-primary)]">
                  {infoEmailContact?.value ?? "info@skyhub.co"}
                </a>
              </p>
              <p>
                <span className="font-semibold text-[color:var(--text-strong)]">{opsEmailContact?.label ?? "Email operasional"}: </span>
                <a href={opsEmailContact?.href ?? "mailto:ops@skyhub.co"} className="text-[color:var(--brand-primary)]">
                  {opsEmailContact?.value ?? "ops@skyhub.co"}
                </a>
              </p>
              <p>
                <span className="font-semibold text-[color:var(--text-strong)]">{supportEmailContact?.label ?? "Email dukungan"}: </span>
                <a href={supportEmailContact?.href ?? "mailto:support@skyhub.co"} className="text-[color:var(--brand-primary)]">
                  {supportEmailContact?.value ?? "support@skyhub.co"}
                </a>
              </p>
              <p>
                <span className="font-semibold text-[color:var(--text-strong)]">Link aplikasi: </span>
                <a href={APP_CANONICAL_URL} className="text-[color:var(--brand-primary)]">
                  {APP_CANONICAL_URL}
                </a>
              </p>
            </div>
          </div>

          <form className="ops-panel space-y-4 p-5 sm:p-6" onSubmit={handleContactSubmit}>
            <div>
              <label className="label">Nama</label>
              <input
                type="text"
                className="input-field mt-2"
                value={contactState.name}
                onChange={(event) => setContactState((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input-field mt-2"
                value={contactState.email}
                onChange={(event) => setContactState((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">Pesan</label>
              <textarea
                rows={5}
                className="input-field mt-2 min-h-32 py-3"
                value={contactState.message}
                onChange={(event) => setContactState((current) => ({ ...current, message: event.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              <Mail size={16} />
              Kirim lewat email
            </button>
            {contactNotice ? <p className="text-center text-sm text-[color:var(--brand-primary)]">{contactNotice}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}

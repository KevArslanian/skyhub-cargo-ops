"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Plane,
  Satellite,
  Shield,
  X,
} from "lucide-react";
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
  COMPANY_HERO_HEADLINE,
  COMPANY_SUPPORT_TIMELINE,
  COMPANY_SWIPE_CARDS,
} from "@/lib/company-profile";
import { APP_CANONICAL_URL, APP_NAME } from "@/lib/constants";

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
    icon: Satellite,
    title: "Live Flight Board",
    description: "Status flight, cutoff kargo, dan assignment terlihat dari sumber data operasional yang sama.",
  },
  {
    icon: Plane,
    title: "AWB Intelligence",
    description: "Tracking AWB, dokumen, exception, dan status readiness tetap dekat ke konteks shipment.",
  },
  {
    icon: Shield,
    title: "Exception Command",
    description: "Hold, dokumen incomplete, dan alert operasional disatukan untuk respons cepat.",
  },
];

const OPERATIONS = COMPANY_SUPPORT_TIMELINE.map((item) => ({
  index: item.label,
  title: item.title.toUpperCase(),
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

export default function AboutUsPage() {
  const router = useRouter();
  const plane1Ref = useRef<HTMLDivElement | null>(null);
  const plane2Ref = useRef<HTMLDivElement | null>(null);
  const plane3Ref = useRef<HTMLDivElement | null>(null);
  const hasAnimatedCountersRef = useRef(false);

  const [navSolid, setNavSolid] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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

  const startCounterAnimation = useCallback((target: CounterState) => {
    if (hasAnimatedCountersRef.current) {
      return;
    }

    hasAnimatedCountersRef.current = true;

    const duration = 1800;
    const startTime = performance.now();
    const safetyTimer = window.setTimeout(() => {
      setCounter(target);
    }, duration + 120);

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setCounter({
        shipments: target.shipments * progress,
        flights: target.flights * progress,
        accuracy: target.accuracy * progress,
        uptime: target.uptime * progress,
      });

      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      window.clearTimeout(safetyTimer);
    };

    window.requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("premium-scrollbar-hidden");
    document.body.classList.add("premium-scrollbar-hidden");
    return () => {
      document.documentElement.classList.remove("premium-scrollbar-hidden");
      document.body.classList.remove("premium-scrollbar-hidden");
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setNavSolid(currentY > 80);

      if (plane1Ref.current) plane1Ref.current.style.transform = `translateY(${currentY * 0.08}px)`;
      if (plane2Ref.current) plane2Ref.current.style.transform = `translateY(${currentY * 0.12}px)`;
      if (plane3Ref.current) plane3Ref.current.style.transform = `translateY(${currentY * 0.06}px)`;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>(".premium-reveal"));
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );

    for (const node of revealNodes) {
      revealObserver.observe(node);
    }

    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLandingMetrics() {
      try {
        const response = await fetch("/api/public/landing-metrics", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as LandingMetricsResponse;
        const target: CounterState = {
          shipments: Number(payload.shipmentsToday) || 0,
          flights: Number(payload.activeFlights) || 0,
          accuracy: Number(payload.onTimeAccuracy) || 0,
          uptime: Number(payload.platformUptime) || 0,
        };

        if (cancelled) {
          return;
        }
        startCounterAnimation(target);
      } catch {
        // Keep UI stable with zeroed counters when metrics endpoint is unavailable.
      }
    }

    void loadLandingMetrics();

    return () => {
      cancelled = true;
    };
  }, [startCounterAnimation]);

  useEffect(() => {
    if (!contactNotice) return undefined;
    const timer = window.setTimeout(() => setContactNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [contactNotice]);

  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

      setModalOpen(false);
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
    <div className="premium-landing bg-[#050505] text-white">
      <nav className={`premium-nav ${navSolid ? "premium-nav-solid" : ""}`} id="navbar">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6">
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => scrollToId("hero")}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0066ff66] bg-[#0066ff1a]">
              <Image
                src="/skyhub-logo-icon-clean.png"
                alt="SkyHub"
                width={34}
                height={34}
                className="premium-logo-plane"
              />
            </span>
            <span>
              <span className="block text-3xl font-semibold tracking-[-2px]">{APP_NAME.toUpperCase()}</span>
              <span className="mt-[-4px] block text-[10px] tracking-[3.5px] text-white/50">CARGO OPS</span>
            </span>
          </button>

          <div className="hidden items-center gap-9 text-sm font-medium md:flex">
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("overview")}>
              Overview
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("about")}>
              About Us
            </button>
            <button
              type="button"
              className="transition hover:text-[#0066ff]"
              onClick={() => scrollToId("capabilities")}
            >
              Capabilities
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("operations")}>
              Operations
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("contact")}>
              Contact
            </button>
          </div>
        </div>
      </nav>

      <section id="hero" className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <div id="overview" className="pointer-events-none absolute -top-16" />
        <div className="premium-animated-grid absolute inset-0" />

        <div className="pointer-events-none absolute right-12 top-16 hidden lg:block">
          <div className="relative h-40 w-40 rounded-full border border-[#00a3ff4d]">
            <div className="absolute inset-4 rounded-full border border-[#00a3ff33]" />
            <div className="absolute inset-8 rounded-full border border-[#00a3ff1a]" />
            <div className="premium-radar-sweep absolute inset-0 rounded-full border-t-2 border-[#00a3ff] [clip-path:polygon(50%_50%,100%_0,100%_100%)]" />
          </div>
        </div>

        <div ref={plane1Ref} className="premium-parallax-plane left-[12%] top-[22%] text-5xl">
          <Plane />
        </div>
        <div ref={plane2Ref} className="premium-parallax-plane left-[68%] top-[38%] text-4xl">
          <Plane />
        </div>
        <div ref={plane3Ref} className="premium-parallax-plane left-[25%] top-[58%] text-[42px]">
          <Plane />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-1 text-xs tracking-[3px]">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a3ff]" />
            LIVE • SOEDIRMAN CONTROL CENTER
          </div>

          <h1 className="mb-8 text-[64px] font-semibold leading-[0.92] tracking-[-0.05em] md:text-[92px]">
            {COMPANY_HERO_HEADLINE}
          </h1>

          <p className="mx-auto mb-12 max-w-3xl text-2xl text-white/70">{COMPANY_HERO_COPY}</p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="premium-magnetic-btn group flex h-16 items-center justify-center gap-3 rounded-3xl bg-white px-14 text-lg font-semibold text-black transition-all hover:bg-[#0066ff] hover:text-white"
            >
              LOGIN
              <ArrowRight className="transition group-hover:-rotate-45" />
            </button>
            <button
              type="button"
              onClick={() => scrollToId("about")}
              className="h-16 rounded-3xl border border-white/40 px-9 text-lg font-medium transition-all hover:bg-white/5"
            >
              Explore Platform
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl border-t border-white/10 px-6 py-24">
        <div className="grid items-center gap-16 md:grid-cols-2">
          <div className="premium-reveal">
            <div className="mb-4 text-xs tracking-[4px] text-[#0066ff]">OUR STORY</div>
            <h2 className="mb-8 text-6xl font-semibold leading-none tracking-tight">
              Built for those who
              <br />
              command the skies.
            </h2>

            <div className="space-y-6 text-lg text-white/70">
              <p>
                {COMPANY_ABOUT_COPY}
              </p>
              <p>
                Semua angka, kontak, capability, dan rhythm operasional di halaman ini memakai sumber profil yang sama
                dengan pusat laporan dan modul operasional, sehingga konteks yang dibaca asdos tetap konsisten.
              </p>
            </div>
          </div>

          <div className="premium-glass premium-reveal rounded-3xl border border-white/10 p-9">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066ff1a]">
                <Building2 className="text-[#0066ff]" size={30} />
              </div>
              <div>
                <div className="text-2xl font-semibold">{officeContact?.value ?? "SkyHub Operations Center"}</div>
                <div className="text-sm text-white/60">Jakarta, Indonesia</div>
              </div>
            </div>

            <div className="space-y-6 text-sm">
              <div className="flex gap-4">
                <div className="w-8 text-[#0066ff]">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="font-medium">{addressContact?.label ?? "Alamat"}</div>
                  <div className="text-white/70">{addressContact?.value ?? "-"}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 text-[#0066ff]">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="font-medium">{phoneContact?.label ?? "Telepon"}</div>
                  <div className="text-white/70">{phoneContact?.value ?? "-"}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 text-[#0066ff]">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="font-medium">{opsEmailContact?.label ?? "Email operasional"}</div>
                  <div className="text-white/70">{opsEmailContact?.value ?? "-"}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 text-[#0066ff]">
                  <Clock3 size={20} />
                </div>
                <div>
                  <div className="font-medium">{hoursContact?.label ?? "Jam operasional"}</div>
                  <div className="text-white/70">
                    {hoursContact?.value ?? "-"}
                    <br />
                    {supportPathContact?.value ?? "24 jam monitoring support untuk eskalasi operasional"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-y border-white/10 bg-black py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="premium-reveal mb-16 text-center">
            <div className="text-xs tracking-[4px] text-[#0066ff]">WHAT WE DELIVER</div>
            <h3 className="mt-4 text-6xl font-semibold tracking-tight">{capabilityCard?.title ?? "Capabilities that define the edge."}</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="premium-glass premium-tilt-card premium-reveal rounded-3xl p-9">
                  <div className="mb-8 text-[#0066ff]">
                    <Icon size={40} />
                  </div>
                  <h4 className="mb-4 text-3xl font-semibold">{item.title}</h4>
                  <p className="text-white/70">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="operations" className="mx-auto max-w-7xl px-6 py-24">
        <div className="premium-reveal mb-12">
          <div className="text-xs tracking-[4px] text-[#0066ff]">THE RHYTHM OF CARGO</div>
          <h3 className="mt-3 text-6xl font-semibold tracking-tight">Operations that never sleep.</h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {OPERATIONS.map((item) => (
            <div key={item.index} className="premium-glass premium-reveal rounded-3xl p-8">
              <div className="text-xs text-white/50">{item.index}</div>
              <div className="mb-2 mt-3 text-3xl font-semibold">{item.title}</div>
              <div className="text-sm text-[#00a3ff]">{item.duration}</div>
              <p className="mt-4 text-sm text-white/70">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="metrics" className="border-y border-white/10 bg-black py-20">
        <div className="premium-reveal mx-auto max-w-7xl px-6 text-center">
          <div className="text-xs tracking-[4px] text-[#0066ff]">PROVEN AT SCALE</div>
          <h3 className="mt-4 text-6xl font-semibold tracking-tight">Numbers that matter.</h3>
        </div>

        <div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-px px-6 sm:grid-cols-2 md:grid-cols-4">
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{Math.floor(counter.shipments).toLocaleString()}</div>
            <div className="mt-2 text-sm text-white/60">Shipments today</div>
          </div>
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{Math.floor(counter.flights).toLocaleString()}</div>
            <div className="mt-2 text-sm text-white/60">Active flights</div>
          </div>
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{counter.accuracy.toFixed(1)}</div>
            <div className="mt-2 text-sm text-white/60">On-time accuracy</div>
          </div>
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{counter.uptime.toFixed(2)}</div>
            <div className="mt-2 text-sm text-white/60">Platform uptime</div>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-16 md:grid-cols-2">
          <div className="premium-reveal">
            <div className="text-xs tracking-[4px] text-[#0066ff]">GET IN TOUCH</div>
            <h3 className="mb-8 mt-3 text-6xl font-semibold tracking-tight">
              Let&apos;s build the future of air cargo together.
            </h3>

            <div className="space-y-6 text-lg">
              <div>
                <div className="font-medium">{infoEmailContact?.label ?? "Email umum"}</div>
                <a href={infoEmailContact?.href ?? "mailto:info@skyhub.co"} className="text-[#0066ff]">
                  {infoEmailContact?.value ?? "info@skyhub.co"}
                </a>
              </div>
              <div>
                <div className="font-medium">{opsEmailContact?.label ?? "Email operasional"}</div>
                <a href={opsEmailContact?.href ?? "mailto:ops@skyhub.co"} className="text-[#0066ff]">
                  {opsEmailContact?.value ?? "ops@skyhub.co"}
                </a>
              </div>
              <div>
                <div className="font-medium">{supportEmailContact?.label ?? "Email dukungan"}</div>
                <a href={supportEmailContact?.href ?? "mailto:support@skyhub.co"} className="text-[#0066ff]">
                  {supportEmailContact?.value ?? "support@skyhub.co"}
                </a>
              </div>
              <div>
                <div className="font-medium">Link resmi aplikasi</div>
                <a href={APP_CANONICAL_URL} className="text-[#0066ff]">
                  {APP_CANONICAL_URL}
                </a>
              </div>
            </div>
          </div>

          <div className="premium-glass premium-reveal rounded-3xl border border-white/10 p-9">
            <form className="space-y-6" onSubmit={handleContactSubmit}>
              <div>
                <label className="text-xs tracking-widest text-white/60">YOUR NAME</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={contactState.name}
                  onChange={(event) => setContactState((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">EMAIL ADDRESS</label>
                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={contactState.email}
                  onChange={(event) => setContactState((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">MESSAGE</label>
                <textarea
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={contactState.message}
                  onChange={(event) => setContactState((current) => ({ ...current, message: event.target.value }))}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-white py-4 font-semibold text-black transition-all hover:bg-[#0066ff] hover:text-white"
              >
                SEND MESSAGE
              </button>
              {contactNotice ? <p className="text-center text-sm text-[#66a8ff]">{contactNotice}</p> : null}
            </form>
          </div>
        </div>
      </section>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="premium-glass relative w-full max-w-md rounded-3xl border border-white/20 p-9"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-6 top-6 text-white/60 transition hover:text-white"
              aria-label="Close login modal"
            >
              <X size={22} />
            </button>

            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0066ff66] bg-[#0066ff1a]">
                <Image
                  src="/skyhub-logo-icon-clean.png"
                  alt="SkyHub logo"
                  width={42}
                  height={42}
                  className="premium-logo-plane"
                />
              </div>
              <div className="text-3xl font-semibold">SkyHub Command</div>
              <div className="mt-1 text-sm text-white/50">Secure Operator Access</div>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-white/60">EMAIL</label>
                <input
                  type="email"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-white/60">PASSWORD</label>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {resolvedLoginError ? (
                <div className="rounded-2xl border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3">
                  <p className="text-sm font-semibold text-[color:var(--text-strong)]">{resolvedLoginError.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{resolvedLoginError.message}</p>
                  {resolvedLoginError.note ? (
                    <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{resolvedLoginError.note}</p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                className="mt-2 w-full rounded-2xl bg-white py-4 font-semibold text-black transition-all hover:bg-[#0066ff] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? "LOGGING IN..." : "LOGIN"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        html.premium-scrollbar-hidden,
        body.premium-scrollbar-hidden {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        html.premium-scrollbar-hidden::-webkit-scrollbar,
        body.premium-scrollbar-hidden::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>

      <style jsx>{`
        .premium-landing {
          min-height: 100vh;
          max-width: 100%;
          overflow-x: hidden;
          font-family: var(--font-body), "Inter", system-ui, sans-serif;
        }

        .premium-landing *,
        .premium-landing *::before,
        .premium-landing *::after {
          min-width: 0;
        }

        .premium-landing section,
        .premium-landing .premium-glass {
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .premium-landing h1,
        .premium-landing h2,
        .premium-landing h3,
        .premium-landing h4,
        .premium-landing p,
        .premium-landing button,
        .premium-landing a {
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .premium-nav {
          position: fixed;
          inset: 0 0 auto 0;
          z-index: 50;
          padding: 1.25rem 0;
          background: transparent;
          transition: all 0.25s ease;
        }

        .premium-nav-solid {
          background: rgba(5, 5, 5, 0.95);
          box-shadow: 0 18px 30px rgba(0, 0, 0, 0.24);
        }

        .premium-glass {
          background: rgba(10, 10, 12, 0.88);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .premium-reveal {
          opacity: 0;
          transform: translateY(50px);
          transition: all 0.9s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .premium-reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .premium-tilt-card {
          transition:
            transform 0.4s cubic-bezier(0.23, 1, 0.32, 1),
            box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .premium-tilt-card:hover {
          transform: perspective(1200px) rotateX(7deg) rotateY(10deg) scale(1.02);
          box-shadow: 0 40px 90px -25px rgba(0, 102, 255, 0.3);
        }

        .premium-magnetic-btn {
          position: relative;
          overflow: hidden;
        }

        .premium-magnetic-btn::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -100%;
          width: 50%;
          height: 200%;
          background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.5), transparent);
          transition: left 0.6s;
        }

        .premium-magnetic-btn:hover::after {
          left: 280%;
        }

        .premium-logo-plane {
          display: inline-block;
          animation: premium-logo-float 3.2s ease-in-out infinite;
        }

        .premium-animated-grid {
          background-image:
            linear-gradient(rgba(0, 102, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 102, 255, 0.04) 1px, transparent 1px);
          background-size: 42px 42px;
          animation: premium-grid-move 25s linear infinite;
        }

        .premium-radar-sweep {
          animation: premium-radar 4.5s linear infinite;
        }

        .premium-parallax-plane {
          position: absolute;
          color: #0066ff;
          filter: drop-shadow(0 0 18px #0066ff);
          transition: transform 0.1s ease-out;
          z-index: 1;
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .premium-nav {
            padding: 0.85rem 0;
          }

          .premium-landing h1 {
            font-size: 3.5rem;
            line-height: 0.92;
          }

          .premium-landing h2,
          .premium-landing h3 {
            font-size: 2.75rem;
            line-height: 1;
          }

          .premium-landing h4 {
            font-size: 1.65rem;
            line-height: 1.12;
          }

          .premium-landing .premium-glass {
            padding: 1.5rem;
          }

          .premium-magnetic-btn {
            padding-inline: 2rem;
          }
        }

        @keyframes premium-logo-float {
          0%,
          100% {
            transform: translateY(0) rotate(-7deg);
          }

          50% {
            transform: translateY(-5px) rotate(-4deg);
          }
        }

        @keyframes premium-grid-move {
          0% {
            background-position: 0 0;
          }

          100% {
            background-position: 42px 42px;
          }
        }

        @keyframes premium-radar {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .premium-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }

          .premium-tilt-card,
          .premium-magnetic-btn::after,
          .premium-logo-plane,
          .premium-animated-grid,
          .premium-radar-sweep {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

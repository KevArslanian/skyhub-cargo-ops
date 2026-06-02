"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Clock3,
  FileCheck2,
  LoaderCircle,
  Mail,
  MapPin,
  Package2,
  Phone,
  Plane,
  PlaneTakeoff,
  Radar,
  Satellite,
  Search,
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
import { APP_NAME, AWB_REGEX } from "@/lib/constants";
import { cn, formatDateTime, formatWeight } from "@/lib/format";
import { AboutScrollVideo, type AboutClip } from "@/components/about-scroll-video";
import { ScrollScene } from "@/components/about-scroll-scene";

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

type ComplaintFormState = {
  name: string;
  contact: string;
  topic: "shipment" | "flight" | "document" | "service" | "other";
  referenceNo: string;
  message: string;
};

type ComplaintFormErrors = Partial<Record<keyof ComplaintFormState, string>>;

type PublicTrackingLog = {
  id: string;
  label: string;
  status: string;
  message: string;
  location: string;
  actorName: string | null;
  createdAt: string;
};

type PublicTrackingShipment = {
  id: string;
  awb: string;
  commodity: string;
  origin: string;
  destination: string;
  status: string;
  statusLabel: string;
  shipper: string;
  consignee: string;
  pieces: number;
  weightKg: number;
  readiness: string;
  flightNumber: string | null;
  docStatus: string;
  updatedAt: string;
  trackingLogs: PublicTrackingLog[];
} | null;

const capabilityCard = COMPANY_SWIPE_CARDS.find((card) => card.id === "fokus");
const CAPABILITIES = capabilityCard?.highlights?.slice(0, 3) ?? [
  {
    icon: Satellite,
    title: "Management Pesawat Langsung",
    description: "Status penerbangan, batas terima kargo, dan penugasan terlihat dari sumber data operasional yang sama.",
  },
  {
    icon: Plane,
    title: "Intelijen AWB",
    description: "Pelacakan AWB, dokumen, masalah, dan status kesiapan tetap dekat ke konteks pengiriman.",
  },
  {
    icon: Shield,
    title: "Kendali Masalah",
    description: "Hold, dokumen belum lengkap, dan peringatan operasional disatukan untuk respons cepat.",
  },
];

const OPERATIONS = COMPANY_SUPPORT_TIMELINE.map((item) => ({
  index: item.label,
  title: item.title.toUpperCase(),
  duration: item.label === "01" ? "Penerimaan" : item.label === "02" ? "Manifest" : item.label === "03" ? "Pantau" : "Audit",
  copy: item.description,
}));

const ABOUT_CLIPS: AboutClip[] = [
  { src: "/media/about/sky-clouds.mp4", poster: "/media/about/sky-clouds.jpg", label: "Dalam perjalanan" },
  { src: "/media/about/takeoff-sunrise.mp4", poster: "/media/about/takeoff-sunrise.jpg", label: "Keberangkatan" },
  { src: "/media/about/data-network.mp4", poster: "/media/about/data-network.jpg", label: "Jaringan" },
  { src: "/media/about/city-aerial.mp4", poster: "/media/about/city-aerial.jpg", label: "Operasi darat" },
];

const ABOUT_SCRUB_VIDEO = {
  src: "/media/about/cargolux-sky-120fps-scrub.mp4",
  poster: "/media/about/cargolux-sky-120fps-scrub.jpg",
};

function getContact(label: string) {
  return COMPANY_CONTACT_ITEMS.find((item) => item.label === label);
}

const officeContact = getContact("Kantor");
const addressContact = getContact("Alamat");
const phoneContact = getContact("Telepon");
const opsEmailContact = getContact("Surel operasional");
const hoursContact = getContact("Jam operasional");
const supportPathContact = getContact("Jalur dukungan");

export default function AboutUsPage() {
  const router = useRouter();
  const hasAnimatedCountersRef = useRef(false);

  const [navSolid, setNavSolid] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("staff@skyhub.test");
  const [password, setPassword] = useState("operator123");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<{ code?: LoginErrorCode; message: string } | null>(null);
  const [complaintState, setComplaintState] = useState<ComplaintFormState>({ name: "", contact: "", topic: "shipment", referenceNo: "", message: "" });
  const [complaintErrors, setComplaintErrors] = useState<ComplaintFormErrors>({});
  const [complaintNotice, setComplaintNotice] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);
  const [trackingAwb, setTrackingAwb] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<PublicTrackingShipment>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
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
    document.documentElement.classList.add("premium-page-scroll");
    document.body.classList.add("premium-page-scroll");
    return () => {
      document.documentElement.classList.remove("premium-page-scroll");
      document.body.classList.remove("premium-page-scroll");
    };
  }, []);

  useEffect(() => {
    let clampFrame = 0;

    const clampContactTail = () => {
      if (clampFrame) {
        return;
      }

      clampFrame = window.requestAnimationFrame(() => {
        clampFrame = 0;

        const contact = document.getElementById("complaints");
        const contactGrid = document.querySelector<HTMLElement>(".premium-contact-grid");
        if (!contact || !contactGrid) {
          return;
        }

        const scrollMax = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        const contactTop = contact.getBoundingClientRect().top + window.scrollY;
        const contactContentBottom = contactGrid.getBoundingClientRect().bottom + window.scrollY;
        const contactTailLimit = Math.max(0, Math.min(scrollMax, contactContentBottom + 24 - window.innerHeight));
        const isPastContactStart = window.scrollY >= contactTop - window.innerHeight * 0.42;
        const isInFinalViewport = scrollMax - window.scrollY < window.innerHeight * 1.15;

        if (isPastContactStart && isInFinalViewport && window.scrollY > contactTailLimit) {
          window.scrollTo(0, contactTailLimit);
        }
      });
    };

    window.addEventListener("scroll", clampContactTail, { passive: true });
    window.addEventListener("resize", clampContactTail);
    clampContactTail();

    return () => {
      if (clampFrame) {
        window.cancelAnimationFrame(clampFrame);
      }
      window.removeEventListener("scroll", clampContactTail);
      window.removeEventListener("resize", clampContactTail);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setNavSolid(window.scrollY > 80);
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
    if (!complaintNotice) return undefined;
    const timer = window.setTimeout(() => setComplaintNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [complaintNotice]);

  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setLoginError({
        code: LOGIN_ERROR_CODES.INVALID_INPUT,
        message: "Surel dan kata sandi wajib diisi.",
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
          message: payload.error || "Masuk gagal.",
        });
        return;
      }

      setModalOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setLoginError({
        code: LOGIN_ERROR_CODES.AUTH_UNAVAILABLE,
        message: "Tidak dapat menjangkau layanan masuk saat ini.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function isValidContactInput(value: string) {
    const normalized = value.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    const phoneValid = /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(normalized.replace(/\s+/g, ""));
    return emailValid || phoneValid;
  }

  function validateComplaintForm(value: ComplaintFormState) {
    const errors: ComplaintFormErrors = {};

    if (!value.name.trim()) {
      errors.name = "Nama wajib diisi.";
    }

    if (!value.contact.trim()) {
      errors.contact = "Isi email atau nomor telepon.";
    } else if (!isValidContactInput(value.contact)) {
      errors.contact = "Gunakan email valid atau nomor Indonesia, contoh 08123456789.";
    }

    if (!value.message.trim()) {
      errors.message = "Uraian keluhan wajib diisi.";
    } else if (value.message.trim().length < 12) {
      errors.message = "Uraian keluhan minimal 12 karakter.";
    }

    return errors;
  }

  function updateComplaintField<K extends keyof ComplaintFormState>(field: K, nextValue: ComplaintFormState[K]) {
    setComplaintState((current) => ({ ...current, [field]: nextValue }));
    setComplaintErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleComplaintSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateComplaintForm(complaintState);
    if (Object.keys(errors).length > 0) {
      setComplaintErrors(errors);
      setComplaintNotice({
        tone: "error",
        message: "Periksa kembali field yang ditandai merah.",
      });
      return;
    }

    setComplaintErrors({});
    setComplaintNotice({ tone: "info", message: "Mengirim keluhan ke tim operasional..." });

    try {
      const response = await fetch("/api/public/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaintState),
      });
      const payload = (await response.json().catch(() => null)) as {
        complaint?: { ticketCode: string };
        error?: string;
      } | null;

      if (!response.ok) {
        setComplaintNotice({
          tone: "error",
          message: payload?.error || "Keluhan belum bisa dikirim. Coba lagi sebentar lagi.",
        });
        return;
      }

      const ticketCode = payload?.complaint?.ticketCode;
      setComplaintState({ name: "", contact: "", topic: "shipment", referenceNo: "", message: "" });
      setComplaintNotice({
        tone: "success",
        message: ticketCode
          ? `Keluhan diterima dengan nomor tiket ${ticketCode}. Tim operasional akan meninjaunya di Kotak Keluhan.`
          : "Keluhan diterima. Tim operasional akan meninjaunya di Kotak Keluhan.",
      });
    } catch {
      setComplaintNotice({
        tone: "error",
        message: "Koneksi terputus saat mengirim keluhan.",
      });
    }
  }

  async function handleTrackingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAwb = trackingAwb.trim();
    if (!AWB_REGEX.test(normalizedAwb)) {
      setTrackingResult(null);
      setTrackingError("Format resi harus XXX-XXXXXXXX.");
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);

    try {
      const response = await fetch(`/api/public/awb?awb=${encodeURIComponent(normalizedAwb)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { shipment?: PublicTrackingShipment; error?: string } | null;

      if (!response.ok) {
        setTrackingResult(null);
        setTrackingError(payload?.error || "Pelacakan resi belum bisa dimuat.");
        return;
      }

      if (!payload?.shipment) {
        setTrackingResult(null);
        setTrackingError("Resi belum ditemukan. Periksa nomor AWB lalu coba lagi.");
        return;
      }

      setTrackingResult(payload.shipment);
    } catch {
      setTrackingResult(null);
      setTrackingError("Koneksi terputus saat memuat pelacakan resi.");
    } finally {
      setTrackingLoading(false);
    }
  }

  return (
    <div className="premium-landing relative isolate bg-[#050505] text-white">
      <AboutScrollVideo clips={ABOUT_CLIPS} scrubVideo={ABOUT_SCRUB_VIDEO} />
      <div className="premium-top-blur" aria-hidden="true" />

      <nav className={`premium-nav ${navSolid ? "premium-nav-solid" : ""}`} id="navbar">
        <div className="premium-fluid-shell flex items-center justify-between">
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
              Ringkasan
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("tracking")}>
              Cek Resi
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("about")}>
              Tentang Kami
            </button>
            <button
              type="button"
              className="transition hover:text-[#0066ff]"
              onClick={() => scrollToId("capabilities")}
            >
              Kapabilitas
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("operations")}>
              Operasi
            </button>
            <button type="button" className="transition hover:text-[#0066ff]" onClick={() => scrollToId("complaints")}>
              Keluhan
            </button>
          </div>
        </div>
      </nav>

      <ScrollScene variant="heroOut" id="hero" data-video-clip="0" className="relative flex min-h-screen items-center overflow-x-clip overflow-y-visible pt-16">
        <div id="overview" className="pointer-events-none absolute -top-16" />
        <div className="premium-animated-grid pointer-events-none absolute inset-0 opacity-40" />

        <div className="premium-fluid-shell relative z-10 text-left">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-1 text-xs tracking-[3px]">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00a3ff]" />
            LIVE / PUSAT KONTROL SOEDIRMAN
          </div>

          <h1 className="mb-8 max-w-[1500px] text-[64px] font-semibold leading-[0.92] tracking-[-0.05em] md:text-[92px] 2xl:text-[112px]">
            {COMPANY_HERO_HEADLINE}
          </h1>

          <p className="mb-12 max-w-5xl text-2xl text-white/70">{COMPANY_HERO_COPY}</p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="premium-magnetic-btn group flex h-16 items-center justify-center gap-3 rounded-3xl bg-white px-14 text-lg font-semibold text-black transition-all hover:bg-[#0066ff] hover:text-white"
            >
              MASUK
              <ArrowRight className="transition group-hover:-rotate-45" />
            </button>
            <button
              type="button"
              onClick={() => scrollToId("about")}
              className="h-16 rounded-3xl border border-white/40 px-9 text-lg font-medium transition-all hover:bg-white/5"
            >
              Jelajahi Platform
            </button>
          </div>
        </div>
      </ScrollScene>

      <ScrollScene variant="left" id="tracking" data-video-clip="1" className="premium-fluid-shell border-t border-white/10 py-24">
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="premium-glass premium-reveal rounded-[32px] border border-white/10 p-8 sm:p-10">
            <div className="premium-kicker text-xs tracking-[4px]">CEK RESI LANGSUNG</div>
            <h2 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
              Pelanggan cukup datang, staff input shipment, resi langsung bisa dicek.
            </h2>
            <p className="mt-5 max-w-3xl text-lg text-white/68">
              Setelah shipment dibuat, resi langsung dicetak untuk pelanggan. Di halaman awal ini pelanggan tinggal masukkan AWB untuk memantau status terbaru tanpa login.
            </p>

            <form onSubmit={handleTrackingSubmit} className="mt-8 space-y-4">
              <label className="text-xs font-semibold tracking-[0.26em] text-white/58">NOMOR RESI / AWB</label>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px] md:items-start">
                <div className="min-w-0">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-white/42" />
                    <input
                      type="text"
                      value={trackingAwb}
                      onChange={(event) => setTrackingAwb(event.target.value)}
                      placeholder="Contoh: 123-45678901"
                      className="h-[62px] w-full rounded-[24px] border border-white/14 bg-white/[0.05] pl-14 pr-5 text-lg font-semibold text-white outline-none transition focus:border-[#0f7bff] focus:bg-white/[0.07]"
                    />
                  </div>
                  <p className="mt-3 text-sm text-white/48">Format resi: 3 digit - 8 digit. Contoh: 123-45678901.</p>
                  {trackingError ? <p className="mt-2 text-sm text-[#ff7b7d]">{trackingError}</p> : null}
                </div>
                <button
                  type="submit"
                  className="flex h-[62px] w-full items-center justify-center gap-3 rounded-[24px] bg-[#0f7bff] px-6 text-lg font-semibold text-white transition hover:bg-[#2c92ff] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={trackingLoading}
                >
                  {trackingLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Radar size={18} />}
                  Cek Resi
                </button>
              </div>
            </form>
          </div>

          <div className="premium-glass premium-reveal rounded-[32px] border border-white/10 p-8 sm:p-10">
            {trackingResult ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-white/48">STATUS RESI</p>
                    <h3 className="mt-3 font-mono text-3xl font-semibold tracking-[-0.03em] text-white">{trackingResult.awb}</h3>
                    <p className="mt-2 text-sm text-white/55">
                      {trackingResult.origin} {" -> "} {trackingResult.destination}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#0f7bff55] bg-[#0f7bff1f] px-4 py-2 text-sm font-semibold text-[#9fd1ff]">
                    {trackingResult.statusLabel}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3 text-[#9fd1ff]">
                      <Package2 size={18} />
                      <p className="text-xs font-semibold tracking-[0.18em] text-white/48">KARGO</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-white">{trackingResult.commodity}</p>
                    <p className="mt-1 text-sm text-white/55">{formatWeight(trackingResult.weightKg)} • {trackingResult.pieces} koli</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3 text-[#9fd1ff]">
                      <PlaneTakeoff size={18} />
                      <p className="text-xs font-semibold tracking-[0.18em] text-white/48">PENERBANGAN</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-white">{trackingResult.flightNumber || "Belum ditugaskan"}</p>
                    <p className="mt-1 text-sm text-white/55">Update {formatDateTime(trackingResult.updatedAt)}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3 text-[#9fd1ff]">
                      <FileCheck2 size={18} />
                      <p className="text-xs font-semibold tracking-[0.18em] text-white/48">DOKUMEN</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-white">{trackingResult.docStatus}</p>
                    <p className="mt-1 text-sm text-white/55">Kesiapan {trackingResult.readiness}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3 text-[#9fd1ff]">
                      <Plane size={18} />
                      <p className="text-xs font-semibold tracking-[0.18em] text-white/48">PENGIRIMAN</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-white">{trackingResult.shipper}</p>
                    <p className="mt-1 text-sm text-white/55">Penerima: {trackingResult.consignee}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold tracking-[0.24em] text-white/48">LINIMASA TERBARU</p>
                  <div className="mt-4 space-y-3">
                    {trackingResult.trackingLogs.length ? (
                      trackingResult.trackingLogs.slice(-3).reverse().map((log) => (
                        <div key={log.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{log.label}</p>
                              <p className="mt-1 text-sm text-white/58">{log.message}</p>
                            </div>
                            <p className="text-xs text-white/45">{formatDateTime(log.createdAt)}</p>
                          </div>
                          <p className="mt-3 text-xs text-white/45">{log.location} • {log.actorName || "Sistem"}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-white/14 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                        Belum ada event pelacakan yang bisa ditampilkan.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] px-8 py-10 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/[0.06] text-[#0f7bff]">
                  <Radar size={34} />
                </div>
                <h3 className="mt-8 text-3xl font-semibold tracking-tight text-white">Cek resi dari halaman awal</h3>
                <p className="mt-4 max-w-md text-base text-white/55">
                  Masukkan AWB di sisi kiri untuk melihat status, rute, dokumen, dan linimasa kiriman terbaru tanpa perlu login pelanggan.
                </p>
              </div>
            )}
          </div>
        </div>
      </ScrollScene>

      <ScrollScene variant="left" id="about" data-video-clip="1" className="premium-fluid-shell border-t border-white/10 py-24">
        <div className="premium-about-grid grid items-center gap-16">
          <div className="premium-reveal">
            <div className="premium-kicker mb-4 text-xs tracking-[4px]">CERITA KAMI</div>
            <h2 className="mb-8 text-6xl font-semibold leading-none tracking-tight">
              Dibangun untuk tim operasi{" "}
              <br />
              yang mengatur ritme udara.
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
                <div className="text-2xl font-semibold">{officeContact?.value ?? "Pusat Operasi SkyHub"}</div>
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
                  <div className="font-medium">{opsEmailContact?.label ?? "Surel operasional"}</div>
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
                    {supportPathContact?.value ?? "Monitoring dukungan 24 jam untuk eskalasi operasional"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollScene>

      <ScrollScene variant="depth" id="capabilities" data-video-clip="2" className="border-y border-white/10 bg-black/35 py-20">
        <div className="premium-fluid-shell">
          <div className="premium-reveal mb-16">
            <div className="premium-kicker text-xs tracking-[4px]">YANG KAMI SEDIAKAN</div>
            <h3 className="mt-4 text-6xl font-semibold tracking-tight">{capabilityCard?.title ?? "Kapabilitas yang menjaga operasi tetap tajam."}</h3>
          </div>

          <div className="premium-auto-grid grid gap-6">
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
      </ScrollScene>

      <ScrollScene variant="right" id="operations" data-video-clip="3" className="premium-fluid-shell py-24">
        <div className="premium-reveal mb-12">
          <div className="premium-kicker text-xs tracking-[4px]">RITME KARGO</div>
          <h3 className="mt-3 text-6xl font-semibold tracking-tight">Operasi yang terus terpantau.</h3>
        </div>

        <div className="premium-auto-grid premium-auto-grid-compact grid gap-6">
          {OPERATIONS.map((item) => (
            <div key={item.index} className="premium-glass premium-reveal rounded-3xl p-8">
              <div className="text-xs text-white/50">{item.index}</div>
              <div className="mb-2 mt-3 text-3xl font-semibold">{item.title}</div>
              <div className="premium-blue-note text-sm">{item.duration}</div>
              <p className="mt-4 text-sm text-white/70">{item.copy}</p>
            </div>
          ))}
        </div>
      </ScrollScene>

      <ScrollScene variant="depth" id="metrics" data-video-clip="2" className="border-y border-white/10 bg-black/35 py-20">
        <div className="premium-reveal premium-fluid-shell">
          <div className="premium-kicker text-xs tracking-[4px]">TERUKUR DI OPERASI</div>
          <h3 className="mt-4 text-6xl font-semibold tracking-tight">Angka yang perlu dipantau.</h3>
        </div>

        <div className="premium-fluid-shell mt-16 grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-4">
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{Math.floor(counter.shipments).toLocaleString()}</div>
            <div className="mt-2 text-sm text-white/60">Pengiriman hari ini</div>
          </div>
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{Math.floor(counter.flights).toLocaleString()}</div>
            <div className="mt-2 text-sm text-white/60">Penerbangan aktif</div>
          </div>
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{counter.accuracy.toFixed(1)}</div>
            <div className="mt-2 text-sm text-white/60">Akurasi tepat waktu</div>
          </div>
          <div className="premium-glass p-10 text-center">
            <div className="text-5xl font-semibold md:text-7xl">{counter.uptime.toFixed(2)}</div>
            <div className="mt-2 text-sm text-white/60">Waktu aktif platform</div>
          </div>
        </div>
      </ScrollScene>

      <ScrollScene revealOnce variant="left" id="complaints" data-video-clip="3" className="premium-fluid-shell pt-24 pb-8">
        <div className="premium-contact-grid grid gap-16">
          <div className="premium-reveal premium-complaint-intro">
            <div className="premium-kicker text-xs tracking-[4px]">KOTAK KELUHAN</div>
            <h3 className="premium-complaint-title mt-3 text-5xl font-semibold tracking-tight md:text-6xl">
              Laporkan kendala operasional ke tim SkyHub.
            </h3>

            <p className="premium-complaint-lead">
              Laporan masuk ke <strong>Kotak Keluhan</strong> di aplikasi operasional untuk ditinjau tim yang bertugas.
            </p>

            <div className="premium-complaint-checklist">
              <span className="premium-complaint-checklist-label">Siapkan</span>
              <ul>
                <li>Nama dan kontak aktif</li>
                <li>Topik: pengiriman, penerbangan, dokumen, atau layanan</li>
                <li>AWB atau referensi (jika ada)</li>
                <li>Uraian singkat kejadian</li>
              </ul>
            </div>

            <dl className="premium-complaint-meta">
              <div>
                <dt>{supportPathContact?.label ?? "Jalur dukungan"}</dt>
                <dd>{supportPathContact?.value ?? "Kotak Keluhan di aplikasi operasional"}</dd>
              </div>
              <div>
                <dt>{hoursContact?.label ?? "Jam operasional"}</dt>
                <dd>{hoursContact?.value ?? "Senin - Jumat, 08:00 - 17:00 WIB"}</dd>
              </div>
            </dl>
          </div>

          <div className="premium-glass premium-contact-form-card rounded-3xl border border-white/10 p-9">
            <form className="space-y-5" onSubmit={handleComplaintSubmit}>
              <div>
                <label className="text-xs tracking-widest text-white/60">NAMA ANDA</label>
                <input
                  type="text"
                  className={cn(
                    "mt-2 w-full rounded-2xl border bg-white/5 px-5 py-3.5 text-sm focus:outline-none",
                    complaintErrors.name
                      ? "border-[#ff4d4f] text-white focus:border-[#ff4d4f]"
                      : "border-white/20 focus:border-[#0066ff]",
                  )}
                  value={complaintState.name}
                  onChange={(event) => updateComplaintField("name", event.target.value)}
                />
                {complaintErrors.name ? <p className="mt-2 text-sm text-[#ff6b6d]">{complaintErrors.name}</p> : null}
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">EMAIL ATAU NOMOR TELEPON</label>
                <input
                  type="text"
                  inputMode="email"
                  className={cn(
                    "mt-2 w-full rounded-2xl border bg-white/5 px-5 py-3.5 text-sm focus:outline-none",
                    complaintErrors.contact
                      ? "border-[#ff4d4f] text-white focus:border-[#ff4d4f]"
                      : "border-white/20 focus:border-[#0066ff]",
                  )}
                  value={complaintState.contact}
                  onChange={(event) => updateComplaintField("contact", event.target.value)}
                />
                {complaintErrors.contact ? <p className="mt-2 text-sm text-[#ff6b6d]">{complaintErrors.contact}</p> : null}
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">TOPIK KELUHAN</label>
                <select
                  className={cn(
                    "mt-2 w-full rounded-2xl border bg-white/5 px-5 py-3.5 text-sm focus:outline-none",
                    complaintErrors.topic
                      ? "border-[#ff4d4f] text-white focus:border-[#ff4d4f]"
                      : "border-white/20 focus:border-[#0066ff]",
                  )}
                  value={complaintState.topic}
                  onChange={(event) => updateComplaintField("topic", event.target.value as ComplaintFormState["topic"])}
                >
                  <option value="shipment">Pengiriman / AWB</option>
                  <option value="flight">Penerbangan</option>
                  <option value="document">Dokumen</option>
                  <option value="service">Layanan</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">NOMOR AWB / REFERENSI (OPSIONAL)</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={complaintState.referenceNo}
                  onChange={(event) => updateComplaintField("referenceNo", event.target.value)}
                  placeholder="Contoh: CGK-12345678"
                />
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">URAIAN KELUHAN</label>
                <textarea
                  rows={4}
                  className={cn(
                    "mt-2 w-full rounded-2xl border bg-white/5 px-5 py-3.5 text-sm focus:outline-none",
                    complaintErrors.message
                      ? "border-[#ff4d4f] text-white focus:border-[#ff4d4f]"
                      : "border-white/20 focus:border-[#0066ff]",
                  )}
                  value={complaintState.message}
                  onChange={(event) => updateComplaintField("message", event.target.value)}
                />
                {complaintErrors.message ? <p className="mt-2 text-sm text-[#ff6b6d]">{complaintErrors.message}</p> : null}
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-white py-4 font-semibold text-black transition-all hover:bg-[#0066ff] hover:text-white"
              >
                KIRIM KELUHAN
              </button>
              {complaintNotice ? (
                <p
                  className={cn(
                    "text-center text-sm",
                    complaintNotice.tone === "error"
                      ? "text-[#ff6b6d]"
                      : complaintNotice.tone === "success"
                        ? "text-[#8dd0ff]"
                        : "text-[#66a8ff]",
                  )}
                >
                  {complaintNotice.message}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      </ScrollScene>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm sm:p-6"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="premium-glass premium-login-modal relative rounded-[28px] border border-white/15 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.58)] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Tutup modal masuk"
            >
              <X size={18} />
            </button>

            <div className="mb-7 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#0066ff66] bg-[#0066ff1a]">
                <Image
                  src="/skyhub-logo-icon-clean.png"
                  alt="SkyHub logo"
                  width={38}
                  height={38}
                  className="premium-logo-plane"
                />
              </div>
              <div className="text-[1.55rem] font-semibold leading-tight">Komando SkyHub</div>
              <div className="mt-1 text-sm text-white/50">Akses operator aman</div>
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-white/60">SUREL</label>
                <input
                  type="email"
                  className="h-12 w-full rounded-[18px] border border-white/15 bg-white/[0.06] px-4 text-sm text-white outline-none transition focus:border-[#0066ff] focus:bg-white/[0.08]"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs tracking-widest text-white/60">KATA SANDI</label>
                <input
                  type="password"
                  className="h-12 w-full rounded-[18px] border border-white/15 bg-white/[0.06] px-4 text-sm text-white outline-none transition focus:border-[#0066ff] focus:bg-white/[0.08]"
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
                className="mt-3 h-12 w-full rounded-[18px] bg-white font-semibold text-black transition-all hover:bg-[#0066ff] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? "MEMPROSES..." : "MASUK"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        html.premium-page-scroll {
          height: auto;
          min-height: 100%;
          overflow-x: clip;
          overflow-y: auto;
          scrollbar-gutter: auto;
          background: #050505 !important;
        }

        body.premium-page-scroll {
          height: auto;
          min-height: 100%;
          overflow: visible;
          background: #050505 !important;
        }

        body.premium-page-scroll::before {
          opacity: 0;
        }

        .premium-landing .premium-fluid-shell {
          width: min(100% - clamp(4rem, 8vw, 9rem), 1840px);
          margin-inline: auto;
        }

        @media (min-width: 1920px) {
          .premium-landing .premium-fluid-shell {
            width: min(100% - 8rem, 2040px);
          }
        }

        @media (max-width: 640px) {
          .premium-landing .premium-fluid-shell {
            width: min(100% - 1.75rem, 100%);
          }
        }
      `}</style>

      <style jsx>{`
        .premium-landing {
          min-height: 100vh;
          max-width: 100%;
          overflow-x: clip;
          overflow-y: visible;
          font-family: var(--font-body), "Inter", system-ui, sans-serif;
        }

        .premium-landing::before {
          content: "";
          position: fixed;
          inset: 0 0 auto;
          z-index: 55;
          height: clamp(7.5rem, 13vh, 10.75rem);
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(3, 5, 8, 0.96) 0%, rgba(3, 5, 8, 0.84) 50%, rgba(3, 5, 8, 0) 100%),
            linear-gradient(90deg, rgba(0, 102, 255, 0.12), rgba(0, 0, 0, 0) 42%);
          backdrop-filter: blur(22px) saturate(130%);
          -webkit-backdrop-filter: blur(22px) saturate(130%);
          mask-image: linear-gradient(180deg, #000 0%, #000 68%, transparent 100%);
        }

        .premium-top-blur {
          position: fixed;
          inset: 0 0 auto;
          z-index: 56;
          height: clamp(6.5rem, 11vh, 9rem);
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(2, 4, 7, 0.82) 0%, rgba(2, 4, 7, 0.54) 58%, rgba(2, 4, 7, 0) 100%),
            rgba(2, 4, 7, 0.28);
          backdrop-filter: blur(18px) saturate(135%);
          -webkit-backdrop-filter: blur(18px) saturate(135%);
          mask-image: linear-gradient(180deg, #000 0%, #000 72%, transparent 100%);
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

        .premium-landing > section {
          position: relative;
          z-index: 1;
          scroll-margin-top: 6.5rem;
        }

        .premium-landing > nav {
          position: fixed;
          z-index: 60;
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

        .premium-fluid-shell {
          width: min(100% - clamp(4rem, 8vw, 9rem), 1840px);
          margin-inline: auto;
        }

        .premium-about-grid {
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        }

        .premium-contact-grid {
          width: 100%;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
          align-items: start;
        }

        .premium-complaint-title {
          margin-bottom: clamp(1.25rem, 2.5vw, 1.75rem);
          max-width: 14ch;
          line-height: 1.05;
        }

        .premium-complaint-intro {
          display: flex;
          flex-direction: column;
          gap: clamp(1.25rem, 2.2vw, 1.75rem);
          max-width: 36rem;
        }

        .premium-complaint-lead {
          margin: 0;
          font-size: clamp(1rem, 1.05vw + 0.85rem, 1.125rem);
          line-height: 1.55;
          color: rgb(255 255 255 / 0.72);
        }

        .premium-complaint-lead strong {
          font-weight: 600;
          color: rgb(255 255 255 / 0.92);
        }

        .premium-complaint-checklist {
          padding: clamp(1rem, 1.5vw, 1.25rem) clamp(1.1rem, 1.8vw, 1.35rem);
          border-radius: 1.25rem;
          border: 1px solid rgb(255 255 255 / 0.1);
          background: rgb(255 255 255 / 0.04);
        }

        .premium-complaint-checklist-label {
          display: block;
          margin-bottom: 0.65rem;
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgb(255 255 255 / 0.5);
        }

        .premium-complaint-checklist ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 0.5rem;
        }

        .premium-complaint-checklist li {
          position: relative;
          padding-left: 1.15rem;
          font-size: 0.9375rem;
          line-height: 1.45;
          color: rgb(255 255 255 / 0.78);
        }

        .premium-complaint-checklist li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.55em;
          width: 0.35rem;
          height: 0.35rem;
          border-radius: 999px;
          background: rgb(0 102 255 / 0.85);
        }

        .premium-complaint-meta {
          margin: 0;
          display: grid;
          gap: 0.85rem;
          padding-top: 0.15rem;
        }

        .premium-complaint-meta div {
          display: grid;
          gap: 0.2rem;
        }

        .premium-complaint-meta dt {
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgb(255 255 255 / 0.45);
        }

        .premium-complaint-meta dd {
          margin: 0;
          font-size: 0.9375rem;
          line-height: 1.45;
          color: rgb(255 255 255 / 0.8);
        }

        :global(#complaints) {
          display: flex;
          align-items: flex-start;
          scroll-margin-top: 5.75rem;
        }

        .premium-contact-form-card {
          align-self: start;
          position: relative;
          z-index: 2;
        }

        .premium-auto-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
        }

        .premium-auto-grid-compact {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
        }

        .premium-nav {
          position: fixed;
          inset: 0 0 auto 0;
          z-index: 50;
          padding: 1.25rem 0;
          background: linear-gradient(180deg, rgba(3, 5, 8, 0.72), rgba(3, 5, 8, 0.34));
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(18px) saturate(132%);
          -webkit-backdrop-filter: blur(18px) saturate(132%);
          transition: all 0.25s ease;
        }

        .premium-nav-solid {
          background: rgba(5, 5, 5, 0.9);
          box-shadow: 0 18px 30px rgba(0, 0, 0, 0.24);
        }

        .premium-glass {
          background: rgba(8, 9, 12, 0.72);
          backdrop-filter: blur(26px) saturate(140%);
          -webkit-backdrop-filter: blur(26px) saturate(140%);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .premium-kicker,
        .premium-blue-note,
        .premium-link {
          color: #8bdcff;
          text-shadow: 0 0 22px rgba(0, 163, 255, 0.42);
        }

        .premium-kicker {
          font-weight: 800;
          letter-spacing: 0.34em;
        }

        .premium-blue-note,
        .premium-link {
          font-weight: 700;
        }

        .premium-link {
          text-decoration-color: rgba(139, 220, 255, 0.36);
          text-underline-offset: 0.18em;
        }

        .premium-link:hover {
          color: #c9f1ff;
        }

        .premium-login-modal {
          width: min(100%, 460px);
          max-width: min(460px, calc(100vw - 2rem)) !important;
          background:
            linear-gradient(180deg, rgba(16, 18, 22, 0.96), rgba(8, 9, 12, 0.98)),
            rgba(10, 10, 12, 0.96);
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

        @media (min-width: 1920px) {
          .premium-fluid-shell {
            width: min(100% - 8rem, 2040px);
          }

          .premium-about-grid,
          .premium-contact-grid {
            gap: 7rem;
          }
        }

        @media (max-width: 900px) {
          .premium-about-grid,
          .premium-contact-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 640px) {
          .premium-fluid-shell {
            width: min(100% - 1.75rem, 100%);
          }

          #hero {
            min-height: 100svh;
            padding-top: 5.75rem;
            padding-bottom: 2rem;
          }

          .premium-nav {
            padding: 0.85rem 0;
          }

          .premium-landing h1 {
            font-size: 3rem;
            line-height: 0.96;
          }

          #hero p {
            margin-bottom: 2rem;
            font-size: 1.125rem;
            line-height: 1.42;
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

          #hero .premium-magnetic-btn,
          #hero .premium-magnetic-btn + button {
            height: 3.5rem;
            border-radius: 1.25rem;
            font-size: 0.95rem;
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

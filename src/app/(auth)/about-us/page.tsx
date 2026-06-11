"use client";

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
} from "lucide-react";
import { getCargoIqMilestone } from "@/lib/constants";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_CONTACT_ITEMS,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
  COMPANY_SWIPE_CARDS,
} from "@/lib/company-profile";
import { PublicAwbPrefixInput } from "@/components/public-awb-prefix-input";
import { PublicTrackingCaptcha, usePublicTrackingCaptcha } from "@/components/public-tracking-captcha";
import { validateAwb, validateComplaintForm as validateComplaintFormClient } from "@/lib/client-validation";
import { APP_NAME, PUBLIC_AWB_PREFIX } from "@/lib/constants";
import {
  composePublicAwb,
  extractPublicAwbSuffix,
  sanitizeContactInput,
  sanitizePersonName,
  sanitizeReferenceInput,
} from "@/lib/input-guards";
import { GlassSelect } from "@/components/glass-select";
import { cn, formatDateTime, formatWeight } from "@/lib/format";
import {
  getCachedVideoSources,
  revokeAboutMediaBlobUrls,
  subscribeAboutMediaCache,
  warmAboutMediaCache,
  type AboutMediaCacheStatus,
} from "@/lib/about-media-cache";
import { ABOUT_SCRUB_VIDEO_SOURCES } from "@/lib/about-media-constants";
import { detectVideoPerfTier, SSR_VIDEO_PERF_TIER, type VideoPerfTier } from "@/lib/video-performance";
import { AboutScrollVideo, type AboutClip } from "@/components/about-scroll-video";
import { ScrollScene } from "@/components/about-scroll-scene";
import { SkyHubLogo } from "@/components/skyhub-logo";

type LandingMetricsState = {
  shipments: number;
  accuracy: number;
  generatedAt: string;
};

type LandingMetricsResponse = {
  shipmentsToday: number;
  onTimeAccuracy: number;
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
const CAPABILITIES = capabilityCard?.highlights ?? [
  {
    icon: Satellite,
    title: "Manajemen Pesawat Langsung",
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
    description: "Tertahan, dokumen belum lengkap, dan peringatan operasional disatukan untuk respons cepat.",
  },
];

const ABOUT_CLIPS: AboutClip[] = [
  { src: "/media/about/sky-clouds.mp4", poster: "/media/about/sky-clouds.jpg", label: "Dalam perjalanan" },
  { src: "/media/about/takeoff-sunrise.mp4", poster: "/media/about/takeoff-sunrise.jpg", label: "Keberangkatan" },
  { src: "/media/about/data-network.mp4", poster: "/media/about/data-network.jpg", label: "Jaringan" },
  { src: "/media/about/city-aerial.mp4", poster: "/media/about/city-aerial.jpg", label: "Operasi darat" },
];

const ABOUT_SCRUB_VIDEO = ABOUT_SCRUB_VIDEO_SOURCES;

type AboutSectionId = "overview" | "tracking" | "about" | "capabilities" | "complaints";

const COMPLAINTS_SCROLL_FOCUS = "#complaints-panels";

const ABOUT_NAV_ITEMS: { id: AboutSectionId; label: string }[] = [
  { id: "overview", label: "Ringkasan" },
  { id: "tracking", label: "Cek Resi" },
  { id: "about", label: "Tentang Kami" },
  { id: "capabilities", label: "Kapabilitas" },
  { id: "complaints", label: "Keluhan" },
];

function isAboutSectionId(value: string): value is AboutSectionId {
  return ABOUT_NAV_ITEMS.some((item) => item.id === value);
}

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

  const scrollLockRef = useRef(false);
  const activeSectionRef = useRef<AboutSectionId>("overview");

  const [navSolid, setNavSolid] = useState(false);
  const [activeSection, setActiveSection] = useState<AboutSectionId>("overview");
  const [complaintState, setComplaintState] = useState<ComplaintFormState>({ name: "", contact: "", topic: "shipment", referenceNo: "", message: "" });
  const [complaintErrors, setComplaintErrors] = useState<ComplaintFormErrors>({});
  const [complaintNotice, setComplaintNotice] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);
  const [trackingAwbSuffix, setTrackingAwbSuffix] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<PublicTrackingShipment>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [recentPublicSearches, setRecentPublicSearches] = useState<string[]>([]);
  const {
    challenge: trackingChallenge,
    answer: trackingCaptchaAnswer,
    loading: trackingCaptchaLoading,
    error: trackingCaptchaError,
    setAnswer: setTrackingCaptchaAnswer,
    refreshChallenge: refreshTrackingChallenge,
  } = usePublicTrackingCaptcha();

  useEffect(() => {
    try {
      const cached = localStorage.getItem("skyhub_public_searches");
      if (cached) {
        setRecentPublicSearches(JSON.parse(cached));
      }
    } catch {}
  }, []);
  const [landingMetrics, setLandingMetrics] = useState<LandingMetricsState | null>(null);
  const [videoTier, setVideoTier] = useState<VideoPerfTier>(SSR_VIDEO_PERF_TIER);
  const [mediaCacheStatus, setMediaCacheStatus] = useState<AboutMediaCacheStatus>("idle");
  const videoSources = useMemo(() => getCachedVideoSources(videoTier), [mediaCacheStatus, videoTier]);

  useEffect(() => {
    const tier = detectVideoPerfTier();
    setVideoTier(tier);
    void warmAboutMediaCache(tier);
    return subscribeAboutMediaCache(setMediaCacheStatus);
  }, []);

  useEffect(() => () => revokeAboutMediaBlobUrls(), []);

  const setActiveSectionMarker = useCallback((id: AboutSectionId) => {
    for (const item of ABOUT_NAV_ITEMS) {
      const section = document.getElementById(item.id);
      if (!section) {
        continue;
      }

      section.classList.toggle("is-active", item.id === id);
    }
  }, []);

  const revealSectionContent = useCallback((id: AboutSectionId) => {
    const section = document.getElementById(id);
    if (!section) {
      return;
    }

    setActiveSectionMarker(id);

    section.querySelectorAll<HTMLElement>(".premium-reveal").forEach((node) => {
      node.classList.add("visible");
    });
  }, [setActiveSectionMarker]);

  const scrollToSection = useCallback(
    (id: AboutSectionId, smooth = true) => {
      const section = document.getElementById(id);
      if (!section) {
        return;
      }

      scrollLockRef.current = true;
      activeSectionRef.current = id;
      setActiveSection(id);

      const navHeight = document.getElementById("navbar")?.offsetHeight ?? 96;
      const scrollAnchor =
        id === "complaints"
          ? section.querySelector<HTMLElement>(COMPLAINTS_SCROLL_FOCUS) ?? section
          : section;
      const anchorTop = scrollAnchor.getBoundingClientRect().top;
      const complaintsFocusGap = id === "complaints" ? 12 : 0;
      let targetTop =
        id === "overview"
          ? 0
          : Math.max(0, window.scrollY + anchorTop - navHeight - complaintsFocusGap);

      if (id === "complaints") {
        const maxScroll = Math.max(
          0,
          Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
        );
        targetTop = Math.min(targetTop, maxScroll);
      }

      window.scrollTo({
        top: targetTop,
        behavior: smooth ? "smooth" : "instant",
      });

      const nextHash = `#${id}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
      }

      revealSectionContent(id);

      window.setTimeout(() => {
        revealSectionContent(id);
        scrollLockRef.current = false;
      }, smooth ? 850 : 80);
    },
    [revealSectionContent],
  );

  useEffect(() => {
    document.documentElement.classList.add("premium-page-scroll");
    document.body.classList.add("premium-page-scroll");

    const nav = document.getElementById("navbar");
    const syncNavHeight = () => {
      const height = nav?.offsetHeight ?? 96;
      document.documentElement.style.setProperty("--about-nav-height", `${height}px`);
    };

    syncNavHeight();
    const resizeObserver = nav ? new ResizeObserver(syncNavHeight) : null;
    resizeObserver?.observe(nav!);
    window.addEventListener("resize", syncNavHeight);

    return () => {
      document.documentElement.classList.remove("premium-page-scroll");
      document.body.classList.remove("premium-page-scroll");
      document.documentElement.style.removeProperty("--about-nav-height");
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncNavHeight);
    };
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
      { threshold: 0.05, rootMargin: "0px 0px -8% 0px" },
    );

    for (const node of revealNodes) {
      revealObserver.observe(node);
    }

    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    const sections = ABOUT_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) {
      return undefined;
    }

    const navOffset = () => (document.getElementById("navbar")?.offsetHeight ?? 96) + 8;

    const syncActiveSectionFromScroll = () => {
      if (scrollLockRef.current) {
        return;
      }

      const anchor = navOffset();
      const viewportHeight = window.innerHeight - anchor;
      let current: AboutSectionId = "overview";
      let bestScore = -1;

      for (const item of ABOUT_NAV_ITEMS) {
        const section = document.getElementById(item.id);
        if (!section) {
          continue;
        }

        const rect = section.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, anchor);
        const visibleBottom = Math.min(rect.bottom, window.innerHeight);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const score = visibleHeight / Math.max(viewportHeight, 1);

        if (score > bestScore) {
          bestScore = score;
          current = item.id;
        }
      }

      if (current === activeSectionRef.current) {
        return;
      }

      activeSectionRef.current = current;
      setActiveSection(current);
      revealSectionContent(current);
      const nextHash = `#${current}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
      }
    };

    const handleScroll = () => {
      setNavSolid(window.scrollY > 80);
      syncActiveSectionFromScroll();
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    const hash = window.location.hash.replace(/^#/, "");
    if (isAboutSectionId(hash)) {
      window.requestAnimationFrame(() => scrollToSection(hash, false));
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [revealSectionContent, scrollToSection]);

  useEffect(() => {
    let cancelled = false;

    async function loadLandingMetrics() {
      try {
        const response = await fetch("/api/public/landing-metrics", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as LandingMetricsResponse;

        if (cancelled) {
          return;
        }

        setLandingMetrics({
          shipments: Number(payload.shipmentsToday) || 0,
          accuracy: Number(payload.onTimeAccuracy) || 0,
          generatedAt: payload.generatedAt,
        });
      } catch {
        // Hero chips stay in loading state when metrics endpoint is unavailable.
      }
    }

    void loadLandingMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!complaintNotice) return undefined;
    const timer = window.setTimeout(() => setComplaintNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [complaintNotice]);

  function navButtonClass(id: AboutSectionId) {
    const isActive = activeSection === id;
    return cn(
      "relative shrink-0 pb-1 transition",
      isActive ? "text-[#0066ff]" : "text-white/85 hover:text-[#0066ff]",
      isActive && "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#0066ff]",
    );
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

    const validation = validateComplaintFormClient(complaintState);
    if (!validation.ok) {
      const errors = validation.errors;
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

  const executeSearch = useCallback(
    async (suffixValue: string, challengeId: string, challengeAnswer: string) => {
      const normalizedAwb = composePublicAwb(suffixValue);
      const awbValidation = validateAwb(normalizedAwb);
      if (!awbValidation.ok) {
        setTrackingResult(null);
        setTrackingError(awbValidation.message || "Format resi tidak valid.");
        return;
      }

      if (!challengeId || !challengeAnswer.trim()) {
        setTrackingResult(null);
        setTrackingError("Selesaikan verifikasi robot sebelum mencari resi.");
        return;
      }

      setTrackingLoading(true);
      setTrackingError(null);

      try {
        const query = new URLSearchParams({
          awb: normalizedAwb,
          challengeId,
          challengeAnswer: challengeAnswer.trim(),
        });
        const response = await fetch(`/api/public/awb?${query.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { shipment?: PublicTrackingShipment; error?: string; code?: string }
          | null;

        if (!response.ok) {
          setTrackingResult(null);
          setTrackingError(payload?.error || "Pelacakan resi belum bisa dimuat.");
          if (payload?.code === "CAPTCHA_FAILED") {
            void refreshTrackingChallenge();
          }
          return;
        }

        if (!payload?.shipment) {
          setTrackingResult(null);
          setTrackingError("Resi belum ditemukan. Periksa nomor AWB lalu coba lagi.");
          void refreshTrackingChallenge();
          return;
        }

        setTrackingResult(payload.shipment);
        void refreshTrackingChallenge();

        setRecentPublicSearches((prev) => {
          const next = [normalizedAwb, ...prev.filter((item) => item !== normalizedAwb)].slice(0, 5);
          try {
            localStorage.setItem("skyhub_public_searches", JSON.stringify(next));
          } catch {}
          return next;
        });
      } catch {
        setTrackingResult(null);
        setTrackingError("Koneksi terputus saat memuat pelacakan resi.");
      } finally {
        setTrackingLoading(false);
      }
    },
    [refreshTrackingChallenge],
  );

  async function handleTrackingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trackingChallenge) {
      setTrackingError("Verifikasi robot belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    await executeSearch(trackingAwbSuffix, trackingChallenge.id, trackingCaptchaAnswer);
  }

  const trackingSubmitDisabled =
    trackingLoading ||
    trackingCaptchaLoading ||
    !trackingChallenge ||
    trackingAwbSuffix.length !== 8 ||
    !trackingCaptchaAnswer.trim();

  return (
    <div className="premium-landing relative isolate bg-[#050505] text-white">
      <AboutScrollVideo
        clips={ABOUT_CLIPS}
        scrubVideo={ABOUT_SCRUB_VIDEO}
        tier={videoTier}
        cacheStatus={mediaCacheStatus}
        videoSources={videoSources}
      />

      <nav className={`premium-nav ${navSolid ? "premium-nav-solid" : ""}`} id="navbar">
        <div className="premium-fluid-shell">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <button type="button" className="flex min-w-0 items-center gap-2 text-left sm:gap-3" onClick={() => scrollToSection("overview")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11">
                <SkyHubLogo className="h-9 w-9 sm:h-10 sm:w-10" title="SkyHub" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-semibold tracking-[-1px] sm:text-2xl md:text-3xl">
                  {APP_NAME.toUpperCase()}
                </span>
                <span className="mt-[-2px] block text-[9px] tracking-[3px] text-white/50 sm:text-[10px]">CARGO OPS</span>
              </span>
            </button>

            <div className="hidden shrink-0 items-center gap-7 text-sm font-medium lg:gap-9 md:flex">
              {ABOUT_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={navButtonClass(item.id)}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="premium-mobile-nav mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {ABOUT_NAV_ITEMS.map((item) => (
              <button
                key={`mobile-${item.id}`}
                type="button"
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition",
                  activeSection === item.id
                    ? "border-[#0066ff] bg-[#0066ff]/20 text-[#9fd1ff]"
                    : "border-white/15 bg-white/5 text-white/70",
                )}
                aria-current={activeSection === item.id ? "page" : undefined}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <ScrollScene variant="heroOut" id="overview" data-video-clip="0" className="about-section about-hero relative overflow-x-clip overflow-y-clip">
        <div className="about-hero-scrim pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" />
        <div className="premium-animated-grid pointer-events-none absolute inset-0 z-[2] opacity-[0.08]" />

        <div className="premium-fluid-shell about-hero-layout relative z-10">
          <div className="premium-content-panel premium-content-panel-lg about-hero-panel text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0066ff]/45 bg-[#0066ff]/16 px-5 py-1.5 text-xs font-semibold tracking-[0.2em] text-[#b8dcff]">
              <Building2 size={14} />
              PORTAL RESMI KARGO UDARA
            </div>

            <p className="mb-4 max-w-3xl text-sm font-medium leading-6 text-white/78">
              Pintu masuk publik untuk cek resi AWB. Area operator internal tersedia setelah autentikasi staf.
            </p>

            <h1 className="mb-8 max-w-[1200px] text-[48px] font-semibold leading-[1.02] tracking-[-0.04em] text-white md:text-[72px] 2xl:text-[84px]">
              {COMPANY_HERO_HEADLINE}
            </h1>

            <p className="premium-panel-copy mb-6 max-w-4xl text-lg md:text-xl">{COMPANY_HERO_COPY}</p>

            <div className="mb-8 flex flex-wrap items-center gap-2" aria-label="Ringkasan operasi aktif">
              <span className="rounded-full border border-[#0066ff]/40 bg-[#0066ff]/14 px-3 py-1.5 text-xs font-semibold text-[#b8dcff]">
                {landingMetrics
                  ? `${landingMetrics.shipments.toLocaleString("id-ID")} pengiriman aktif`
                  : "Memuat pengiriman aktif…"}
              </span>
              <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/88">
                {landingMetrics
                  ? `${landingMetrics.accuracy.toFixed(1)}% penerbangan tepat waktu`
                  : "Memuat ketepatan waktu…"}
              </span>
              {landingMetrics ? (
                <span className="text-xs text-white/55">
                  Diperbarui {formatDateTime(landingMetrics.generatedAt)}
                </span>
              ) : null}
            </div>

            <div className="about-portal-actions flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => scrollToSection("tracking")}
                className="premium-magnetic-btn group flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/28 bg-white/10 px-8 text-base font-semibold text-white transition-all hover:border-[#0066ff] hover:bg-[#0066ff]/20"
              >
                Cek Resi Publik
                <Radar size={18} />
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="premium-magnetic-btn group flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#0066ff] px-8 text-base font-semibold text-white transition-all hover:bg-[#2c92ff]"
              >
                Masuk Operator
                <ArrowRight className="transition group-hover:-rotate-45" size={18} />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("about")}
                className="h-14 rounded-2xl border border-white/22 bg-white/6 px-8 text-base font-medium text-white/88 transition-all hover:bg-white/10"
              >
                Tentang Sistem
              </button>
            </div>
          </div>
        </div>
      </ScrollScene>

      <ScrollScene variant="left" id="tracking" data-video-clip="1" className="about-section overflow-x-clip overflow-y-clip">
        <div className="premium-fluid-shell">
          <header className="premium-section-header premium-reveal mb-8 max-w-4xl">
            <div className="premium-kicker text-xs tracking-[4px]">CEK RESI LANGSUNG</div>
            <h2 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
              Pelanggan cukup datang, petugas input pengiriman, resi langsung bisa dicek.
            </h2>
            <p className="premium-section-lead mt-5 max-w-3xl text-lg">
              Setelah shipment dibuat, resi langsung dicetak untuk pelanggan. Di halaman awal ini pelanggan tinggal masukkan AWB untuk memantau status terbaru tanpa login.
            </p>
          </header>

          <div className="about-equal-columns premium-reveal">
            <div className="premium-content-panel premium-content-panel-lg about-equal-panel">
            <div className="about-equal-panel-body justify-center">
            <form onSubmit={handleTrackingSubmit} className="flex flex-1 flex-col justify-center space-y-4">
              <label htmlFor="public-awb-suffix" className="text-xs font-semibold tracking-[0.26em] text-white/58">
                NOMOR RESI / AWB
              </label>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px] md:items-start">
                <div className="min-w-0">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-5 top-1/2 z-[1] size-5 -translate-y-1/2 text-white/42" />
                    <PublicAwbPrefixInput value={trackingAwbSuffix} onChange={setTrackingAwbSuffix} disabled={trackingLoading} />
                  </div>
                  {trackingError ? <p className="mt-2 text-sm font-medium text-[#ff4d4f]">{trackingError}</p> : null}
                  <p className="mt-3 text-sm text-white/48">
                    Prefix {PUBLIC_AWB_PREFIX}- sudah terisi. Masukkan 8 digit sisanya, contoh: 10000001.
                  </p>
                  {recentPublicSearches.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-white/40">Pencarian terakhir:</span>
                      {recentPublicSearches.map((awb) => (
                        <button
                          key={awb}
                          type="button"
                          onClick={() => {
                            setTrackingAwbSuffix(extractPublicAwbSuffix(awb));
                            setTrackingError(null);
                          }}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#9fd1ff] transition hover:border-[#0f7bff] hover:bg-[#0f7bff]/10"
                        >
                          {awb}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="flex h-[62px] w-full items-center justify-center gap-3 rounded-[24px] bg-[#0f7bff] px-6 text-lg font-semibold text-white transition hover:bg-[#2c92ff] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={trackingSubmitDisabled}
                >
                  {trackingLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Radar size={18} />}
                  Cek Resi
                </button>
              </div>

              <PublicTrackingCaptcha
                challenge={trackingChallenge}
                answer={trackingCaptchaAnswer}
                loading={trackingCaptchaLoading}
                error={trackingCaptchaError}
                onAnswerChange={setTrackingCaptchaAnswer}
                onRefresh={() => void refreshTrackingChallenge()}
              />
            </form>
            </div>
          </div>

          <div className="premium-content-panel premium-content-panel-lg about-equal-panel">
            <div className="about-equal-panel-body">
            {trackingResult ? (
              <div className="about-tracking-result flex flex-1 flex-col space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.24em] text-white/48">STATUS RESI</p>
                    <h3 className="mt-3 font-mono text-3xl font-semibold tracking-[-0.03em] text-white">{trackingResult.awb}</h3>
                    <p className="mt-2 text-sm text-white/55">
                      {trackingResult.origin} {" -> "} {trackingResult.destination}
                    </p>
                  </div>
                  <span
                    className="rounded-full border px-4 py-2 text-sm font-semibold"
                    style={
                      trackingResult.status === "hold"
                        ? {
                            borderColor: "hsla(38, 92%, 50%, 0.45)",
                            backgroundColor: "hsla(38, 92%, 50%, 0.14)",
                            color: "hsl(38, 92%, 62%)",
                          }
                        : {
                            borderColor: "#0f7bff55",
                            backgroundColor: "#0f7bff1f",
                            color: "#9fd1ff",
                          }
                    }
                  >
                    {getCargoIqMilestone(trackingResult.status).code} · {trackingResult.statusLabel}
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
                  <p className="text-xs font-semibold tracking-[0.24em] text-white/48">LINIMASA CARGO IQ</p>
                  <p className="mt-1 text-xs text-white/42">Milestone standar IATA Cargo iQ ditampilkan berdampingan status operasional.</p>
                  <div className="mt-4 space-y-3">
                    {trackingResult.trackingLogs.length ? (
                      trackingResult.trackingLogs.slice(-3).reverse().map((log) => {
                        const milestone = getCargoIqMilestone(log.status);
                        return (
                        <div key={log.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold"
                                  style={
                                    log.status === "hold"
                                      ? {
                                          borderColor: "hsla(38, 92%, 50%, 0.4)",
                                          backgroundColor: "hsla(38, 92%, 50%, 0.12)",
                                          color: "hsl(38, 92%, 60%)",
                                        }
                                      : {
                                          borderColor: "#0f7bff44",
                                          backgroundColor: "#0f7bff14",
                                          color: "#9fd1ff",
                                        }
                                  }
                                >
                                  {milestone.code}
                                </span>
                                <p className="font-semibold text-white">{log.label}</p>
                              </div>
                              <p className="mt-1 text-xs text-white/50">{milestone.title}</p>
                              <p className="mt-1 text-sm text-white/58">{log.message}</p>
                            </div>
                            <p className="text-xs text-white/45">{formatDateTime(log.createdAt)}</p>
                          </div>
                          <p className="mt-3 text-xs text-white/45">{log.location} • {log.actorName || "Sistem"}</p>
                        </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-white/14 bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                        Belum ada event pelacakan yang bisa ditampilkan.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] px-8 py-10 text-center">
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
          </div>
        </div>
      </ScrollScene>

      <ScrollScene variant="left" id="about" data-video-clip="1" className="about-section overflow-x-clip overflow-y-clip">
        <div className="premium-fluid-shell">
          <header className="premium-section-header premium-reveal mb-8 max-w-5xl">
            <div className="premium-kicker text-xs tracking-[4px]">CERITA KAMI</div>
            <h2 className="mt-4 text-6xl font-semibold leading-none tracking-tight">
              Dibangun untuk tim operasi{" "}
              <br />
              yang mengatur ritme udara.
            </h2>
          </header>

          <div className="about-equal-columns premium-reveal">
            <div className="premium-content-panel premium-content-panel-md about-equal-panel order-2 lg:order-1">
              <div className="about-equal-panel-body">
                <div className="premium-panel-copy flex flex-1 flex-col justify-center space-y-6 text-lg">
                  <p>{COMPANY_ABOUT_COPY}</p>
                  <p>
                    Semua angka, kontak, capability, dan rhythm operasional di halaman ini memakai sumber profil yang sama
                    dengan pusat laporan dan modul operasional, sehingga konteks yang dibaca asdos tetap konsisten.
                  </p>
                </div>
              </div>
            </div>

          <div
            id="about-contact"
            data-section-focus="primary"
            className="premium-content-panel premium-content-panel-md about-equal-panel order-1 lg:order-2"
          >
            <div className="about-equal-panel-body">
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
          </div>
        </div>
      </ScrollScene>

      <ScrollScene variant="depth" id="capabilities" data-video-clip="2" className="about-section overflow-x-clip overflow-y-clip">
        <div className="premium-fluid-shell">
          <header
            id="capabilities-intro"
            data-section-focus="primary"
            className="premium-section-header premium-reveal mb-10 max-w-5xl"
          >
            <div className="premium-kicker text-xs tracking-[4px]">YANG KAMI SEDIAKAN</div>
            <h3 className="mt-4 text-6xl font-semibold tracking-tight">{capabilityCard?.title ?? "Kapabilitas yang menjaga operasi tetap tajam."}</h3>
          </header>

          <div className="premium-capabilities-grid premium-auto-grid grid gap-6">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="premium-content-panel premium-content-panel-md premium-tilt-card premium-reveal">
                  <div className="mb-8 text-[#0066ff]">
                    <Icon size={40} />
                  </div>
                  <h4 className="mb-4 text-3xl font-semibold">{item.title}</h4>
                  <p className="premium-panel-copy">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollScene>

      <ScrollScene revealOnce variant="left" id="complaints" data-video-clip="3" className="about-section overflow-x-clip overflow-y-clip">
        <div className="premium-fluid-shell">
          <header className="premium-section-header premium-reveal mb-8 max-w-4xl">
            <div className="premium-kicker text-xs tracking-[4px]">KOTAK KELUHAN</div>
            <h3 className="premium-complaint-title mt-3 text-5xl font-semibold tracking-tight md:text-6xl">
              Laporkan kendala operasional ke tim SkyHub.
            </h3>
            <p className="premium-complaint-lead mt-5">
              Laporan masuk ke <strong>Kotak Keluhan</strong> di aplikasi operasional untuk ditinjau tim yang bertugas.
            </p>
          </header>

          <div id="complaints-panels" className="about-equal-columns premium-reveal">
            <div className="premium-content-panel premium-content-panel-md about-equal-panel premium-complaint-intro">
              <div className="about-equal-panel-body">
                <div className="premium-complaint-checklist">
                  <span className="premium-complaint-checklist-label">Siapkan</span>
                  <ul>
                    <li>Nama dan kontak aktif</li>
                    <li>Topik: pengiriman, penerbangan, dokumen, atau layanan</li>
                    <li>AWB atau referensi (jika ada)</li>
                    <li>Uraian singkat kejadian</li>
                  </ul>
                </div>

                <dl className="premium-complaint-meta mt-auto">
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
            </div>

          <div className="premium-content-panel premium-content-panel-md about-equal-panel premium-contact-form-card">
            <div className="about-equal-panel-body">
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
                  onChange={(event) => updateComplaintField("name", sanitizePersonName(event.target.value))}
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
                  onChange={(event) => updateComplaintField("contact", sanitizeContactInput(event.target.value))}
                />
                {complaintErrors.contact ? <p className="mt-2 text-sm text-[#ff6b6d]">{complaintErrors.contact}</p> : null}
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">TOPIK KELUHAN</label>
                <GlassSelect
                  theme="premium"
                  className={cn(
                    "mt-2 w-full",
                    complaintErrors.topic && "border-[#ff4d4f] focus:border-[#ff4d4f]",
                  )}
                  aria-label="Topik keluhan"
                  value={complaintState.topic}
                  onChange={(nextValue) => updateComplaintField("topic", nextValue as ComplaintFormState["topic"])}
                  options={[
                    { value: "shipment", label: "Pengiriman / AWB" },
                    { value: "flight", label: "Penerbangan" },
                    { value: "document", label: "Dokumen" },
                    { value: "service", label: "Layanan" },
                    { value: "other", label: "Lainnya" },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs tracking-widest text-white/60">NOMOR AWB / REFERENSI (OPSIONAL)</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm focus:border-[#0066ff] focus:outline-none"
                  value={complaintState.referenceNo}
                  onChange={(event) =>
                    updateComplaintField("referenceNo", sanitizeReferenceInput(event.target.value, complaintState.topic))
                  }
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
          </div>
        </div>
      </ScrollScene>

      <div className="about-scroll-end-spacer" aria-hidden="true" />

      <style jsx global>{`
        html.premium-page-scroll {
          height: auto;
          min-height: 100%;
          overflow-x: clip;
          overflow-y: auto;
          scroll-padding-top: var(--about-nav-height, 6.5rem);
          scroll-snap-type: y proximity;
          scrollbar-gutter: auto;
          background: #050505 !important;
        }

        .premium-landing .about-section {
          scroll-margin-top: var(--about-nav-height, 6.5rem);
          scroll-snap-align: start;
          scroll-snap-stop: always;
        }

        .premium-landing .about-hero {
          display: flex;
          min-height: 100svh;
          min-height: 100dvh;
          flex-direction: column;
          justify-content: center;
          padding-top: calc(var(--about-nav-height, 6.5rem) + clamp(2.5rem, 7vh, 5rem));
          padding-bottom: clamp(3rem, 10vh, 6rem);
        }

        .premium-landing .about-hero-copy,
        .premium-landing .about-hero-layout {
          width: 100%;
        }

        .premium-landing .about-hero-scrim {
          background:
            linear-gradient(108deg, rgba(5, 8, 14, 0.94) 0%, rgba(5, 8, 14, 0.78) 38%, rgba(5, 8, 14, 0.28) 62%, rgba(5, 8, 14, 0.08) 100%);
        }

        .premium-landing .about-hero-panel {
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
        }

        .premium-landing .about-section:not(.about-hero) {
          position: relative;
          isolation: isolate;
          min-height: calc(100svh - var(--about-nav-height, 6.5rem));
          min-height: calc(100dvh - var(--about-nav-height, 6.5rem));
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding-block: clamp(3rem, 8vh, 5rem);
        }

        .premium-landing .about-section:not(.about-hero) > * {
          position: relative;
          z-index: 1;
        }

        .premium-mobile-nav {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .premium-mobile-nav::-webkit-scrollbar {
          display: none;
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

        .premium-landing *,
        .premium-landing *::before,
        .premium-landing *::after {
          min-width: 0;
        }

        .premium-landing section,
        .premium-landing .premium-content-panel,
        .premium-landing .premium-panel-solid,
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

        .premium-landing .about-section:not(.about-hero) h1,
        .premium-landing .about-section:not(.about-hero) h2,
        .premium-landing .about-section:not(.about-hero) h3,
        .premium-landing .about-section:not(.about-hero) h4,
        .premium-landing .premium-kicker {
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.55);
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

        .about-equal-columns {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: stretch;
          gap: clamp(1.5rem, 3vw, 2.5rem);
        }

        @media (min-width: 1024px) {
          .about-equal-columns {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: clamp(2rem, 4vw, 4rem);
          }
        }

        .about-equal-panel {
          height: 100%;
          min-height: clamp(22rem, 42vh, 28rem);
          display: flex;
          flex-direction: column;
        }

        .about-equal-panel-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .premium-complaint-title {
          margin-bottom: clamp(1.25rem, 2.5vw, 1.75rem);
          max-width: 14ch;
          line-height: 1.05;
        }

        .premium-complaint-intro .about-equal-panel-body {
          gap: clamp(1.25rem, 2.2vw, 1.75rem);
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
          border: 1px solid rgb(255 255 255 / 0.12);
          background: rgb(255 255 255 / 0.05);
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
          scroll-margin-top: var(--about-nav-height, 6.5rem);
          padding-top: clamp(2rem, 5vh, 3.5rem);
        }

        .about-scroll-end-spacer {
          height: calc(var(--about-nav-height, 6.5rem) + 4rem);
          pointer-events: none;
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
          background: rgba(8, 10, 18, 0.82);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
          transition:
            background 0.25s ease,
            border-color 0.25s ease,
            box-shadow 0.25s ease;
        }

        .premium-nav-solid {
          background: rgba(8, 10, 18, 0.92);
          border-bottom-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        }

        .premium-section-header {
          position: relative;
          z-index: 2;
        }

        .premium-section-lead {
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.55;
        }

        .premium-content-panel {
          background: linear-gradient(180deg, rgba(14, 16, 22, 0.98), rgba(8, 9, 12, 0.99));
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
        }

        .premium-content-panel-lg {
          border-radius: 2rem;
          padding: 2rem;
        }

        @media (min-width: 640px) {
          .premium-content-panel-lg {
            padding: 2.5rem;
          }
        }

        .premium-content-panel-md {
          border-radius: 1.5rem;
          padding: 1.75rem;
        }

        @media (min-width: 640px) {
          .premium-content-panel-md {
            padding: 2rem;
          }
        }

        #about-contact {
          scroll-margin-top: calc(var(--about-nav-height, 6.5rem) + 1rem);
          scroll-margin-bottom: 1.5rem;
        }

        .premium-panel-copy {
          color: rgba(255, 255, 255, 0.78);
          line-height: 1.6;
        }

        .premium-panel-solid {
          background: linear-gradient(180deg, rgba(14, 16, 22, 0.97), rgba(8, 9, 12, 0.99));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
        }

        .premium-glass {
          background: rgba(8, 9, 12, 0.78);
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

        .premium-reveal {
          opacity: 0;
          transform: translateY(50px);
          transition: all 0.9s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .premium-reveal.visible,
        .premium-landing .about-section.is-active .premium-reveal {
          opacity: 1;
          transform: translateY(0);
        }

        .about-tracking-result {
          animation: about-tracking-fade-in 0.55s cubic-bezier(0.23, 1, 0.32, 1) both;
        }

        @keyframes about-tracking-fade-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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

          .about-equal-columns {
            gap: 4rem;
          }
        }

        @media (max-width: 640px) {
          .premium-fluid-shell {
            width: min(100% - 1.75rem, 100%);
          }

          .premium-landing .about-hero {
            padding-top: calc(var(--about-nav-height, 7.5rem) + 1.75rem);
            padding-bottom: 2.5rem;
            justify-content: flex-start;
          }

          .premium-nav {
            padding: 0.85rem 0;
          }

          .premium-landing h1 {
            font-size: clamp(2.25rem, 9vw, 3rem);
            line-height: 0.96;
          }

          #overview p {
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

          .premium-landing .premium-content-panel-lg,
          .premium-landing .premium-content-panel-md,
          .premium-landing .premium-panel-solid,
          .premium-landing .premium-glass {
            padding: 1.5rem;
          }

          .premium-magnetic-btn {
            padding-inline: 2rem;
          }

          #overview .premium-magnetic-btn,
          #overview .premium-magnetic-btn + button {
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

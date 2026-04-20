"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Building2, LogIn, MoveRight, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { DataCard, OpsPanel, SectionHeader } from "@/components/ops-ui";
import { StatusBadge } from "@/components/status-badge";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_FACTS,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
  COMPANY_HERO_METRICS,
  COMPANY_HERO_PILLS,
  COMPANY_OPERATIONAL_PRINCIPLES,
  COMPANY_OPERATOR_NOTE,
  COMPANY_SUPPORT_SLA,
  COMPANY_SUPPORT_TIMELINE,
  COMPANY_SWIPE_CARDS,
} from "@/lib/company-profile";
import { cn } from "@/lib/format";

const revealTransition = {
  duration: 0.52,
  ease: [0.22, 1, 0.36, 1],
} as const;

export default function AboutUsPage() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    active: false,
    startX: 0,
    scrollLeft: 0,
  });
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  const activeCard = useMemo(() => COMPANY_SWIPE_CARDS[activeIndex] ?? COMPANY_SWIPE_CARDS[0], [activeIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;

    const updateActiveIndex = () => {
      const firstCard = track.querySelector<HTMLElement>("[data-card-index='0']");
      if (!firstCard) return;

      const cardWidth = firstCard.getBoundingClientRect().width;
      const gap = 16;
      const nextIndex = Math.round(track.scrollLeft / Math.max(cardWidth + gap, 1));
      setActiveIndex(Math.max(0, Math.min(COMPANY_SWIPE_CARDS.length - 1, nextIndex)));
    };

    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateActiveIndex);
    };

    updateActiveIndex();
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function scrollToCard(index: number) {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(`[data-card-index='${index}']`);
    if (!track || !card) return;

    card.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
    setActiveIndex(index);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const track = trackRef.current;
    if (!track) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      active: true,
      startX: event.clientX,
      scrollLeft: track.scrollLeft,
    };
    track.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track || !dragStateRef.current.active) return;
    const delta = event.clientX - dragStateRef.current.startX;
    track.scrollLeft = dragStateRef.current.scrollLeft - delta;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;

    if (dragStateRef.current.pointerId === event.pointerId && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current.active = false;
    setDragging(false);
  }

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div className="auth-atmosphere text-[color:var(--text-strong)]">
          <div className="auth-editorial-shell">
            <div className="auth-editorial-frame">
              <div className="auth-editorial-inner">
                <header className="relative flex flex-wrap items-center justify-between gap-4 rounded-[30px] border border-white/60 bg-white/55 px-4 py-4 backdrop-blur-md lg:px-5">
                  <BrandMark
                    className="gap-4"
                    tileClassName="h-14 w-14 rounded-[18px] border border-[#d5c9b7] bg-white/88 shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                    titleClassName="text-[1.2rem] text-[#10213d]"
                    subtitleClassName="text-[#667487]"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="auth-metric-pill">
                      <Sparkles size={14} className="text-[color:var(--brand-primary)]" />
                      Premium cargo control
                    </span>
                    <StatusBadge value="normal" label="Operasional normal" />
                    <form action="/api/auth/intro" method="POST">
                      <button type="submit" className="btn btn-primary">
                        <LogIn size={16} />
                        Lanjut ke Login
                      </button>
                    </form>
                  </div>
                </header>

                <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
                  <m.section
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={revealTransition}
                    className="min-w-0"
                  >
                    <div className="auth-soft-card p-6 lg:p-7">
                      <div className="flex flex-wrap items-center gap-3">
                        {COMPANY_HERO_PILLS.map((item) => (
                          <span
                            key={item}
                            className="auth-metric-pill text-[0.78rem] font-semibold text-[color:var(--muted-fg)]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <p className="ops-eyebrow mt-6">About SkyHub</p>
                      <h1 className="mt-4 font-[family:var(--font-editorial)] text-[clamp(3.2rem,6vw,5.8rem)] leading-[0.88] tracking-[-0.06em] text-[#10213d]">
                        {COMPANY_HERO_HEADLINE}
                      </h1>
                      <p className="mt-5 max-w-[640px] text-[1rem] leading-8 text-[color:var(--muted-fg)]">
                        {COMPANY_HERO_COPY}
                      </p>
                      <p className="mt-4 max-w-[640px] text-[1rem] leading-8 text-[color:var(--muted-fg)]">
                        {COMPANY_ABOUT_COPY}
                      </p>

                      <div className="mt-6 grid gap-3 md:grid-cols-3">
                        {COMPANY_HERO_METRICS.map((metric) => (
                          <DataCard key={metric.label} label={metric.label} value={metric.value} tone="primary" className="h-full" />
                        ))}
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <form action="/api/auth/intro" method="POST">
                          <button type="submit" className="btn btn-primary">
                            <MoveRight size={16} />
                            Masuk ke Access Portal
                          </button>
                        </form>
                        <span className="inline-flex min-h-[46px] items-center rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 text-sm font-semibold text-[color:var(--muted-fg)]">
                          Deck di bawah bisa digeser manual dengan touch, drag mouse, arrows, atau dots.
                        </span>
                      </div>
                    </div>
                  </m.section>

                  <m.section
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...revealTransition, delay: 0.06 }}
                  >
                    <div className="auth-stage-panel">
                      <div className="about-stage-media">
                        <AnimatePresence mode="wait">
                          <m.div
                            key={activeCard.id}
                            initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.02 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0"
                          >
                            <Image
                              src={activeCard.artworkSrc}
                              alt={activeCard.artworkAlt}
                              fill
                              priority
                              sizes="(max-width: 1279px) 100vw, 52vw"
                              className="object-cover"
                            />
                            <div className="about-stage-overlay" />
                          </m.div>
                        </AnimatePresence>

                        <div className="relative flex h-full flex-col justify-between p-6 text-white lg:p-7">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="auth-floating-chip border-white/18 bg-white/10 text-white/82">
                              <Building2 size={15} />
                              {activeCard.stageEyebrow}
                            </span>
                            <span className="auth-floating-chip border-white/16 bg-black/10 text-white/74">
                              {activeIndex + 1} / {COMPANY_SWIPE_CARDS.length}
                            </span>
                          </div>

                          <div className="max-w-[620px]">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/66">
                              {activeCard.label}
                            </p>
                            <h2 className="mt-4 font-[family:var(--font-editorial)] text-[clamp(2.4rem,4.2vw,4.3rem)] leading-[0.9] tracking-[-0.05em] text-[#fff5e7]">
                              {activeCard.stageLabel}
                            </h2>
                            <p className="mt-4 max-w-[520px] text-sm leading-7 text-white/78">
                              {activeCard.stageNote}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            {activeCard.sceneFacts.map((fact) => (
                              <div
                                key={`${activeCard.id}-${fact.label}`}
                                className="rounded-[22px] border border-white/16 bg-black/12 px-4 py-4 backdrop-blur-sm"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
                                  {fact.label}
                                </p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-white/86">{fact.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </m.section>
                </div>

                <m.section
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...revealTransition, delay: 0.1 }}
                  className="mt-6"
                >
                  <div className="auth-soft-card px-5 py-5 lg:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="ops-eyebrow">Swipeable Company Deck</p>
                        <h2 className="mt-3 font-[family:var(--font-heading)] text-[1.85rem] font-extrabold tracking-[-0.04em] text-[color:var(--text-strong)]">
                          Runway informasi yang tetap manual, presisi, dan enak dipindai.
                        </h2>
                        <p className="mt-3 max-w-[760px] text-sm leading-7 text-[color:var(--muted-fg)]">
                          Card aktif dibuat dominan, card berikutnya sengaja mengintip di sisi kanan, dan semua perpindahan tetap di bawah kontrol user.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="auth-metric-pill">
                          {activeIndex + 1}/{COMPANY_SWIPE_CARDS.length}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="topbar-button"
                            onClick={() => scrollToCard(Math.max(activeIndex - 1, 0))}
                            disabled={activeIndex === 0}
                            aria-label="Card sebelumnya"
                          >
                            <ArrowLeft size={16} />
                          </button>
                          <button
                            type="button"
                            className="topbar-button"
                            onClick={() => scrollToCard(Math.min(activeIndex + 1, COMPANY_SWIPE_CARDS.length - 1))}
                            disabled={activeIndex === COMPANY_SWIPE_CARDS.length - 1}
                            aria-label="Card berikutnya"
                          >
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="about-runway-line mt-6">
                      <div
                        ref={trackRef}
                        className={cn("ops-snap-track pb-2", dragging ? "cursor-grabbing" : "cursor-grab")}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                      >
                        {COMPANY_SWIPE_CARDS.map((card, index) => (
                          <article
                            key={card.id}
                            data-card-index={index}
                            data-active={activeIndex === index}
                            className="ops-panel ops-snap-card about-snap-card min-h-[560px] shrink-0 p-5 lg:p-6"
                          >
                            <div className="flex h-full flex-col">
                              <div className="about-card-media">
                                <Image src={card.artworkSrc} alt={card.artworkAlt} fill sizes="(max-width: 1024px) 88vw, 680px" className="object-cover" />
                              </div>

                              <div className="mt-5 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-2)]">
                                    {card.label}
                                  </p>
                                  <h3 className="mt-3 font-[family:var(--font-heading)] text-[1.5rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-[color:var(--text-strong)]">
                                    {card.title}
                                  </h3>
                                </div>
                                <StatusBadge value={activeIndex === index ? "live" : "info"} label={activeIndex === index ? "Aktif" : `Card ${index + 1}`} />
                              </div>

                              <p className="mt-4 text-sm leading-7 text-[color:var(--muted-fg)]">{card.description}</p>

                              {card.chips?.length ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {card.chips.map((chip) => (
                                    <span
                                      key={chip}
                                      className="inline-flex min-h-[36px] items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 text-sm font-semibold text-[color:var(--text-strong)]"
                                    >
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              {card.highlights?.length ? (
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                  {card.highlights.map((item) => (
                                    <div key={item.title} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                                      <div className="flex items-start gap-3">
                                        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                                          <item.icon size={18} />
                                        </span>
                                        <div>
                                          <p className="font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{item.description}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              {card.metrics?.length ? (
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                  {card.metrics.map((metric) => (
                                    <DataCard key={`${card.id}-${metric.label}`} label={metric.label} value={metric.value} className="h-full" />
                                  ))}
                                </div>
                              ) : null}

                              {card.contacts?.length ? (
                                <div className="mt-5 grid gap-3 md:grid-cols-2">
                                  {card.contacts.map((item) => {
                                    const content = (
                                      <div className="flex items-start gap-3">
                                        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                                          <item.icon size={17} />
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                                            {item.label}
                                          </p>
                                          <p className="mt-2 text-sm leading-6 text-[color:var(--text-strong)]">{item.value}</p>
                                        </div>
                                      </div>
                                    );

                                    return item.href ? (
                                      <a
                                        key={`${card.id}-${item.label}`}
                                        href={item.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 transition-colors hover:bg-[color:var(--brand-primary-soft)]"
                                      >
                                        {content}
                                      </a>
                                    ) : (
                                      <div
                                        key={`${card.id}-${item.label}`}
                                        className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4"
                                      >
                                        {content}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {card.note ? (
                                <div className="mt-auto border-t border-[color:var(--border-soft)] pt-5 text-sm leading-7 text-[color:var(--muted-fg)]">
                                  {card.note}
                                </div>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[color:var(--text-strong)]">{activeCard.label}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                          Swipe, drag, arrows, dan dots semuanya tersedia. Tidak ada autoplay atau perpindahan yang diambil alih sistem.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {COMPANY_SWIPE_CARDS.map((card, index) => (
                          <button
                            key={card.id}
                            type="button"
                            className={cn("ops-snap-dot", activeIndex === index && "ops-snap-dot-active")}
                            onClick={() => scrollToCard(index)}
                            aria-label={`Buka card ${index + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </m.section>

                <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <m.section
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...revealTransition, delay: 0.14 }}
                  >
                    <OpsPanel className="p-6">
                      <SectionHeader
                        title="Catatan Operasional"
                        subtitle="Area yang dulu terasa kosong kini menjadi panel konteks yang benar-benar membantu membaca karakter kerja produk."
                      />
                      <p className="mt-5 text-[0.98rem] leading-8 text-[color:var(--muted-fg)]">{COMPANY_OPERATOR_NOTE}</p>

                      <div className="mt-6 grid gap-3 md:grid-cols-2">
                        {COMPANY_OPERATIONAL_PRINCIPLES.map((item) => (
                          <div key={item.title} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                                <item.icon size={18} />
                              </span>
                              <div>
                                <p className="font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{item.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                        <p className="label">Operating Timeline</p>
                        <div className="mt-4 space-y-3">
                          {COMPANY_SUPPORT_TIMELINE.map((item) => (
                            <div key={item.label} className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4">
                              <div className="flex items-start gap-4">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary-soft)] font-semibold text-[color:var(--brand-primary)]">
                                  {item.label}
                                </span>
                                <div>
                                  <p className="font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{item.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </OpsPanel>
                  </m.section>

                  <m.section
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...revealTransition, delay: 0.18 }}
                    className="grid gap-5"
                  >
                    <OpsPanel className="p-6">
                      <SectionHeader
                        title="SLA Support"
                        subtitle="Quality signals disajikan singkat agar cepat dipindai sebagai indikator kesiapan support."
                      />
                      <div className="mt-5 space-y-3">
                        {COMPANY_SUPPORT_SLA.map((item) => (
                          <DataCard key={item.label} label={item.label} value={item.value} tone="success" />
                        ))}
                      </div>
                    </OpsPanel>

                    <OpsPanel className="p-6">
                      <SectionHeader
                        title="Fakta Perusahaan"
                        subtitle="Legal, scope, dan positioning dirangkum sebagai modular facts panel, bukan daftar kecil bertumpuk."
                      />
                      <div className="mt-5 space-y-3">
                        {COMPANY_FACTS.map((item) => (
                          <div key={item.label} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                              {item.label}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-[color:var(--text-strong)]">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 rounded-[22px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(0,82,204,0.08),rgba(255,255,255,0.96))] px-4 py-4">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[color:var(--brand-primary)] text-white">
                            <ShieldCheck size={18} />
                          </span>
                          <div>
                            <p className="font-semibold text-[color:var(--text-strong)]">Akses lanjut ke ruang kontrol</p>
                            <p className="mt-2 text-sm leading-7 text-[color:var(--muted-fg)]">
                              Narasi brand tetap dipisahkan dari auth. Setelah ini user masuk ke portal login yang lebih fokus, lebih imersif, dan lebih terarah.
                            </p>
                            <form action="/api/auth/intro" method="POST" className="mt-4">
                              <button type="submit" className="btn btn-primary">
                                <MoveRight size={16} />
                                Lanjut ke Login
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    </OpsPanel>
                  </m.section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

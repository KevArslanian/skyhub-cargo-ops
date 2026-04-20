"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, LogIn, MoveRight, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { DataCard, OpsPanel, SectionHeader } from "@/components/ops-ui";
import { StatusBadge } from "@/components/status-badge";
import {
  COMPANY_ABOUT_COPY,
  COMPANY_FACTS,
  COMPANY_HERO_COPY,
  COMPANY_HERO_HEADLINE,
  COMPANY_HERO_METRICS,
  COMPANY_OPERATIONAL_PRINCIPLES,
  COMPANY_OPERATOR_NOTE,
  COMPANY_SUPPORT_SLA,
  COMPANY_SUPPORT_TIMELINE,
  COMPANY_SWIPE_CARDS,
} from "@/lib/company-profile";
import { cn } from "@/lib/format";

export default function AboutUsPage() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    active: false,
    startX: 0,
    scrollLeft: 0,
  });
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

    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
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
    <div className="about-shell">
      <div className="about-frame">
        <header className="ops-panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <BrandMark />
            <div className="flex flex-wrap gap-2">
              <StatusBadge value="normal" label="Operasional normal" />
              <StatusBadge value="info" label="Internal operations system" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="topbar-button">
              <Building2 size={16} />
              Premium cargo control
            </span>
            <form action="/api/auth/intro" method="POST">
              <button type="submit" className="btn btn-primary">
                <LogIn size={16} />
                Lanjut ke Login
              </button>
            </form>
          </div>
        </header>

        <section className="ops-panel overflow-hidden p-0">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="p-6 lg:p-8">
              <p className="ops-eyebrow">Profil Perusahaan</p>
              <h1 className="mt-4 font-[family:var(--font-heading)] text-[clamp(2.7rem,5vw,4.6rem)] font-black leading-[0.94] tracking-[-0.07em] text-[color:var(--text-strong)]">
                {COMPANY_HERO_HEADLINE}
              </h1>
              <p className="mt-5 max-w-[760px] text-[1rem] leading-8 text-[color:var(--muted-fg)]">
                {COMPANY_HERO_COPY}
              </p>
              <p className="mt-4 max-w-[760px] text-[1rem] leading-8 text-[color:var(--muted-fg)]">
                {COMPANY_ABOUT_COPY}
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {COMPANY_HERO_METRICS.map((metric) => (
                  <DataCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    tone="primary"
                    className="h-full"
                  />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <form action="/api/auth/intro" method="POST">
                  <button type="submit" className="btn btn-primary">
                    <LogIn size={16} />
                    Lanjut ke Login
                  </button>
                </form>
                <span className="inline-flex min-h-[44px] items-center gap-2 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 text-sm font-semibold text-[color:var(--muted-fg)]">
                  Swipe cards di bawah untuk menelusuri identitas, capability, kualitas, akses, kontak, dan jejak digital.
                </span>
              </div>
            </div>

            <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 p-6 xl:border-l xl:border-t-0">
              <p className="ops-eyebrow">Status Perusahaan</p>
              <div className="mt-4 space-y-3">
                <DataCard
                  label="Status operasional"
                  value="Normal dan terawasi"
                  note="Ruang kontrol aktif untuk monitoring shipment, manifest, dan audit."
                  tone="success"
                />
                <DataCard
                  label="Platform scope"
                  value="Command center + portal"
                  note="Internal workspace dan customer portal berbagi identitas visual yang sama."
                  tone="info"
                />
                <DataCard
                  label="Support path"
                  value="24 jam monitoring support"
                  note="Jalur dukungan operasional tetap tersedia untuk eskalasi kritis."
                  tone="warning"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="ops-panel overflow-hidden px-6 py-6 lg:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="ops-eyebrow">Information Deck</p>
              <h2 className="mt-3 font-[family:var(--font-heading)] text-[1.75rem] font-extrabold tracking-[-0.04em] text-[color:var(--text-strong)]">
                Swipeable company cards
              </h2>
              <p className="mt-2 max-w-[780px] text-sm leading-7 text-[color:var(--muted-fg)]">
                Satu card aktif dibuat paling dominan, sementara card berikutnya sengaja terlihat sebagian untuk menandakan ada informasi lanjutan yang bisa digeser manual.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex min-h-[42px] items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 text-sm font-semibold text-[color:var(--text-strong)]">
                {activeIndex + 1}/{COMPANY_SWIPE_CARDS.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="topbar-button"
                  onClick={() => scrollToCard(Math.max(activeIndex - 1, 0))}
                  disabled={activeIndex === 0}
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  className="topbar-button"
                  onClick={() => scrollToCard(Math.min(activeIndex + 1, COMPANY_SWIPE_CARDS.length - 1))}
                  disabled={activeIndex === COMPANY_SWIPE_CARDS.length - 1}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={trackRef}
            className={cn("ops-snap-track mt-6 pb-3", dragging ? "cursor-grabbing" : "cursor-grab")}
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
                className="ops-panel ops-snap-card min-h-[450px] shrink-0 p-6 lg:p-7"
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="ops-eyebrow">{card.label}</p>
                      <h3 className="mt-3 font-[family:var(--font-heading)] text-[1.55rem] font-extrabold tracking-[-0.04em] text-[color:var(--text-strong)]">
                        {card.title}
                      </h3>
                    </div>
                    <StatusBadge value={activeIndex === index ? "live" : "info"} label={activeIndex === index ? "Aktif" : `Card ${index + 1}`} />
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[color:var(--muted-fg)]">{card.description}</p>

                  {card.chips?.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
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
                        <DataCard
                          key={metric.label}
                          label={metric.label}
                          value={metric.value}
                          className="h-full"
                        />
                      ))}
                    </div>
                  ) : null}

                  {card.contacts?.length ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {card.contacts.map((item) => {
                        return (
                          item.href ? (
                            <a
                              key={`${card.id}-${item.label}`}
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 transition-colors hover:bg-[color:var(--brand-primary-soft)]"
                            >
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
                            </a>
                          ) : (
                            <div
                              key={`${card.id}-${item.label}`}
                              className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4"
                            >
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
                            </div>
                          )
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[color:var(--text-strong)]">{activeCard.label}</p>
              <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                Geser dengan touch, trackpad, atau drag mouse. Tidak ada autoplay, semua kontrol ada di tangan user.
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
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <OpsPanel className="p-6">
            <SectionHeader
              title="Catatan Operasional"
              subtitle="Area kosong lama diganti menjadi panel yang benar-benar memberi konteks terhadap prinsip kerja produk dan alur operasionalnya."
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

          <div className="grid gap-5">
            <OpsPanel className="p-6">
              <SectionHeader
                title="SLA Support"
                subtitle="Support facts disajikan singkat agar mudah dipindai sebagai quality signals."
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
                subtitle="Legal, scope, dan positioning produk dipadatkan menjadi facts panel yang lebih modular."
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
                      Login tetap diposisikan sebagai CTA utama, tetapi sekarang didukung narasi visual yang lebih modular dan informatif.
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
          </div>
        </section>
      </div>
    </div>
  );
}

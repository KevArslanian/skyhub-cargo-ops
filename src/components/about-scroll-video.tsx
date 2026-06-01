"use client";

import { useEffect, useRef, useState } from "react";

export type AboutClip = {
  src: string;
  poster: string;
  label: string;
};

type AboutScrollVideoProps = {
  clips: AboutClip[];
  scrubVideo?: {
    src: string;
    poster: string;
  };
};

export function AboutScrollVideo({ clips, scrubVideo }: AboutScrollVideoProps) {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const ratiosRef = useRef<Map<number, number>>(new Map());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-video-clip]"));
    if (!nodes.length) {
      return undefined;
    }

    const ratios = ratiosRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.videoClip ?? "0");
          ratios.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestIndex = activeRef.current;
        let bestRatio = -1;
        for (const [index, ratio] of ratios.entries()) {
          if (index < 0 || index >= clips.length) {
            continue;
          }

          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        }

        if (bestRatio > 0) {
          setActive((current) => (current === bestIndex ? current : bestIndex));
        }
      },
      { threshold: [0.2, 0.4, 0.6, 0.8], rootMargin: "-12% 0px -12% 0px" },
    );

    for (const node of nodes) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      ratios.clear();
    };
  }, [clips.length]);

  useEffect(() => {
    if (!scrubVideo) {
      return undefined;
    }

    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let targetTime = 0;

    const syncDuration = () => {
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 0;
    };

    const syncVideoTime = () => {
      frame = 0;

      if (mediaQuery.matches || !durationRef.current) {
        return;
      }

      const scrollTop = Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);
      const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const scrollable = Math.max(scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(scrollTop / scrollable, 0), 1);
      targetTime = Math.max(0, Math.min(durationRef.current - 0.04, durationRef.current * progress));

      const delta = targetTime - video.currentTime;
      if (Math.abs(delta) > 0.055) {
        try {
          video.currentTime = video.currentTime + delta * 0.26;
        } catch {
          // Browser may reject a seek before metadata is fully ready.
        }
      }
    };

    const requestSync = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(syncVideoTime);
      }
    };

    const handleMetadata = () => {
      syncDuration();
      requestSync();
    };

    syncDuration();
    requestSync();
    video.addEventListener("loadedmetadata", handleMetadata);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      video.removeEventListener("loadedmetadata", handleMetadata);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
    };
  }, [scrubVideo]);

  return (
    <div className="about-video-backdrop" aria-hidden="true">
      <div className="about-video-stage">
        {clips.map((clip, index) => (
          <div
            key={`art-${clip.label}`}
            className={`about-art-layer about-art-${index + 1} ${index === active ? "is-active" : ""}`}
          >
            <span className="about-art-horizon" />
            <span className="about-art-grid" />
            <span className="about-art-corridor about-art-corridor-a" />
            <span className="about-art-corridor about-art-corridor-b" />
            <span className="about-art-signal about-art-signal-a" />
            <span className="about-art-signal about-art-signal-b" />
          </div>
        ))}

        {scrubVideo ? (
          <video
            ref={videoRef}
            className="about-scroll-video"
            src={scrubVideo.src}
          poster={scrubVideo.poster}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
        />
        ) : null}
      </div>

      <div className="about-video-scrim" />
      <div className="about-video-grain" />

      <div className="about-video-rail">
        {clips.map((clip, index) => (
          <span
            key={`rail-${clip.src}`}
            className={`about-video-tick ${index === active ? "is-active" : ""}`}
            title={clip.label}
          />
        ))}
      </div>

      <style jsx>{`
        .about-video-backdrop {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          background: #040405;
        }

        .about-video-stage {
          position: absolute;
          inset: 0;
          transform: translateZ(0);
          transform-origin: center;
        }

        .about-art-layer {
          position: absolute;
          inset: -6%;
          overflow: hidden;
          opacity: 0;
          transform: scale(1.05);
          transition:
            opacity 1s cubic-bezier(0.22, 1, 0.36, 1),
            transform 6s ease-out;
        }

        .about-art-layer.is-active {
          opacity: 1;
          transform: scale(1);
        }

        .about-scroll-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.94;
          filter: saturate(1.24) contrast(1.36) brightness(1.08);
          transform: translateZ(0);
        }

        .about-art-1 {
          background:
            linear-gradient(150deg, rgba(2, 9, 18, 0.97), rgba(7, 24, 46, 0.86) 44%, rgba(5, 8, 12, 0.96)),
            linear-gradient(90deg, rgba(0, 163, 255, 0.12), transparent 58%);
        }

        .about-art-2 {
          background:
            linear-gradient(145deg, rgba(22, 10, 4, 0.94), rgba(10, 24, 42, 0.9) 48%, rgba(4, 7, 12, 0.96)),
            linear-gradient(100deg, rgba(255, 190, 96, 0.16), transparent 54%);
        }

        .about-art-3 {
          background:
            linear-gradient(150deg, rgba(2, 12, 16, 0.98), rgba(4, 32, 40, 0.86) 48%, rgba(6, 8, 12, 0.97)),
            linear-gradient(88deg, rgba(121, 221, 162, 0.16), transparent 58%);
        }

        .about-art-4 {
          background:
            linear-gradient(150deg, rgba(5, 7, 13, 0.98), rgba(24, 18, 34, 0.88) 46%, rgba(6, 8, 12, 0.97)),
            linear-gradient(92deg, rgba(202, 154, 255, 0.14), transparent 56%);
        }

        .about-art-horizon {
          position: absolute;
          left: 0;
          right: 0;
          top: 38%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          box-shadow:
            0 34px 80px rgba(0, 163, 255, 0.18),
            0 -30px 90px rgba(255, 255, 255, 0.08);
        }

        .about-art-grid {
          position: absolute;
          inset: 38% -12% -8%;
          transform: perspective(680px) rotateX(62deg);
          transform-origin: top;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 163, 255, 0.16) 1px, transparent 1px);
          background-size: 54px 54px;
          animation: about-grid-drift 12s linear infinite;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.95), transparent 86%);
        }

        .about-art-corridor {
          position: absolute;
          top: 16%;
          height: 1px;
          width: 58%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.62), transparent);
          opacity: 0.34;
          transform-origin: left center;
        }

        .about-art-corridor-a {
          left: 8%;
          transform: rotate(16deg);
          animation: about-route-slide 7s ease-in-out infinite;
        }

        .about-art-corridor-b {
          right: -4%;
          top: 58%;
          transform: rotate(-14deg);
          animation: about-route-slide 8s ease-in-out infinite reverse;
        }

        .about-art-signal {
          position: absolute;
          width: 9px;
          height: 9px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 999px;
          background: rgba(0, 163, 255, 0.7);
          box-shadow: 0 0 22px rgba(0, 163, 255, 0.78);
        }

        .about-art-signal-a {
          left: 22%;
          top: 35%;
          animation: about-signal-a 6.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .about-art-signal-b {
          right: 18%;
          top: 62%;
          animation: about-signal-b 7.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .about-video-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(4, 4, 6, 0.28) 0%, rgba(4, 4, 6, 0.34) 55%, rgba(4, 4, 6, 0.58) 100%),
            linear-gradient(90deg, rgba(4, 4, 6, 0.58) 0%, rgba(4, 4, 6, 0.06) 48%, rgba(4, 4, 6, 0.22) 100%);
        }

        .about-video-grain {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
        }

        .about-video-rail {
          position: absolute;
          right: clamp(0.85rem, 2.4vw, 2.4rem);
          top: 50%;
          display: none;
          flex-direction: column;
          gap: 0.65rem;
          transform: translateY(-50%);
        }

        .about-video-tick {
          width: 2px;
          height: 22px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          transition:
            background 0.5s ease,
            height 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .about-video-tick.is-active {
          height: 40px;
          background: #00a3ff;
          box-shadow: 0 0 14px rgba(0, 163, 255, 0.55);
        }

        @keyframes about-grid-drift {
          from {
            background-position: 0 0;
          }

          to {
            background-position: 0 54px;
          }
        }

        @keyframes about-route-slide {
          0%,
          100% {
            opacity: 0.18;
            translate: -3% 0;
          }

          50% {
            opacity: 0.44;
            translate: 4% 0;
          }
        }

        @keyframes about-signal-a {
          0% {
            opacity: 0;
            transform: translate3d(-80px, 38px, 0) scale(0.72);
          }

          18%,
          78% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate3d(240px, -88px, 0) scale(1);
          }
        }

        @keyframes about-signal-b {
          0% {
            opacity: 0;
            transform: translate3d(90px, -32px, 0) scale(0.72);
          }

          20%,
          76% {
            opacity: 0.9;
          }

          100% {
            opacity: 0;
            transform: translate3d(-250px, 82px, 0) scale(1);
          }
        }

        @media (min-width: 1024px) {
          .about-video-rail {
            display: flex;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .about-art-grid,
          .about-art-corridor,
          .about-art-signal {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

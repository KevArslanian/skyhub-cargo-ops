"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  getLoginErrorDetail,
  isSetupLoginError,
  LOGIN_ERROR_CODES,
  type LoginErrorCode,
  type LoginResponse,
} from "@/lib/auth-login";
import {
  DEMO_LOGIN_ACCOUNTS,
  LOGIN_CAPABILITY_CARDS,
  LOGIN_EDITORIAL_SUPPORT,
  LOGIN_SHOWCASE_SCENES,
  LOGIN_SUPPORT_METRICS,
} from "@/lib/login-showcase";
import { cn } from "@/lib/format";

type FormErrors = {
  email?: string;
  password?: string;
  form?: string;
  formCode?: LoginErrorCode;
};

const supportIcons = [Radar, Database, ShieldCheck] as const;
const highlightIcons = [Radar, Workflow, LockKeyhole] as const;
const revealTransition = {
  duration: 0.48,
  ease: [0.22, 1, 0.36, 1],
} as const;

export default function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [email, setEmail] = useState("operator@skyhub.test");
  const [password, setPassword] = useState("operator123");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const activeScene = LOGIN_SHOWCASE_SCENES[activeSceneIndex] ?? LOGIN_SHOWCASE_SCENES[0];
  const loginError = errors.form ? getLoginErrorDetail(errors.formCode, errors.form) : null;
  const showSetupState = isSetupLoginError(errors.formCode);

  function applyDemoAccount(account: (typeof DEMO_LOGIN_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setRemember(true);
    setErrors({});
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!email.trim()) nextErrors.email = "Email wajib diisi.";
    if (!password.trim()) nextErrors.password = "Password wajib diisi.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });

      const payload = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setErrors({
          form: payload.error || "Login gagal.",
          formCode: payload.code,
        });
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrors({
        form: "Tidak dapat menjangkau layanan login saat ini.",
        formCode: LOGIN_ERROR_CODES.AUTH_UNAVAILABLE,
      });
    } finally {
      setSubmitting(false);
    }
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
                      {activeScene.sceneTag}
                    </span>
                    <span className="auth-metric-pill">
                      {activeScene.label} / {LOGIN_SHOWCASE_SCENES.length}
                    </span>
                    <Link href="/about-us" className="topbar-button border-[#d7cbba] bg-white/70 text-[#425066]">
                      <ArrowLeft size={16} />
                      <span>Kembali</span>
                    </Link>
                  </div>
                </header>

                <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                  <m.section
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={revealTransition}
                    className="order-2 min-w-0 xl:order-1"
                  >
                    <div className="auth-stage-grid">
                      <div className="auth-stage-panel">
                        <div className="auth-stage-media">
                          <AnimatePresence mode="wait">
                            <m.div
                              key={activeScene.id}
                              initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.02 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute inset-0"
                            >
                              <Image
                                src={activeScene.imageSrc}
                                alt={activeScene.imageAlt}
                                fill
                                priority
                                sizes="(max-width: 1279px) 100vw, 60vw"
                                className="object-cover"
                              />
                            </m.div>
                          </AnimatePresence>

                          <div className="relative flex h-full flex-col justify-between p-6 text-white lg:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="auth-floating-chip border-white/18 bg-white/10 text-white/84">
                                <LockKeyhole size={14} />
                                {activeScene.eyebrow}
                              </span>
                              <div className="auth-kicker-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                              </div>
                            </div>

                            <div className="max-w-[620px]">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/64">
                                Cargo access portal
                              </p>
                              <h1 className="mt-5 font-[family:var(--font-editorial)] text-[clamp(3rem,5vw,5.5rem)] leading-[0.88] tracking-[-0.06em] text-[#f9f0e3]">
                                {activeScene.title}
                              </h1>
                              <p className="mt-5 max-w-[560px] text-sm leading-7 text-white/78 lg:text-[0.98rem]">
                                {activeScene.description}
                              </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="auth-stage-note rounded-[22px] border border-white/16 bg-black/12 px-4 py-4 backdrop-blur-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/54">Frame note</p>
                                <p className="mt-3 text-sm font-semibold text-white/86">{activeScene.footerLeft}</p>
                              </div>
                              <div className="auth-stage-note rounded-[22px] border border-white/16 bg-black/12 px-4 py-4 backdrop-blur-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/54">Operational note</p>
                                <p className="mt-3 text-sm font-semibold text-white/86">{activeScene.footerRight}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="auth-soft-card p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a654c]">Active scene</p>
                          <h2 className="mt-4 font-[family:var(--font-editorial)] text-[2.1rem] leading-[0.96] tracking-[-0.04em] text-[#1a2436]">
                            {activeScene.label}
                          </h2>
                          <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">{activeScene.filmNote}</p>
                          <div className="mt-5 space-y-3">
                            {activeScene.facts.map((fact) => (
                              <div key={fact.label} className="rounded-[20px] border border-[#e0d4c4] bg-white/74 px-4 py-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f806a]">{fact.label}</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-[#172236]">{fact.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="auth-dark-card px-5 py-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/56">Access health</p>
                              <p className="mt-3 text-lg font-semibold text-white/90">Platform support signals</p>
                            </div>
                            <ShieldCheck size={20} className="text-white/72" />
                          </div>
                          <div className="mt-5 space-y-3">
                            {LOGIN_SUPPORT_METRICS.map((item, index) => {
                              const Icon = supportIcons[index % supportIcons.length];
                              return (
                                <div
                                  key={item.label}
                                  className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/6 px-4 py-3"
                                >
                                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/84">
                                    <Icon size={17} />
                                  </span>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{item.label}</p>
                                    <p className="mt-2 text-sm leading-6 text-white/84">{item.value}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <m.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...revealTransition, delay: 0.08 }}
                      className="mt-5"
                    >
                      <div className="auth-filmstrip">
                        {LOGIN_SHOWCASE_SCENES.map((scene, index) => (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => setActiveSceneIndex(index)}
                            aria-pressed={activeSceneIndex === index}
                            className={cn("auth-scene-button group", activeSceneIndex === index && "auth-scene-button-active")}
                          >
                            <div className="auth-scene-thumb">
                              <Image
                                src={scene.imageSrc}
                                alt={scene.imageAlt}
                                fill
                                sizes="216px"
                                className="object-cover transition duration-300 group-hover:scale-[1.015]"
                              />
                            </div>
                            <div className="px-2 pb-2 pt-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6b55]">{scene.label}</p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-[#162237]">{scene.eyebrow}</p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-fg)]">{scene.sceneTag}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </m.div>

                    <m.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...revealTransition, delay: 0.12 }}
                      className="mt-5 grid gap-4 md:grid-cols-3"
                    >
                      {LOGIN_CAPABILITY_CARDS.map((card, index) => {
                        const Icon = highlightIcons[index % highlightIcons.length];
                        return (
                          <article
                            key={card.label}
                            className="auth-capability-card rounded-[28px] border border-[#d8ccba] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,242,233,0.92))] px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.07)]"
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d7c9b6] bg-[#f7efe4] text-[#16315e]">
                                <Icon size={18} />
                              </span>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b7b67]">{card.label}</p>
                                <h3 className="mt-2 font-[family:var(--font-heading)] text-[1.3rem] leading-[1.05] tracking-[-0.03em] text-[#172236]">
                                  {card.title}
                                </h3>
                              </div>
                            </div>
                            <p className="mt-5 text-sm leading-7 text-[#5f6674]">{card.copy}</p>
                          </article>
                        );
                      })}
                    </m.div>
                  </m.section>

                  <m.aside
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...revealTransition, delay: 0.05 }}
                    className="order-1 xl:order-2 xl:sticky xl:top-5 xl:self-start"
                  >
                    <div className="auth-form-rail">
                      <div className="relative p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a765a]">Masuk sistem</p>
                            <h2 className="mt-4 font-[family:var(--font-editorial)] text-[3.2rem] leading-[0.9] tracking-[-0.05em] text-[#101c31]">
                              Login
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-[#5e6676]">
                              Form ini tetap menjadi aksi utama. Visual stage di kiri hanya memperjelas context system, bukan mengambil alih fokus auth.
                            </p>
                          </div>
                          <span className="auth-metric-pill">
                            <ShieldCheck size={15} className="text-[color:var(--brand-primary)]" />
                            Secured access
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {activeScene.stats.map((item) => (
                            <div key={item.label} className="rounded-[22px] border border-[#dfd3c3] bg-white/80 px-4 py-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8c7b64]">{item.label}</p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-[#152134]">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                          <div>
                            <label className="label text-[#7e6c56]">Email</label>
                            <input
                              type="email"
                              autoComplete="username"
                              className="input-field mt-2 border-[#daccb9] bg-white/82 text-[#12233d] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              placeholder="operator@skyhub.test"
                            />
                            {errors.email ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.email}</p> : null}
                          </div>

                          <div>
                            <label className="label text-[#7e6c56]">Password</label>
                            <div className="relative mt-2">
                              <input
                                className="input-field input-field-trailing border-[#daccb9] bg-white/82 text-[#12233d] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Masukkan password"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#5f6d80] transition hover:bg-[#edf2f7]"
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

                          <label className="flex items-center justify-between gap-3 rounded-[18px] border border-[#dfd3c3] bg-white/64 px-4 py-3 text-sm text-[#5f6676]">
                            <span className="font-medium">Ingat sesi saya</span>
                            <input
                              type="checkbox"
                              checked={remember}
                              onChange={(event) => setRemember(event.target.checked)}
                              className="h-4 w-4 rounded border-[#cfbea8] text-[color:var(--brand-primary)] focus:ring-[color:var(--brand-primary)]"
                            />
                          </label>

                          {loginError ? (
                            <m.div
                              role="alert"
                              aria-live="polite"
                              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "rounded-[24px] border px-4 py-4",
                                showSetupState
                                  ? "border-[color:var(--tone-warning-border)] bg-[linear-gradient(180deg,rgba(201,122,0,0.12),rgba(255,255,255,0.86))]"
                                  : "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]",
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={cn(
                                    "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                                    showSetupState
                                      ? "border-[#c49b56] bg-white/55 text-[#9a5c00]"
                                      : "border-[#d4b27d] bg-white/55 text-[#a06a0b]",
                                  )}
                                >
                                  <CircleAlert size={18} />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-[#7a4300]">{loginError.title}</p>
                                  <p className="mt-1 text-sm leading-6 text-[#8a5a00]">{loginError.message}</p>
                                  {loginError.note ? (
                                    <p className="mt-2 text-xs leading-6 text-[#9c6b0b]">{loginError.note}</p>
                                  ) : null}
                                </div>
                              </div>
                            </m.div>
                          ) : null}

                          <button type="submit" className="btn btn-primary w-full rounded-[22px]" disabled={submitting}>
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                            {submitting ? "Memproses login..." : "Masuk ke Dashboard"}
                          </button>
                        </form>

                        <div className="mt-6 rounded-[28px] border border-[#d8ccba] bg-white/70 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d7a63]">Akun demo</p>
                              <p className="mt-2 text-sm text-[#5e6676]">Klik satu akun untuk mengisi form secara otomatis.</p>
                            </div>
                            <CheckCircle2 size={18} className="text-[#0f4ebe]" />
                          </div>
                          <div className="mt-4 space-y-3">
                            {DEMO_LOGIN_ACCOUNTS.map((account) => (
                              <button
                                key={account.email}
                                type="button"
                                onClick={() => applyDemoAccount(account)}
                                className="flex w-full items-start justify-between gap-4 rounded-[20px] border border-[#e0d5c7] bg-[#fbf7ef] px-4 py-4 text-left transition hover:-translate-y-[1px] hover:border-[#bca98e] hover:bg-white"
                              >
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a765c]">{account.label}</p>
                                  <p className="mt-2 text-sm font-semibold text-[#152134]">{account.email}</p>
                                  <p className="mt-2 text-sm leading-6 text-[#616978]">{account.description}</p>
                                </div>
                                <span className="shrink-0 rounded-full border border-[#d7cbba] bg-white/82 px-3 py-1 text-xs font-semibold text-[#0f4ebe]">
                                  {account.password}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 rounded-[24px] border border-[#d8ccba] bg-[#17315f] px-4 py-4 text-white">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">Editorial support</p>
                          <div className="mt-3 space-y-3">
                            {LOGIN_EDITORIAL_SUPPORT.map((item, index) => {
                              const Icon = supportIcons[index % supportIcons.length];
                              return (
                                <div key={item} className="flex items-start gap-3">
                                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/82">
                                    <Icon size={16} />
                                  </span>
                                  <p className="text-sm leading-7 text-white/82">{item}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </m.aside>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

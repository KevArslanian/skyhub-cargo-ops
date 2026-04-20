"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/login-showcase";
import { cn } from "@/lib/format";

type FormErrors = {
  email?: string;
  password?: string;
  form?: string;
  formCode?: LoginErrorCode;
};

const supportIcons = [Radar, Database, ShieldCheck] as const;

export default function LoginPage() {
  const router = useRouter();
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
    <div className="relative min-h-screen overflow-hidden bg-[#f2f3f0] text-[color:var(--text-strong)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(223,209,184,0.5),transparent_30%),linear-gradient(180deg,#f6f6f3_0%,#ece9e3_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[linear-gradient(180deg,rgba(12,26,53,0.06),transparent)]" />

      <div className="relative px-4 py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-[1500px] rounded-[42px] border border-white/60 bg-white/55 p-3 shadow-[0_40px_120px_rgba(15,23,42,0.14)] backdrop-blur-md lg:p-4">
          <div className="rounded-[34px] border border-[#d8ccba] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,242,233,0.98))] p-4 lg:p-5">
            <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[#dfd3c2] bg-white/55 px-4 py-4 lg:px-5">
              <BrandMark
                className="gap-4"
                tileClassName="h-14 w-14 rounded-[18px] border border-[#d5c9b7] bg-white/85 shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                titleClassName="text-[1.22rem] text-[#10213d]"
                subtitleClassName="text-[#6b7280]"
              />

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#d7cbba] bg-[#f8f2ea] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#6c5f4d]">
                  <span className="h-2 w-2 rounded-full bg-[#0c4dbc]" />
                  Internal editorial access
                </span>
                <span className="inline-flex min-h-[42px] items-center rounded-full border border-[#d7cbba] bg-white/70 px-4 text-sm font-semibold text-[#10213d]">
                  {activeScene.label} / {LOGIN_SHOWCASE_SCENES.length}
                </span>
                <Link href="/about-us" className="topbar-button border-[#d7cbba] bg-white/70 text-[#425066]">
                  <ArrowLeft size={16} />
                  <span>Kembali</span>
                </Link>
              </div>
            </header>

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_410px]">
              <section className="min-w-0">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_300px]">
                  <article className="relative min-h-[560px] overflow-hidden rounded-[34px] border border-[#d8ccba] bg-[#162237] shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
                    <Image
                      src={activeScene.imageSrc}
                      alt={activeScene.imageAlt}
                      fill
                      priority
                      sizes="(max-width: 1279px) 100vw, 62vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,21,39,0.16),rgba(11,21,39,0.5))]" />
                    <div className="relative flex h-full flex-col justify-between p-6 text-white lg:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/72">
                            {activeScene.eyebrow}
                          </p>
                          <p className="mt-2 text-sm text-white/58">SkyHub authentication canvas</p>
                        </div>
                        <span className="inline-flex min-h-[40px] items-center rounded-full border border-white/20 bg-white/10 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/78 backdrop-blur-sm">
                          Secure gate
                        </span>
                      </div>

                      <div className="max-w-[620px]">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/62">Cargo operations</p>
                        <h1 className="mt-5 max-w-[560px] font-[family:var(--font-editorial)] text-[clamp(3rem,5.2vw,5.4rem)] leading-[0.88] tracking-[-0.05em] text-[#f7eee2]">
                          {activeScene.title}
                        </h1>
                        <p className="mt-5 max-w-[540px] text-sm leading-7 text-white/78 lg:text-[0.98rem]">
                          {activeScene.description}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-white/16 bg-black/12 px-4 py-4 backdrop-blur-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/54">Frame note</p>
                          <p className="mt-3 text-sm font-semibold text-white/86">{activeScene.footerLeft}</p>
                        </div>
                        <div className="rounded-[22px] border border-white/16 bg-black/12 px-4 py-4 backdrop-blur-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/54">Operational note</p>
                          <p className="mt-3 text-sm font-semibold text-white/86">{activeScene.footerRight}</p>
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="space-y-4">
                    <div className="rounded-[32px] border border-[#d8ccba] bg-[#fbf6ee] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a654c]">Active scene</p>
                      <h2 className="mt-4 font-[family:var(--font-editorial)] text-[2.05rem] leading-[0.96] tracking-[-0.04em] text-[#1a2436]">
                        {activeScene.label}
                      </h2>
                      <div className="mt-5 space-y-4">
                        {activeScene.facts.map((fact) => (
                          <div key={fact.label} className="rounded-[22px] border border-[#e0d4c4] bg-white/72 px-4 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f806a]">{fact.label}</p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-[#172236]">{fact.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-[#1f314f] bg-[linear-gradient(180deg,#11213b,#162944)] px-5 py-5 text-white shadow-[0_24px_60px_rgba(9,20,40,0.26)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/56">Access health</p>
                          <p className="mt-3 text-lg font-semibold text-white/90">SkyHub sign-in state</p>
                        </div>
                        <LockKeyhole size={20} className="text-white/72" />
                      </div>
                      <div className="mt-5 space-y-3">
                        {LOGIN_EDITORIAL_SUPPORT.map((item, index) => {
                          const Icon = supportIcons[index % supportIcons.length];
                          return (
                            <div
                              key={item}
                              className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/6 px-4 py-3"
                            >
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 text-white/85">
                                <Icon size={18} />
                              </span>
                              <p className="text-sm leading-6 text-white/82">{item}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-3">
                    {LOGIN_SHOWCASE_SCENES.map((scene, index) => (
                      <button
                        key={scene.id}
                        type="button"
                        onClick={() => setActiveSceneIndex(index)}
                        className={cn(
                          "group w-[220px] shrink-0 rounded-[24px] border p-2 text-left transition duration-150",
                          activeSceneIndex === index
                            ? "border-[#0f4ebe] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
                            : "border-[#dacdbb] bg-white/62 hover:-translate-y-[1px] hover:border-[#bfae95]",
                        )}
                      >
                        <div className="relative overflow-hidden rounded-[18px] border border-[#ddd1c0] bg-[#1c2535] aspect-[16/10]">
                          <Image
                            src={scene.imageSrc}
                            alt={scene.imageAlt}
                            fill
                            sizes="220px"
                            className="object-cover transition duration-300 group-hover:scale-[1.015]"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(8,14,24,0.22))]" />
                        </div>
                        <div className="px-2 pb-2 pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b6b55]">{scene.label}</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#162237]">{scene.eyebrow}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {LOGIN_CAPABILITY_CARDS.map((card, index) => (
                    <article
                      key={card.label}
                      className="rounded-[28px] border border-[#d8ccba] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,242,233,0.92))] px-5 py-5 shadow-[0_16px_34px_rgba(15,23,42,0.07)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d7c9b6] bg-[#f7efe4] font-[family:var(--font-editorial)] text-2xl font-semibold text-[#16315e]">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b7b67]">{card.label}</p>
                          <h3 className="mt-2 font-[family:var(--font-editorial)] text-[1.65rem] leading-[1] tracking-[-0.03em] text-[#172236]">
                            {card.title}
                          </h3>
                        </div>
                      </div>
                      <p className="mt-5 text-sm leading-7 text-[#5f6674]">{card.copy}</p>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="xl:sticky xl:top-5 xl:self-start">
                <div className="rounded-[34px] border border-[#d8ccba] bg-[linear-gradient(180deg,rgba(253,251,247,0.98),rgba(250,244,236,0.96))] p-5 shadow-[0_28px_70px_rgba(15,23,42,0.11)] sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a765a]">Masuk sistem</p>
                      <h2 className="mt-4 font-[family:var(--font-editorial)] text-[3rem] leading-[0.9] tracking-[-0.05em] text-[#101c31]">
                        Login
                      </h2>
                      <p className="mt-4 text-sm leading-7 text-[#5e6676]">
                        Gunakan email dan password yang terdaftar untuk membuka dashboard operasional atau portal pelanggan.
                      </p>
                    </div>
                    <span className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#d7cbba] bg-white/75 px-4 text-sm font-semibold text-[#19315d]">
                      <ShieldCheck size={16} />
                      Secured access
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-[#dfd3c3] bg-white/76 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8c7b64]">Persona</p>
                      <p className="mt-2 text-sm font-semibold text-[#152134]">Operator, supervisor, admin, customer</p>
                    </div>
                    <div className="rounded-[22px] border border-[#dfd3c3] bg-white/76 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8c7b64]">Session</p>
                      <p className="mt-2 text-sm font-semibold text-[#152134]">JWT cookie with remember option</p>
                    </div>
                  </div>

                  <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
                    <div>
                      <label className="label text-[#7e6c56]">Email</label>
                      <input
                        type="email"
                        autoComplete="username"
                        className="input-field mt-2 border-[#daccb9] bg-white/78 text-[#12233d] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
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
                          className="input-field input-field-trailing border-[#daccb9] bg-white/78 text-[#12233d] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
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

                    <label className="flex items-center gap-3 text-sm text-[#5f6676]">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                        className="h-4 w-4 rounded border-[#cfbea8] text-[color:var(--brand-primary)] focus:ring-[color:var(--brand-primary)]"
                      />
                      Ingat sesi saya
                    </label>

                    {loginError ? (
                      <div
                        role="alert"
                        aria-live="polite"
                        className={cn(
                          "rounded-[24px] border px-4 py-4",
                          loginError.tone === "danger"
                            ? "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]"
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
                      </div>
                    ) : null}

                    <button type="submit" className="btn btn-primary w-full rounded-[22px]" disabled={submitting}>
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                      {submitting ? "Memproses login..." : "Masuk ke Dashboard"}
                    </button>
                  </form>

                  <div className="mt-6 rounded-[28px] border border-[#d8ccba] bg-white/68 px-4 py-4">
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
                          <span className="shrink-0 rounded-full border border-[#d7cbba] bg-white/80 px-3 py-1 text-xs font-semibold text-[#0f4ebe]">
                            {account.password}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 rounded-[24px] border border-[#d8ccba] bg-[#17315f] px-4 py-4 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">Operational note</p>
                    <p className="mt-3 text-sm leading-7 text-white/84">
                      Halaman login ini sengaja dibuat seperti editorial access deck: visual dominan, CTA jelas, dan status error langsung informatif saat environment auth belum siap.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

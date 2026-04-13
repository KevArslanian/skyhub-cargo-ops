"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Radar, ShieldCheck, TowerControl, WavesLadder } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export default function LoginPage() {
  const router = useRouter();
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

  return (
    <div className="light grid min-h-screen bg-[color:var(--app-bg)] lg:grid-cols-[460px_1fr]">
      <section className="relative z-10 flex items-center justify-center px-6 py-12 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-6 py-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-4">
              <BrandMark
                iconOnly
                tileClassName="h-[72px] w-[72px]"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary-2)]">Cargo Ops Control</p>
                <h1 className="mt-1 font-[family:var(--font-heading)] text-3xl font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                  SkyHub
                </h1>
              </div>
            </div>
          </div>

          <div className="ops-panel overflow-hidden p-8">
            <p className="ops-eyebrow">Operator Login</p>
            <h2 className="mt-3 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
              Masuk ke ruang kendali
            </h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
              Sistem dibuat untuk operator shift panjang: formal, stabil, dan cepat dibaca saat memantau manifest, flight board, dan tracking log.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="label">Email</label>
                <input className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@skyhub.test" />
                {errors.email ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.email}</p> : null}
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
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.password}</p> : null}
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 text-[color:var(--muted-fg)]">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  Remember me
                </label>
                <span className="inline-link">Forgot password?</span>
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

            <div className="mt-8 grid gap-3">
              <div className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Demo Login</p>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--text-strong)]">
                  <p><strong>Operator:</strong> operator@skyhub.test / operator123</p>
                  <p><strong>Supervisor:</strong> supervisor@skyhub.test / operator123</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,18,35,0.88),rgba(0,61,155,0.76),rgba(0,89,207,0.34))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_22%)]" />

        <div className="relative flex h-full flex-col justify-between px-12 py-10">
          <div className="flex justify-end">
            <div className="rounded-[24px] border border-white/12 bg-white/10 px-5 py-4 backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Shift Status</p>
              <p className="mt-2 font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-white">Ready for Ops</p>
              <p className="mt-1 text-sm text-white/72">Manifest, flight board, dan AWB lookup tersedia.</p>
            </div>
          </div>

          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/62">Bandara Soedirman</p>
            <h2 className="mt-5 max-w-2xl font-[family:var(--font-heading)] text-[4.2rem] font-black leading-[0.96] tracking-[-0.07em] text-white">
              Tracking kargo udara yang cepat, padat, dan tetap tenang dibaca.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/76">
              Bahasa visual diadaptasi dari pola ops dashboard: card rapat, sidebar permanen, dan panel status yang selalu siap untuk kerja shift.
            </p>

            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {[
                {
                  icon: Radar,
                  title: "AWB Tracking",
                  copy: "Lookup cepat dengan status bertimestamp dan error page human-friendly.",
                },
                {
                  icon: TowerControl,
                  title: "Flight Board",
                  copy: "Pantau cutoff, delay, dan keberangkatan dalam satu control surface.",
                },
                {
                  icon: ShieldCheck,
                  title: "Audit & Alerts",
                  copy: "Activity log, notifications, dan exception state untuk supervisor.",
                },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="rounded-[28px] border border-white/12 bg-white/10 px-5 py-5 backdrop-blur-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/10 text-white">
                    <Icon size={20} />
                  </div>
                  <p className="mt-4 font-[family:var(--font-heading)] text-2xl font-extrabold tracking-[-0.04em] text-white">{title}</p>
                  <p className="mt-2 text-sm leading-7 text-white/72">{copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[30px] border border-white/12 bg-white/10 px-6 py-5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <WavesLadder size={18} className="text-white/80" />
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/65">Operator Note</p>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/76">
                Tampilan default tetap light theme, minim warna, dan fokus pada keterbacaan cepat. Dark mode tetap tersedia untuk kebutuhan tertentu tanpa mengganti struktur kerja operator.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

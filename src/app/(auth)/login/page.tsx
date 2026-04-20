"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

type LoginPayload = {
  error?: string;
  redirectTo?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      body: JSON.stringify({ email, password, remember: true }),
    });

    const payload = (await response.json()) as LoginPayload;

    if (!response.ok) {
      setErrors({ form: payload.error || "Login gagal." });
      setSubmitting(false);
      return;
    }

    router.push(payload.redirectTo || "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="login-shell">
        <section className="login-rail">
          <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center px-6 py-12">
            <div className="w-full rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-7 py-7 shadow-[var(--shadow-soft)]">
              <div className="mb-8 flex items-center gap-4">
                <BrandMark iconOnly tileClassName="h-[72px] w-[72px]" className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-primary-2)]">
                    Cargo Ops Control
                  </p>
                  <h1 className="mt-2 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                    SkyHub
                  </h1>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="label">Email / Account</label>
                  <input
                    className="input-field"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="operator@skyhub.test"
                  />
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
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.password}</p>
                  ) : null}
                </div>

                {errors.form ? (
                  <div className="rounded-[20px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm text-[color:var(--tone-warning)]">
                    {errors.form}
                  </div>
                ) : null}

                <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                  {submitting ? "Memproses..." : "Login"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="login-hero" aria-hidden="true" />
      </div>
    </div>
  );
}

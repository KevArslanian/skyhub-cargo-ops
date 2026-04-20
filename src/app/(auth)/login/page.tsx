"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const demoCredentials = [
  "admin@skyhub.test / operator123",
  "supervisor@skyhub.test / operator123",
  "operator@skyhub.test / operator123",
  "customer@skyhub.test / operator123",
] as const;

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
    <div className="min-h-screen bg-[color:var(--app-bg)] px-4 py-6 text-[color:var(--app-fg)] lg:px-6 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[560px] items-center">
        <div className="ops-panel w-full p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <BrandMark title="SkyHub" subtitle="Pusat Kendali Kargo" />
            <Link href="/about-us" className="topbar-button">
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </Link>
          </div>

          <div className="mt-8">
            <p className="ops-eyebrow">Masuk Sistem</p>
            <h1 className="mt-3 font-[family:var(--font-heading)] text-[2.4rem] font-black tracking-[-0.06em] text-[color:var(--text-strong)]">
              Login
            </h1>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
              Gunakan email dan password yang terdaftar untuk mengakses dashboard operasional atau portal pelanggan.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label">Email</label>
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

            <label className="flex items-center gap-2 text-sm text-[color:var(--muted-fg)]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Ingat sesi saya
            </label>

            {errors.form ? (
              <div className="rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm text-[color:var(--tone-warning)]">
                {errors.form}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {submitting ? "Memproses..." : "Masuk ke Dashboard"}
            </button>
          </form>

          <div className="mt-6 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
              Akun Demo
            </p>
            <div className="mt-3 space-y-2">
              {demoCredentials.map((item) => (
                <p key={item} className="text-sm text-[color:var(--text-strong)]">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

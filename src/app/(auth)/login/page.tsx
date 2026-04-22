"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  getLoginErrorDetail,
  LOGIN_ERROR_CODES,
  type LoginErrorCode,
  type LoginResponse,
} from "@/lib/auth-login";
import { cn } from "@/lib/format";

type FormErrors = {
  email?: string;
  password?: string;
  form?: string;
  formCode?: LoginErrorCode;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const loginError = errors.form ? getLoginErrorDetail(errors.formCode, errors.form) : null;
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
        body: JSON.stringify({ email, password, remember: false }),
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
    <div className="auth-atmosphere text-[color:var(--text-strong)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[820px] items-center justify-center px-4 py-8">
        <section className="w-full rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/95 p-5 shadow-[var(--shadow-soft)] backdrop-blur sm:p-7">
          <header className="mb-6 flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] pb-4">
            <BrandMark className="gap-3" tileClassName="h-12 w-12 rounded-[16px]" titleClassName="text-[1.1rem]" />
            <Link href="/about-us" className="topbar-button">
              <ArrowLeft size={16} />
              Kembali
            </Link>
          </header>

          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--brand-primary)]">
              <LockKeyhole size={18} />
            </span>
            <div>
              <h1 className="font-[family:var(--font-heading)] text-[1.9rem] font-black tracking-[-0.05em]">Masuk</h1>
              <p className="text-sm text-[color:var(--muted-fg)]">Autentikasi akun</p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                autoComplete="username"
                className="input-field mt-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@perusahaan.com"
              />
              {errors.email ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.email}</p> : null}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative mt-2">
                <input
                  className="input-field input-field-trailing"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--muted-fg)] transition hover:bg-[color:var(--panel-muted)]"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{errors.password}</p> : null}
            </div>

            {loginError ? (
              <div
                role="alert"
                aria-live="polite"
                className={cn("rounded-[22px] border px-4 py-4", "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]")}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--tone-warning-border)] bg-[color:var(--panel-bg)] text-[color:var(--tone-warning)]">
                    <CircleAlert size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">{loginError.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{loginError.message}</p>
                    {loginError.note ? <p className="mt-2 text-xs leading-6 text-[color:var(--muted-fg)]">{loginError.note}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary w-full rounded-[20px]" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {submitting ? "Memproses login..." : "Masuk"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

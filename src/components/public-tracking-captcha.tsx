"use client";

import { LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sanitizeIntegerInput } from "@/lib/input-guards";
import { cn } from "@/lib/format";

export type PublicTrackingChallenge = {
  id: string;
  prompt: string;
  expiresAt: number;
};

type PublicTrackingCaptchaProps = {
  challenge: PublicTrackingChallenge | null;
  answer: string;
  loading: boolean;
  error: string | null;
  onAnswerChange: (value: string) => void;
  onRefresh: () => void;
};

export async function fetchPublicTrackingChallenge() {
  const response = await fetch("/api/public/tracking-challenge", { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | PublicTrackingChallenge
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "Verifikasi robot belum bisa dimuat.");
  }

  if (!payload || !("id" in payload) || !payload.id || !payload.prompt) {
    throw new Error("Verifikasi robot belum bisa dimuat.");
  }

  return payload;
}

export function PublicTrackingCaptcha({
  challenge,
  answer,
  loading,
  error,
  onAnswerChange,
  onRefresh,
}: PublicTrackingCaptchaProps) {
  return (
    <div className="rounded-[20px] border border-white/12 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-white/58">
            <ShieldCheck size={14} className="text-[#9fd1ff]" />
            VERIFIKASI ROBOT
          </p>
          <p className="mt-2 text-sm leading-6 text-white/72">
            Selesaikan penjumlahan singkat sebelum pencarian resi dikirim ke server.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/14 bg-white/5 px-3 text-xs font-semibold text-white/78 transition hover:border-[#0f7bff] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Baru
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center">
        <div className="rounded-[16px] border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-white/42">BERAPA HASILNYA?</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.04em] text-white">
            {challenge ? challenge.prompt : "..."}
          </p>
        </div>
        <div>
          <label htmlFor="public-tracking-captcha-answer" className="sr-only">
            Jawaban verifikasi robot
          </label>
          <input
            id="public-tracking-captcha-answer"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={answer}
            disabled={!challenge || loading}
            placeholder="Jawaban"
            className={cn(
              "h-12 w-full rounded-[16px] border border-white/14 bg-white/[0.05] px-4 text-center font-mono text-lg font-semibold text-white outline-none transition focus:border-[#0f7bff] focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-70",
              error ? "border-[#ff4d4f]/70" : "",
            )}
            onChange={(event) => onAnswerChange(sanitizeIntegerInput(event.target.value).slice(0, 3))}
          />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-[#ff4d4f]">{error}</p> : null}
    </div>
  );
}

export function usePublicTrackingCaptcha() {
  const [challenge, setChallenge] = useState<PublicTrackingChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshChallenge = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnswer("");

    try {
      const nextChallenge = await fetchPublicTrackingChallenge();
      setChallenge(nextChallenge);
    } catch (caught) {
      setChallenge(null);
      setError(caught instanceof Error ? caught.message : "Verifikasi robot belum bisa dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshChallenge();
  }, [refreshChallenge]);

  return {
    challenge,
    answer,
    loading,
    error,
    setAnswer,
    refreshChallenge,
  };
}
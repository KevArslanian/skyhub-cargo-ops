"use client";

import { PUBLIC_AWB_PREFIX } from "@/lib/constants";
import { formatPublicAwbSuffixInput } from "@/lib/input-guards";
import { cn } from "@/lib/format";

type PublicAwbPrefixInputProps = {
  value: string;
  onChange: (suffix: string) => void;
  id?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
};

export function PublicAwbPrefixInput({
  value,
  onChange,
  id = "public-awb-suffix",
  className,
  inputClassName,
  disabled = false,
}: PublicAwbPrefixInputProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 font-mono text-lg font-semibold tracking-[0.08em] text-white/28"
      >
        {PUBLIC_AWB_PREFIX}-
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={8}
        value={value}
        disabled={disabled}
        placeholder="10000001"
        aria-label={`Digit resi setelah ${PUBLIC_AWB_PREFIX}-`}
        className={cn(
          "h-[62px] w-full rounded-[24px] border border-white/14 bg-white/[0.05] pl-[5.75rem] pr-5 font-mono text-lg font-semibold tracking-[0.06em] text-white outline-none transition focus:border-[#0f7bff] focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-70",
          inputClassName,
        )}
        onChange={(event) => onChange(formatPublicAwbSuffixInput(event.target.value))}
      />
    </div>
  );
}
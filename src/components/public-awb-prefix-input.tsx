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
    <div
      className={cn(
        "public-awb-prefix-input flex h-[62px] min-w-0 items-stretch overflow-hidden rounded-[24px] border border-white/14 bg-white/[0.05] transition focus-within:border-[#0f7bff] focus-within:bg-white/[0.07]",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-testid="public-awb-prefix-chip"
        className="public-awb-prefix-chip flex shrink-0 items-center border-r border-white/10 px-4 font-mono text-lg font-semibold tracking-[0.08em] text-white/28"
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
          "min-w-0 flex-1 bg-transparent px-4 font-mono text-lg font-semibold tracking-[0.06em] text-white outline-none disabled:cursor-not-allowed",
          inputClassName,
        )}
        onChange={(event) => onChange(formatPublicAwbSuffixInput(event.target.value))}
      />
    </div>
  );
}
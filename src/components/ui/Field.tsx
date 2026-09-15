import { ComponentProps } from "react";

export function Field({
  label,
  error,
  ...props
}: ComponentProps<"input"> & { label: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-xs uppercase tracking-widest text-smoke">
        {label}
      </span>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className="min-h-11 w-full rounded-sm border border-candle/25 bg-ash px-3
                   text-parchment outline-none placeholder:text-smoke/60
                   focus:border-candle"
      />
      {error && <span className="mt-1.5 block text-sm text-blood">{error}</span>}
    </label>
  );
}

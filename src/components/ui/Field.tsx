import { ComponentProps } from "react";

export function Field({
  label,
  error,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block pl-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-dym">
        {label}
      </span>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={
          "szklo min-h-11 w-full rounded-sm px-3.5 text-sm text-kosc outline-none " +
          "placeholder:text-dym/70 focus-visible:border-krew " +
          className
        }
      />
      {error && <span className="mt-1.5 block text-sm text-krew">{error}</span>}
    </label>
  );
}

import { ComponentProps } from "react";

type Wariant = "krew" | "szklo" | "cichy";

const style: Record<Wariant, string> = {
  // Akcja główna. Gradient plus wewnętrzny blask od góry — bez niego przycisk
  // wygląda jak płaska plama, a nie jak szkło podświetlone od spodu.
  krew:
    "text-white border-white/20 " +
    "bg-gradient-to-b from-krew/90 to-krew-glab/90 " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_26px_rgb(200_16_46/0.32)] " +
    "backdrop-blur-md hover:brightness-110 " +
    "disabled:from-dym/30 disabled:to-dym/30 disabled:shadow-none",
  szklo:
    "szklo text-kosc hover:bg-white/12 disabled:opacity-40",
  cichy:
    "text-dym border-transparent hover:text-kosc disabled:opacity-40",
};

export function Button({
  variant = "krew",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Wariant }) {
  return (
    <button
      {...props}
      className={
        "min-h-12 w-full rounded-full border px-5 text-sm font-bold " +
        "transition-[filter,transform,background-color] active:translate-y-px " +
        "disabled:cursor-not-allowed disabled:active:translate-y-0 " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew " +
        `${style[variant]} ${className}`
      }
    />
  );
}

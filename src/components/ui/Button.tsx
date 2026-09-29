import { ComponentProps } from "react";

type Wariant = "krew" | "szklo" | "cichy";

// Płynne szkło (spec wyglądu, D8) — klasy w globals.css, bo rant z maską
// i odblask to pseudoelementy, których utility Tailwinda nie opiszą.
const style: Record<Wariant, string> = {
  // Akcja główna: płynne szkło zabarwione krwią.
  krew: "szklo-plynne szklo-plynne-krew",
  szklo: "szklo-plynne",
  cichy:
    "border border-transparent text-dym hover:text-kosc active:translate-y-px disabled:opacity-40",
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
        "min-h-12 w-full rounded-full px-5 text-sm font-bold " +
        "disabled:cursor-not-allowed " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-krew " +
        `${style[variant]} ${className}`
      }
    />
  );
}

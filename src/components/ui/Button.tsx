import { ComponentProps } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-candle text-void hover:bg-candle-bright active:translate-y-px " +
    "disabled:bg-smoke disabled:text-ash",
  ghost:
    "border border-candle/40 text-candle hover:border-candle " +
    "hover:bg-candle/10 disabled:opacity-40",
  danger: "bg-blood text-parchment hover:brightness-125 disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={
        "min-h-11 rounded-sm px-5 font-display text-sm tracking-widest uppercase " +
        "transition-colors disabled:cursor-not-allowed " +
        `${styles[variant]} ${className}`
      }
    />
  );
}

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
  children: ReactNode;
}

const STYLES: Record<Variant, string> = {
  primary: "bg-clay text-paper-surface hover:bg-clay-deep disabled:bg-clay/40",
  secondary: "bg-paper-sunk text-ink hover:bg-paper-border disabled:text-ink-faint",
  ghost: "text-ink-muted hover:bg-paper-sunk",
  danger: "text-clay-deep hover:bg-clay-soft",
};

export default function Button({
  variant = "primary",
  full,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[0.95rem] font-medium transition disabled:cursor-not-allowed ${
        STYLES[variant]
      } ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

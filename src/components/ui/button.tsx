import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const buttonClasses = cva(
  "inline-flex items-center justify-center gap-2 rounded-control px-4 text-base font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "h-14 bg-accent text-on-accent hover:bg-accent-hover",
        quiet: "h-14 border border-line bg-surface text-fg hover:bg-accent-soft",
        subtle: "h-12 bg-transparent text-muted hover:text-fg",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      full: true,
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonClasses>;

export function Button({ className, variant, full, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonClasses({ variant, full }), className)} {...props} />
  );
}

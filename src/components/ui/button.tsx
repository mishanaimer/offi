import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Offi v2 button:
 * - primary: filled blue, soft shadow, darker on hover
 * - secondary: white surface, 1px border, primary on hover
 * - ghost: transparent → primaryLight tint on hover
 * - radius 10px (Apple-like, not pill)
 */
const buttonVariants = cva(
  "btn-bounce inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.01em] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-[10px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(2,89,221,0.15)] hover:bg-[hsl(var(--accent-brand-hover))] hover:shadow-[0_4px_16px_rgba(2,89,221,0.25)]",
        secondary:
          "bg-card text-foreground border border-border hover:border-primary hover:bg-[hsl(var(--accent-brand-light))]",
        outline:
          "bg-transparent text-foreground border border-border hover:border-primary hover:bg-[hsl(var(--accent-brand-light))]",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-[hsl(var(--accent-brand-light))] hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-4 text-xs rounded-lg",
        md: "h-11 px-[22px] text-sm",
        lg: "h-12 px-7 text-[15px]",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };

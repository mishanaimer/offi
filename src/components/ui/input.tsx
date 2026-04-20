import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-11 w-full rounded-[10px] border-[1.5px] border-border bg-card px-4 py-2 text-base placeholder:text-[hsl(var(--text-tertiary))] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-[rgba(2,89,221,0.08)] disabled:opacity-50 sm:text-sm transition-[box-shadow,border-color] duration-300",
      className
    )}
    style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-[10px] border-[1.5px] border-border bg-card px-4 py-3 text-base placeholder:text-[hsl(var(--text-tertiary))] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-[rgba(2,89,221,0.08)] disabled:opacity-50 resize-none sm:text-sm transition-[box-shadow,border-color] duration-300",
        className
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

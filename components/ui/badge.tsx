import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-th-brand-soft text-th-accent",
        success: "bg-th-paid-soft text-th-paid",
        warning: "bg-th-due-soft text-th-due",
        destructive: "bg-th-danger-soft text-th-danger",
        secondary: "bg-th-raised text-th-ink/80",
        outline: "border border-th-faint/40 text-th-ink/80",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

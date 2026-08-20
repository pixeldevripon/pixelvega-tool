import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * A callout, in one of the four tones a message can have.
 *
 * The variant names differ from `Badge`'s tones (`destructive` rather than
 * `danger`) because they were written at different times, and renaming one now
 * would touch every alert in the app for no behaviour change. They resolve to
 * the same tokens, which is the part that matters: there is one definition of
 * what danger looks like, in `globals.css`, for both components and both themes.
 *
 * The `-subtle` surface is the wash behind a whole paragraph; `Badge` uses the
 * stronger `-surface` because it is colouring a two-word chip.
 */
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm font-semibold",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        // Previously `border-red-200 bg-red-50 text-red-700` plus three `dark:`
        // overrides, per variant. Same colours, now named.
        destructive:
          "border-danger-border bg-danger-subtle text-danger-foreground",
        success:
          "border-success-border bg-success-subtle text-success-foreground",
        warning:
          "border-warning-border bg-warning-subtle text-warning-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      // Announced to a screen reader without stealing focus. An alert appears
      // in response to something the user did, and they need to be told.
      role="status"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-extrabold", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("text-sm leading-6", className)} {...props} />;
}

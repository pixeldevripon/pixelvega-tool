import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Hand written rather than added through the shadcn CLI, and deliberately so.
 *
 * The registry's current `radix-nova` button is a different design: `h-8` where
 * this is `h-11`, six variants where this has four, and a different focus
 * treatment. Adopting it would resize every button in the product, which is a
 * decision about the product's look rather than a foundation, and belongs in
 * its own change.
 *
 * What was added here is `asChild`, so a link can be a button without a second
 * copy of these classes hand-written on an anchor. There were three such copies
 * before, and one of them had already drifted.
 */
const buttonVariants = cva(
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        outline:
          "border border-border bg-card text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary",
        ghost: "text-muted-foreground hover:bg-primary/10 hover:text-primary",
        secondary: "bg-muted text-foreground hover:bg-primary/10 hover:text-primary",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render the child element with these styles instead of a `<button>`.
   *
   * For a control that navigates: an anchor is the right element for a link,
   * and `<Button onClick={() => router.push(...)}>` breaks middle click, "open
   * in new tab", and the status bar preview.
   */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component
      // `type` belongs to a real button only. Putting it on a slotted anchor
      // would emit an invalid attribute.
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };

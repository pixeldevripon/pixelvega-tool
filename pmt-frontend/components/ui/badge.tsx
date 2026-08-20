import * as React from "react";
import { cn } from "@/lib/utils";
import type { DisplayTone } from "@/types/permissions";

/**
 * A status, rendered in the tone the SERVER chose.
 *
 * The five tones are not a styling menu. They are `DISPLAY_TONES` in
 * `pmt-backend/src/common/dto/display.dto.ts`, and every enum in every response
 * arrives as `{ value, label, tone }`. Deciding that a project waiting on a
 * client reads as a warning while one on hold reads as danger is a judgment
 * about the business, and two clients must not be free to disagree about it
 * (ADR 0001).
 *
 * So this component's entire job is mapping a tone name onto a class. It has no
 * variants of its own, and a sixth tone is a change to both projects.
 *
 * This is also why it is NOT the registry's badge: that one is keyed on
 * `variant` (`default` / `secondary` / `destructive` / `outline`), which cannot
 * express the vocabulary the API speaks.
 */
const toneClasses: Record<DisplayTone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
  // Tokens rather than `bg-emerald-100 dark:bg-emerald-950`. The values are
  // identical; what changes is that the light and dark pair now lives in
  // `globals.css` beside every other colour, instead of a manual `dark:`
  // override that only this file knows about.
  success: "bg-success-surface text-success-foreground",
  warning: "bg-warning-surface text-warning-foreground",
  danger: "bg-danger-surface text-danger-foreground",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: DisplayTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

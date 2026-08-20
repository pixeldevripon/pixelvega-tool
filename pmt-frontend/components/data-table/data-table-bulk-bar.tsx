"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The bar that appears once rows are selected.
 *
 * Two decisions worth keeping:
 *
 * **It renders nothing at zero.** An always-present bar with disabled buttons
 * is a permanent strip of dead controls, and a user cannot tell a disabled
 * action from one they lack permission for.
 *
 * **The actions are passed in, already permission-checked.** This component
 * never decides what a caller may do. The server sends `canDelete` and
 * `canArchive` per row, and the list view decides which actions to hand over.
 * Re-deriving that from a role here would put the rule in two places, and the
 * copy in the browser would be the one that goes stale (D4).
 */

export interface DataTableBulkBarProps {
  selectedCount: number;
  onClear: () => void;
  /** Word for one row, so the count reads as English. */
  itemLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function DataTableBulkBar({
  selectedCount,
  onClear,
  itemLabel = "row",
  children,
  className,
}: DataTableBulkBarProps) {
  if (selectedCount === 0) return null;

  const plural = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div
      // `role="status"` so a screen reader is told the count changed. Without
      // it, selecting rows is silent and the actions appear from nowhere.
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-accent px-4 py-3",
        className,
      )}
    >
      <span className="text-sm font-semibold text-accent-foreground tabular-nums">
        {selectedCount} {plural} selected
      </span>

      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>

      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="size-4" aria-hidden />
        Clear selection
      </Button>
    </div>
  );
}

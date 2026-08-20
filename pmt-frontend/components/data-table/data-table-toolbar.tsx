"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The row above a table: a search box, whatever filters the screen has, and a
 * way out of both.
 *
 * The filters themselves are passed in as `children` rather than described by a
 * config object. A config would have to grow a case for every control the
 * screens need (a select, a date range, a user picker, a multi-select), and the
 * union of those cases is harder to read than the four lines of JSX it
 * replaces.
 *
 * `onReset` is not optional. A user who has narrowed a list to nothing needs a
 * single obvious way back, and leaving it to each screen means some screens
 * will not have one.
 */

export interface DataTableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Whether anything is narrowing the list, which is what reveals the reset. */
  isFiltered: boolean;
  onReset: () => void;
  /** Filter controls for this screen. */
  children?: React.ReactNode;
  /** Actions pinned to the right: "New project", an export. */
  actions?: React.ReactNode;
  className?: string;
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search",
  isFiltered,
  onReset,
  children,
  actions,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {children}

        {isFiltered ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="size-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

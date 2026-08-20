"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Pagination for a list the server paginated.
 *
 * Everything shown here is arithmetic on `total`, `page` and `pageSize`, which
 * the API already sent in every paginated response as `{ items, total, page,
 * pageSize }`. Counting the rows on screen instead would say "20 of 20" on
 * every page of a four hundred row list, which is the bug this replaces.
 *
 * The page count is computed rather than requested, and that is the one
 * exception to "the backend serves everything": it is a division that cannot
 * disagree with itself, has no business rule in it, and two clients doing it
 * independently cannot produce different answers.
 */

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  /** Rows matching the filters, across every page. Not the length of this page. */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Word for one row, so the count reads as English on every screen. */
  itemLabel?: string;
  className?: string;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  itemLabel = "result",
  className,
}: DataTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const plural = total === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {total === 0
          ? `No ${plural}`
          : `${first} to ${last} of ${total} ${plural}`}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="data-table-page-size"
            className="text-sm text-muted-foreground"
          >
            Per page
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger id="data-table-page-size" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

function pageNumbers(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const ordered = Array.from(pages)
    .filter((value) => value > 0 && value <= pageCount)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  ordered.forEach((value, index) => {
    if (index > 0 && value - ordered[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });

  return result;
}

export function PaginationControls({
  page,
  total,
  pageSize,
  onPageChange,
  disabled = false,
}: PaginationControlsProps) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-semibold text-muted-foreground">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={disabled || page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex items-center gap-1" aria-label="Page numbers">
          {pageNumbers(page, pageCount).map((value, index) =>
            value === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={value}
                variant={value === page ? "default" : "outline"}
                size="sm"
                aria-label={`Page ${value}`}
                aria-current={value === page ? "page" : undefined}
                disabled={disabled}
                onClick={() => onPageChange(value)}
              >
                {value}
              </Button>
            ),
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={disabled || page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}

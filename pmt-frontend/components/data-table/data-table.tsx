"use client";

import {
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortOrder } from "@/components/data-table/use-table-state";

/**
 * The table every list screen renders.
 *
 * Server driven, completely. It receives one page of rows, already ordered and
 * already filtered, and renders them in the order given. There is no
 * `getSortedRowModel`, no `getFilteredRowModel` and no `getPaginationRowModel`,
 * and their absence is the design rather than an omission:
 *
 * - Sorting a page in the browser sorts the twenty rows you were sent, not the
 *   four hundred that matched. The answer looks right and is wrong, which is
 *   the worst kind of wrong.
 * - The same goes for filtering and for a total in a footer.
 *
 * So a header click calls `onSortChange`, which puts `sortBy` and `sortOrder`
 * in the URL, which changes the query key, which fetches the correct page (D4).
 *
 * Row selection IS local, and is the one exception: a checkbox is interaction
 * state, not data, and the server has no opinion about it.
 */

/**
 * v9 requires the feature set to be declared up front rather than inferred
 * from which row model factories were passed. Selection is all this table
 * needs; everything else is the server's job.
 */
const features = tableFeatures({ rowSelectionFeature });

export type DataTableColumn<TRow extends RowData> = ColumnDef<typeof features, TRow> & {
  /**
   * The API's name for this column, when it can be ordered.
   *
   * Present means the header is clickable, and the value is sent as `sortBy`.
   * It is the API's field name rather than the column id so that a column
   * showing a derived label can still sort by the underlying field.
   */
  sortKey?: string;
  /** Right-align a numeric column, so digits line up down the page. */
  numeric?: boolean;
};

export interface DataTableProps<TRow extends RowData> {
  columns: Array<DataTableColumn<TRow>>;
  rows: TRow[];
  /** Stable id per row. Required: selection and React keys both depend on it. */
  getRowId: (row: TRow) => string;

  sortBy?: string;
  sortOrder?: SortOrder;
  onSortChange?: (sortKey: string) => void;

  selection?: RowSelectionState;
  onSelectionChange?: (selection: RowSelectionState) => void;

  onRowClick?: (row: TRow) => void;
  /** Rendered in place of the body when there are no rows. */
  empty?: React.ReactNode;
  className?: string;
}

function SortIcon({ active, order }: { active: boolean; order?: SortOrder }) {
  if (!active) {
    return <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />;
  }
  return order === "asc" ? (
    <ArrowUp className="size-3.5" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden />
  );
}

export function DataTable<TRow extends RowData>({
  columns,
  rows,
  getRowId,
  sortBy,
  sortOrder,
  onSortChange,
  selection,
  onSelectionChange,
  onRowClick,
  empty,
  className,
}: DataTableProps<TRow>) {
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId,
    state: selection ? { rowSelection: selection } : undefined,
    onRowSelectionChange: onSelectionChange
      ? (updater) =>
          onSelectionChange(
            typeof updater === "function" ? updater(selection ?? {}) : updater,
          )
      : undefined,
    enableRowSelection: Boolean(onSelectionChange),
  });

  const headerGroups = table.getHeaderGroups();
  const bodyRows = table.getRowModel().rows;

  return (
    <div
      className={cn(
        // The table scrolls inside its own box. Without this a wide table makes
        // the whole page scroll sideways, taking the navigation with it.
        "w-full overflow-x-auto rounded-lg border border-border bg-card",
        className,
      )}
    >
      <Table>
        <TableHeader>
          {headerGroups.map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const column = header.column.columnDef as DataTableColumn<TRow>;
                const sortKey = column.sortKey;
                const isSorted = Boolean(sortKey) && sortKey === sortBy;

                return (
                  <TableHead
                    key={header.id}
                    className={cn(column.numeric && "text-right")}
                    aria-sort={
                      isSorted
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(sortKey)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-sm font-semibold transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          column.numeric && "flex-row-reverse",
                          isSorted && "text-foreground",
                        )}
                      >
                        <table.FlexRender header={header} />
                        <SortIcon active={isSorted} order={sortOrder} />
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {bodyRows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            bodyRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                // A whole-row link is convenient but must not swallow the
                // keyboard: the primary cell carries a real link or button, and
                // this is an addition for pointer users only.
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {row.getAllCells().map((cell) => {
                  const column = cell.column.columnDef as DataTableColumn<TRow>;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(column.numeric && "text-right tabular-nums")}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * One import for a list screen.
 *
 * A screen needs the table, its toolbar, its pagination and both of its empty
 * states together, so six import lines per screen would be six chances to
 * import five of them.
 */

export { DataTable } from "@/components/data-table/data-table";
export type {
  DataTableColumn,
  DataTableProps,
} from "@/components/data-table/data-table";

export { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
export type { DataTableToolbarProps } from "@/components/data-table/data-table-toolbar";

export {
  DataTablePagination,
  PAGE_SIZE_OPTIONS,
} from "@/components/data-table/data-table-pagination";
export type { DataTablePaginationProps } from "@/components/data-table/data-table-pagination";

export { DataTableEmpty } from "@/components/data-table/data-table-empty";
export type { DataTableEmptyProps } from "@/components/data-table/data-table-empty";

export { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
export type { DataTableSkeletonProps } from "@/components/data-table/data-table-skeleton";

export { DataTableBulkBar } from "@/components/data-table/data-table-bulk-bar";
export type { DataTableBulkBarProps } from "@/components/data-table/data-table-bulk-bar";

export {
  DEFAULT_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  useTableState,
} from "@/components/data-table/use-table-state";
export type {
  SortOrder,
  TableState,
  TableStateConfig,
} from "@/components/data-table/use-table-state";

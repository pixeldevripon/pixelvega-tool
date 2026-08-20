import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The loading state, shaped like the table it is standing in for.
 *
 * A spinner in the middle of an empty box tells a reader nothing about what is
 * arriving, and the page jumps when it does. Rendering the real header with
 * placeholder rows underneath means the layout is already correct when the data
 * lands, so nothing moves.
 *
 * `rows` should be the page size the screen asked for, so the box is the height
 * it is about to be.
 */

/**
 * Cycled by row so the placeholders are not eight identical bars, which reads
 * as a loaded table of identical values rather than as loading. Classes rather
 * than an inline width, because a literal value in a `style` object is exactly
 * what the design token rules exist to keep out.
 */
const PLACEHOLDER_WIDTHS = ["w-full", "w-4/5", "w-3/5"] as const;

export interface DataTableSkeletonProps {
  /** Header labels, so the columns are already the right widths. */
  columns: string[];
  rows?: number;
}

export function DataTableSkeleton({ columns, rows = 8 }: DataTableSkeletonProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <TableRow key={rowIndex} className="hover:bg-transparent">
              {columns.map((column, columnIndex) => (
                <TableCell key={column}>
                  <Skeleton
                    className={`h-4 ${
                      PLACEHOLDER_WIDTHS[
                        (rowIndex + columnIndex) % PLACEHOLDER_WIDTHS.length
                      ]
                    }`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * The empty state, and the distinction it exists to make.
 *
 * "No projects yet" and "no projects match these filters" look identical on
 * screen and need opposite actions: the first wants a create button, the second
 * wants the filters cleared. Conflating them is why a user sits looking at an
 * empty list wondering whether the data is missing or the search is.
 *
 * `isFiltered` is what picks between them, and it comes from the same hook that
 * owns the filters, so the two cannot fall out of step.
 */

export interface DataTableEmptyProps {
  isFiltered: boolean;
  /** Shown when nothing exists at all. */
  title: string;
  description?: string;
  /** Shown when filters excluded everything. Defaults to a sentence about the filters. */
  filteredTitle?: string;
  filteredDescription?: string;
  icon?: React.ReactNode;
  onReset?: () => void;
  /** A create action, for the genuinely-empty case only. */
  action?: React.ReactNode;
}

export function DataTableEmpty({
  isFiltered,
  title,
  description,
  filteredTitle = "Nothing matches these filters",
  filteredDescription = "Try a different search term, or clear the filters to see everything.",
  icon,
  onReset,
  action,
}: DataTableEmptyProps) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{isFiltered ? filteredTitle : title}</EmptyTitle>
        {(isFiltered ? filteredDescription : description) ? (
          <EmptyDescription>
            {isFiltered ? filteredDescription : description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>

      {isFiltered
        ? onReset && (
            <Button variant="outline" size="sm" onClick={onReset}>
              Clear filters
            </Button>
          )
        : action}
    </Empty>
  );
}

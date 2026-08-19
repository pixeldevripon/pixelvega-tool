"use client";

import { ClipboardCheck, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import {
  dailyWorkReportsApi,
  type DailyEntryType,
  type ProjectDailyWorkEntriesQuery,
  type ProjectDailyWorkEntry,
} from "@/lib/api/daily-work-reports";
import type { ProjectMember } from "@/lib/api/projects";

const PAGE_SIZE = 10;
const ALL_VALUE = "ALL";

type ProjectDailyWorkReportsSectionProps = {
  projectId: string;
  members: ProjectMember[];
};

type HistoryFilters = {
  userId: string;
  startDate: string;
  endDate: string;
  type: DailyEntryType | typeof ALL_VALUE;
};

const EMPTY_FILTERS: HistoryFilters = {
  userId: ALL_VALUE,
  startDate: "",
  endDate: "",
  type: ALL_VALUE,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function memberName(entry: ProjectDailyWorkEntry) {
  return entry.dailyWorkReport.user?.name || entry.dailyWorkReport.user?.email || "Team member";
}

function memberLabel(member: ProjectMember) {
  return member.user?.name || member.user?.email || "Team member";
}

function entryTypeLabel(entry: ProjectDailyWorkEntry) {
  if (entry.accomplishments) return "Plan + wrap-up";
  return "Plan only";
}

export function ProjectDailyWorkReportsSection({
  projectId,
  members,
}: ProjectDailyWorkReportsSectionProps) {
  const [entries, setEntries] = useState<ProjectDailyWorkEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<HistoryFilters>(EMPTY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const teamMembers = useMemo(() => {
    const uniqueMembers = new Map<string, ProjectMember>();
    members.forEach((member) => {
      if (!uniqueMembers.has(member.userId)) uniqueMembers.set(member.userId, member);
    });
    return Array.from(uniqueMembers.values()).sort((a, b) =>
      memberLabel(a).localeCompare(memberLabel(b)),
    );
  }, [members]);

  const loadEntries = useCallback(
    async (nextPage: number, filters: HistoryFilters, refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError("");

      const query: ProjectDailyWorkEntriesQuery = {
        page: nextPage,
        pageSize: PAGE_SIZE,
        userId: filters.userId === ALL_VALUE ? undefined : filters.userId,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        type: filters.type,
      };

      try {
        const result = await dailyWorkReportsApi.projectHistory(projectId, query);
        setEntries(result.items);
        setPage(result.page);
        setTotal(result.total);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load project daily work history.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEntries(1, EMPTY_FILTERS);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadEntries]);

  function applyFilters() {
    setAppliedFilters(draftFilters);
    void loadEntries(1, draftFilters);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    void loadEntries(1, EMPTY_FILTERS);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ClipboardCheck size={20} className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-lg font-extrabold">Daily work history</h2>
            <p className="text-sm font-medium text-muted-foreground">
              Review plans and wrap-ups submitted for this project by the whole team.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || isRefreshing}
          onClick={() => void loadEntries(page, appliedFilters, true)}
        >
          {isRefreshing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCcw size={16} />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 rounded-md border border-border bg-muted/20 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <label className="text-sm font-bold">Team member</label>
          <Select
            value={draftFilters.userId}
            onValueChange={(value) =>
              setDraftFilters((current) => ({ ...current, userId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All team members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All team members</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {memberLabel(member)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold">From</label>
          <Input
            type="date"
            value={draftFilters.startDate}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                startDate: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold">To</label>
          <Input
            type="date"
            value={draftFilters.endDate}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                endDate: event.target.value,
              }))
            }
          />
        </div>
        <div className="flex items-end gap-2">
          <Select
            value={draftFilters.type}
            onValueChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                type: value as DailyEntryType | typeof ALL_VALUE,
              }))
            }
          >
            <SelectTrigger className="min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Plan + wrap-up</SelectItem>
              <SelectItem value="PLAN">Plans</SelectItem>
              <SelectItem value="WRAP_UP">Wrap-ups</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={isLoading || isRefreshing} onClick={applyFilters}>
            Apply
          </Button>
          <Button
            variant="ghost"
            disabled={isLoading || isRefreshing}
            onClick={clearFilters}
          >
            Clear
          </Button>
        </div>
      </div>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">
          No daily work entries match the selected filters.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold">{memberName(entry)}</h3>
                    <Badge tone={entry.accomplishments ? "success" : "warning"}>
                      {entryTypeLabel(entry)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {formatDate(entry.dailyWorkReport.date)}
                  </p>
                </div>
                {entry.reviewedAt ? <Badge tone="success">Reviewed</Badge> : null}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Plan
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium">
                    {entry.plan || "No plan recorded for this project entry."}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    Wrap-up
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium">
                    {entry.accomplishments || "Wrap-up not submitted yet."}
                  </p>
                </div>
              </div>

              {entry.reviewComment ? (
                <p className="mt-3 border-t border-border pt-3 text-sm font-medium text-muted-foreground">
                  Review comment: {entry.reviewComment}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <div className="mt-5">
        <PaginationControls
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          disabled={isLoading || isRefreshing}
          onPageChange={(nextPage) => void loadEntries(nextPage, appliedFilters)}
        />
      </div>
    </section>
  );
}

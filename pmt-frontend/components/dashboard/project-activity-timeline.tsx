"use client";

import { CalendarRange, History, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Project,
  type ProjectActivity,
  type ProjectStatus,
  projectsApi,
} from "@/lib/api/projects";

const ACTIVITY_PAGE_SIZE = 100;

const STATUS_BAR_STYLES: Record<ProjectStatus, string> = {
  PLANNING: "bg-slate-400",
  SCHEDULED: "bg-indigo-400",
  READY_FOR_WORK: "bg-sky-500",
  IN_PROGRESS: "bg-blue-600",
  ON_HOLD: "bg-amber-500",
  INTERNAL_REVIEW: "bg-violet-500",
  READY_FOR_CLIENT: "bg-fuchsia-500",
  WAITING_FOR_FEEDBACK: "bg-orange-500",
  COMPLETED: "bg-emerald-600",
  CANCELLED: "bg-rose-600",
};

const STATUS_ORDER: ProjectStatus[] = [
  "PLANNING",
  "SCHEDULED",
  "READY_FOR_WORK",
  "IN_PROGRESS",
  "ON_HOLD",
  "INTERNAL_REVIEW",
  "READY_FOR_CLIENT",
  "WAITING_FOR_FEEDBACK",
  "COMPLETED",
  "CANCELLED",
];

type ProjectActivityTimelineProps = {
  project: Project;
};

type StatusSegment = {
  id: string;
  status: ProjectStatus;
  start: number;
  end: number;
  inferred: boolean;
};

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function activityTypeLabel(activity: ProjectActivity) {
  return formatLabel(activity.type);
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && STATUS_ORDER.includes(value as ProjectStatus);
}

function metadataStatus(activity: ProjectActivity, key: "from" | "to") {
  return activity.metadata?.[key];
}

function minDate(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => value !== null && value !== undefined);
  return validValues.length ? Math.min(...validValues) : Date.now();
}

function maxDate(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => value !== null && value !== undefined);
  return validValues.length ? Math.max(...validValues) : Date.now();
}

function percentPosition(value: number, start: number, end: number) {
  return Math.min(100, Math.max(0, ((value - start) / (end - start)) * 100));
}

function TimelineGrid({
  ticks,
  children,
}: {
  ticks: number[];
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-[680px] overflow-hidden rounded-md border border-border bg-muted/20">
      {ticks.map((tick) => (
        <span
          key={tick}
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-border/70"
          style={{ left: `${tick}%` }}
        />
      ))}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function ProjectActivityTimeline({ project }: ProjectActivityTimelineProps) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [timelineNow] = useState(() => Date.now());

  const loadActivities = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError("");

      try {
        const firstPage = await projectsApi.activities(project.id, {
          page: 1,
          pageSize: ACTIVITY_PAGE_SIZE,
        });
        const pageCount = Math.ceil(firstPage.total / ACTIVITY_PAGE_SIZE);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
            projectsApi.activities(project.id, {
              page: index + 2,
              pageSize: ACTIVITY_PAGE_SIZE,
            }),
          ),
        );
        setActivities([
          ...firstPage.items,
          ...remainingPages.flatMap((result) => result.items),
        ]);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the activity timeline.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [project.id],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadActivities();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadActivities]);

  const timeline = useMemo(() => {
    const orderedActivities = [...activities].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const activityTimes = orderedActivities.map((activity) =>
      new Date(activity.createdAt).getTime(),
    );
    const createdAt = new Date(project.createdAt).getTime();
    const plannedStart = project.plannedStartDate
      ? new Date(project.plannedStartDate).getTime()
      : null;
    const deadline = project.deadline ? new Date(project.deadline).getTime() : null;
    const completedAt = project.completedAt
      ? new Date(project.completedAt).getTime()
      : null;
    const terminal = project.status === "COMPLETED" || project.status === "CANCELLED";
    const start = minDate([createdAt, plannedStart, ...activityTimes]);
    const end = maxDate([
      ...activityTimes,
      deadline,
      completedAt,
      terminal ? null : timelineNow,
    ]);
    const chartEnd = end <= start ? start + 24 * 60 * 60 * 1000 : end;
    const statusActivities = orderedActivities.filter(
      (activity) => activity.type === "STATUS_CHANGED",
    );
    const statusSegments: StatusSegment[] = statusActivities.flatMap(
      (activity, index) => {
        const status = metadataStatus(activity, "to");
        if (!isProjectStatus(status)) return [];
        const segmentStart = new Date(activity.createdAt).getTime();
        const nextStart = statusActivities[index + 1]
          ? new Date(statusActivities[index + 1].createdAt).getTime()
          : chartEnd;
        return [
          {
            id: activity.id,
            status,
            start: segmentStart,
            end: Math.max(segmentStart, nextStart),
            inferred: true,
          },
        ];
      },
    );
    const ticks = Array.from({ length: 7 }, (_, index) =>
      percentPosition(start + ((chartEnd - start) * index) / 6, start, chartEnd),
    );
    const markers = orderedActivities.map((activity) => ({
      activity,
      position: percentPosition(new Date(activity.createdAt).getTime(), start, chartEnd),
    }));
    const scheduleStart = plannedStart ?? createdAt;
    const scheduleEnd = deadline ?? completedAt ?? chartEnd;

    return {
      chartEnd,
      markers,
      scheduleStart,
      scheduleEnd: Math.max(scheduleStart, scheduleEnd),
      start,
      statusSegments,
      ticks,
    };
  }, [activities, project, timelineNow]);

  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <CalendarRange size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-extrabold">Activity timeline</h2>
            <p className="text-sm font-medium text-muted-foreground">
              Loading the project activity timeline...
            </p>
          </div>
        </div>
        <Skeleton className="h-56 w-full rounded-md" />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CalendarRange size={20} className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-lg font-extrabold">Activity Gantt</h2>
            <p className="text-sm font-medium text-muted-foreground">
              Project lifecycle and activity milestones arranged over time.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isRefreshing}
          onClick={() => void loadActivities(true)}
        >
          {isRefreshing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCcw size={16} />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {activities.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">
          No project activity is available for the timeline yet.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              Project window
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              Inferred status period
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-card" />
              Activity event
            </span>
            <Badge tone="default">{activities.length} events</Badge>
          </div>

          <Alert className="mb-5">
            <AlertDescription>
              Status bars are inferred from consecutive status-change events. Activity
              records are immutable events, not task start/end records.
            </AlertDescription>
          </Alert>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[930px]">
              <div className="grid grid-cols-[270px_minmax(680px,1fr)] gap-3">
                <div />
                <div className="relative h-12 border-b border-border">
                  {timeline.ticks.map((tick, index) => {
                    const tickTime =
                      timeline.start +
                      ((timeline.chartEnd - timeline.start) * index) / 6;
                    return (
                      <span
                        key={tick}
                        className="absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-muted-foreground"
                        style={{ left: `${tick}%` }}
                      >
                        {formatShortDate(tickTime)}
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <CalendarRange size={16} className="text-primary" />
                  Project window
                </div>
                <TimelineGrid ticks={timeline.ticks}>
                  <div className="relative h-12">
                    <div
                      className="absolute top-3 h-6 rounded-full bg-primary/85 px-3 py-1 text-xs font-extrabold text-primary-foreground shadow-sm"
                      style={{
                        left: `${percentPosition(timeline.scheduleStart, timeline.start, timeline.chartEnd)}%`,
                        width: `${Math.max(1, percentPosition(timeline.scheduleEnd, timeline.start, timeline.chartEnd) - percentPosition(timeline.scheduleStart, timeline.start, timeline.chartEnd))}%`,
                      }}
                      title={`${formatShortDate(timeline.scheduleStart)} – ${formatShortDate(timeline.scheduleEnd)}`}
                    >
                      <span className="hidden sm:inline">Scheduled window</span>
                    </div>
                  </div>
                </TimelineGrid>

                {timeline.statusSegments.map((segment) => (
                  <div key={segment.id} className="contents">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${STATUS_BAR_STYLES[segment.status]}`}
                      />
                      <span>{formatLabel(segment.status)}</span>
                      <Badge className="shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                        Inferred period
                      </Badge>
                    </div>
                    <TimelineGrid ticks={timeline.ticks}>
                      <div className="relative h-10">
                        <div
                          className={`absolute top-2 h-6 rounded-full px-3 py-1 text-xs font-extrabold text-white ${STATUS_BAR_STYLES[segment.status]}`}
                          style={{
                            left: `${percentPosition(segment.start, timeline.start, timeline.chartEnd)}%`,
                            width: `${Math.max(0.8, percentPosition(segment.end, timeline.start, timeline.chartEnd) - percentPosition(segment.start, timeline.start, timeline.chartEnd))}%`,
                          }}
                          title={`${formatLabel(segment.status)} · ${formatDateTime(segment.start)} – ${formatDateTime(segment.end)} · inferred`}
                        />
                      </div>
                    </TimelineGrid>
                  </div>
                ))}

                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <History size={16} className="text-primary" />
                  Activity markers
                </div>
                <TimelineGrid ticks={timeline.ticks}>
                  <div className="relative h-16">
                    {timeline.markers.map(({ activity, position }) => (
                      <span
                        key={activity.id}
                        className="absolute top-3 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
                        style={{ left: `${position}%` }}
                        title={`${activityTypeLabel(activity)} · ${formatDateTime(new Date(activity.createdAt).getTime())}`}
                        aria-label={`${activityTypeLabel(activity)} on ${formatDateTime(new Date(activity.createdAt).getTime())}`}
                      />
                    ))}
                  </div>
                </TimelineGrid>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>Window:</span>
            <span>{formatShortDate(timeline.start)}</span>
            <span>→</span>
            <span>{formatShortDate(timeline.chartEnd)}</span>
          </div>
        </>
      )}
    </section>
  );
}

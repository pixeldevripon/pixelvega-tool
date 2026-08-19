"use client";

import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCcw,
  Send,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type DailyEntryType,
  type DailyWorkEntry,
  type DailyWorkReport,
  dailyWorkReportsApi,
} from "@/lib/api/daily-work-reports";
import { projectsApi, type Project } from "@/lib/api/projects";
import { userStore } from "@/lib/api/user-store";
import type { AppUser } from "@/types/auth";

type AuthorMode = "PLAN" | "WRAP_UP";
type Draft = { plan: string; accomplishments: string };
const ALL_VALUE = "ALL";

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRole(user?: AppUser | null) {
  if (!user) return "Team member";
  return user.role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isAuthorRole(role?: AppUser["role"]) {
  return role === "DEVELOPER" || role === "DESIGNER";
}

function isReviewerRole(role?: AppUser["role"]) {
  return (
    role === "PROJECT_MANAGER" ||
    role === "ADMIN" ||
    role === "SYSTEM_ADMIN"
  );
}

function reportEntryDraft(entry: DailyWorkEntry): Draft {
  return {
    plan: entry.plan ?? "",
    accomplishments: entry.accomplishments ?? "",
  };
}

function reportProjectIds(report: DailyWorkReport | null, mode: AuthorMode) {
  if (!report) return [];
  if (mode === "PLAN") {
    return report.entries
      .filter((entry) => Boolean(entry.plan))
      .map((entry) => entry.projectId);
  }
  return report.entries.map((entry) => entry.projectId);
}

function EntryStatus({
  report,
  entry,
}: {
  report: DailyWorkReport;
  entry: DailyWorkEntry;
}) {
  if (report.status === "COMPLETED" && entry.accomplishments) {
    return <Badge tone="success">Wrap-up submitted</Badge>;
  }
  return <Badge tone="warning">Plan submitted</Badge>;
}

export function DailyWorkReportsView() {
  const { currentUser, users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [todayReport, setTodayReport] = useState<DailyWorkReport | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [authorMode, setAuthorMode] = useState<AuthorMode>("PLAN");
  const [isLoadingAuthor, setIsLoadingAuthor] = useState(false);
  const [now, setNow] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authorError, setAuthorError] = useState("");
  const [history, setHistory] = useState<DailyWorkReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [reviewUserId, setReviewUserId] = useState("");
  const [reviewStartDate, setReviewStartDate] = useState("");
  const [reviewEndDate, setReviewEndDate] = useState("");
  const [reviewType, setReviewType] = useState<DailyEntryType | typeof ALL_VALUE>(
    ALL_VALUE,
  );
  const [reviewReports, setReviewReports] = useState<DailyWorkReport[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [reviewingEntryId, setReviewingEntryId] = useState<string | null>(null);

  const canAuthor = isAuthorRole(currentUser?.role);
  const canReview = isReviewerRole(currentUser?.role);

  const activeProjects = useMemo(
    () =>
      projects
        .filter((project) => !project.archivedAt)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const reportEntryByProjectId = useMemo(
    () => new Map((todayReport?.entries ?? []).map((entry) => [entry.projectId, entry])),
    [todayReport],
  );
  const lockedProjectIds = useMemo(
    () =>
      new Set(
        todayReport &&
          (authorMode === "PLAN" ||
            authorMode === "WRAP_UP" ||
            todayReport.status === "COMPLETED")
          ? reportProjectIds(todayReport, authorMode)
          : [],
      ),
    [authorMode, todayReport],
  );
  const canEditPlan = !todayReport || todayReport.status === "PLAN_SUBMITTED";
  const canSubmitWrapUp = Boolean(
    todayReport && todayReport.status === "PLAN_SUBMITTED",
  );
  const wrapUpEditOpen = Boolean(
      todayReport?.status === "COMPLETED" &&
      todayReport.wrapUpSubmittedAt &&
      now > new Date(todayReport.wrapUpSubmittedAt).getTime() &&
      now - new Date(todayReport.wrapUpSubmittedAt).getTime() < 2 * 60 * 60 * 1000,
  );
  const canEditWrapUp = canSubmitWrapUp || wrapUpEditOpen;

  const reviewUsers = useMemo(
    () =>
      (Array.isArray(users) ? users : [])
        .filter(
          (user) =>
            (user.role === "DEVELOPER" || user.role === "DESIGNER") &&
            user.status !== "SUSPENDED",
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const applyTodayReport = useCallback(
    (report: DailyWorkReport | null, defaultMode: AuthorMode = "PLAN") => {
      setTodayReport(report);
      setAuthorMode(report?.status === "COMPLETED" ? "WRAP_UP" : defaultMode);
      setSelectedProjectIds(reportProjectIds(report, report?.status === "COMPLETED" ? "WRAP_UP" : defaultMode));
      setDrafts(
        Object.fromEntries(
          (report?.entries ?? []).map((entry) => [entry.projectId, reportEntryDraft(entry)]),
        ),
      );
    },
    [],
  );

  const loadAuthorData = useCallback(async () => {
    if (!canAuthor) return;
    setIsLoadingAuthor(true);
    setAuthorError("");
    try {
      const [report, projectResult] = await Promise.all([
        dailyWorkReportsApi.today(),
        projectsApi.listMine({ page: 1, pageSize: 100 }),
      ]);
      setProjects(projectResult.items);
      applyTodayReport(report);
    } catch (error) {
      setAuthorError(
        error instanceof Error ? error.message : "Unable to load today's standup.",
      );
    } finally {
      setIsLoadingAuthor(false);
    }
  }, [applyTodayReport, canAuthor]);

  const loadHistory = useCallback(async () => {
    if (!canAuthor) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await dailyWorkReportsApi.list({ page: 1, pageSize: 20 });
      setHistory(result.items);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Unable to load standup history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [canAuthor]);

  const loadReviewReports = useCallback(async () => {
    if (!canReview || !reviewUserId) {
      setReviewReports([]);
      return;
    }
    setReviewLoading(true);
    setReviewError("");
    try {
      const result = await dailyWorkReportsApi.list({
        page: 1,
        pageSize: 50,
        userId: reviewUserId,
        startDate: reviewStartDate,
        endDate: reviewEndDate,
        type: reviewType,
      });
      setReviewReports(result.items);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Unable to load review queue.",
      );
    } finally {
      setReviewLoading(false);
    }
  }, [canReview, reviewEndDate, reviewStartDate, reviewType, reviewUserId]);

  useEffect(() => {
    void userStore.loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (canAuthor) {
        void loadAuthorData();
        void loadHistory();
      }
      if (canReview) {
        void userStore.loadUsers();
      }
      setNow(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [canAuthor, canReview, currentUser, loadAuthorData, loadHistory]);

  function updateDraft(projectId: string, field: keyof Draft, value: string) {
    setDrafts((current) => {
      const draft = current[projectId] ?? { plan: "", accomplishments: "" };
      return {
        ...current,
        [projectId]: { ...draft, [field]: value },
      };
    });
  }

  function toggleProject(projectId: string) {
    if (lockedProjectIds.has(projectId)) return;
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  function changeAuthorMode(mode: AuthorMode) {
    setAuthorMode(mode);
    if (mode === "PLAN") {
      setSelectedProjectIds(reportProjectIds(todayReport, "PLAN"));
    } else {
      setSelectedProjectIds(reportProjectIds(todayReport, "WRAP_UP"));
    }
    setAuthorError("");
  }

  async function submitAuthorForm() {
    setAuthorError("");
    if (selectedProjectIds.length === 0) {
      setAuthorError("Select at least one project before submitting.");
      return;
    }

    const missingContent = selectedProjectIds.find((projectId) => {
      const draft = drafts[projectId];
      return !(authorMode === "PLAN" ? draft?.plan : draft?.accomplishments)?.trim();
    });
    if (missingContent) {
      setAuthorError(
        `Add ${authorMode === "PLAN" ? "a plan" : "accomplishments"} for every selected project.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedReport =
        authorMode === "PLAN"
          ? todayReport
            ? await dailyWorkReportsApi.updatePlan(
                todayReport.id,
                selectedProjectIds.map((projectId) => ({
                  projectId,
                  plan: drafts[projectId].plan.trim(),
                })),
              )
            : await dailyWorkReportsApi.submitPlan(
                selectedProjectIds.map((projectId) => ({
                  projectId,
                  plan: drafts[projectId].plan.trim(),
                })),
              )
          : todayReport?.status === "COMPLETED"
            ? await dailyWorkReportsApi.updateWrapUp(
                todayReport.id,
                selectedProjectIds.map((projectId) => ({
                  projectId,
                  accomplishments: drafts[projectId].accomplishments.trim(),
                })),
              )
            : await dailyWorkReportsApi.submitWrapUp(
                todayReport?.id ?? "",
                selectedProjectIds.map((projectId) => ({
                  projectId,
                  accomplishments: drafts[projectId].accomplishments.trim(),
                })),
              );

      applyTodayReport(updatedReport, authorMode === "PLAN" ? "WRAP_UP" : "WRAP_UP");
      await loadHistory();
      toast.success(authorMode === "PLAN" ? "Daily plan saved" : "Wrap-up saved", {
        description:
          authorMode === "PLAN"
            ? "Your team can now see what you plan to work on."
            : "Your accomplishments were recorded for today.",
      });
    } catch (error) {
      setAuthorError(
        error instanceof Error
          ? error.message
          : `Unable to save your ${authorMode === "PLAN" ? "plan" : "wrap-up"}.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitReview(reportId: string, entryId: string) {
    setReviewingEntryId(entryId);
    try {
      await dailyWorkReportsApi.reviewEntry(
        reportId,
        entryId,
        reviewDrafts[entryId]?.trim(),
      );
      setReviewDrafts((current) => ({ ...current, [entryId]: "" }));
      await loadReviewReports();
      toast.success("Wrap-up reviewed", {
        description: "The project entry review was recorded.",
      });
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Unable to review this entry.",
      );
    } finally {
      setReviewingEntryId(null);
    }
  }

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (!canAuthor && !canReview) {
    return (
      <Alert variant="warning">
        <AlertTitle>Standups unavailable</AlertTitle>
        <AlertDescription>
          Daily plans and wrap-ups are available to developers, designers, and
          project managers.
        </AlertDescription>
      </Alert>
    );
  }

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
  }).format(new Date());
  const currentModeIsEditable = authorMode === "PLAN" ? canEditPlan : canEditWrapUp;
  const authorProjectIds = new Set(selectedProjectIds);
  const displayedAuthorProjects = [
    ...activeProjects,
    ...Array.from(reportEntryByProjectId.values())
      .map((entry) => ({ id: entry.projectId, name: entry.project.name } as Project))
      .filter((project) => !projectById.has(project.id)),
  ].filter((project) => authorProjectIds.has(project.id));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge tone="primary">Daily work</Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
              Plans & wrap-ups
            </h1>
            <p className="mt-2 max-w-3xl text-base font-medium text-muted-foreground">
              Submit one clear plan in the morning and record accomplishments at
              the end of your workday.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm font-bold text-muted-foreground">
            {todayLabel}
          </div>
        </div>
      </section>

      {canAuthor ? (
        <>
          {authorError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not save daily work</AlertTitle>
              <AlertDescription>{authorError}</AlertDescription>
            </Alert>
          ) : null}

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <CalendarCheck size={22} className="mt-0.5 text-primary" />
                <div>
                  <h2 className="text-xl font-extrabold">Today&apos;s standup</h2>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    {todayReport
                      ? todayReport.status === "COMPLETED"
                        ? "Today's plan and wrap-up are complete."
                        : "Your plan is saved. Add accomplishments when work is done."
                      : "Choose the projects you expect to work on today."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={authorMode === "PLAN" ? "default" : "outline"}
                  onClick={() => changeAuthorMode("PLAN")}
                >
                  Plan
                </Button>
                <Button
                  variant={authorMode === "WRAP_UP" ? "default" : "outline"}
                  disabled={!todayReport}
                  onClick={() => changeAuthorMode("WRAP_UP")}
                >
                  Wrap-up
                </Button>
              </div>
            </div>

            {isLoadingAuthor ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {activeProjects.map((project) => {
                    const selected = selectedProjectIds.includes(project.id);
                    const locked = lockedProjectIds.has(project.id);
                    return (
                      <label
                        key={project.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/60"
                        } ${locked ? "cursor-default opacity-80" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-primary"
                          checked={selected}
                          disabled={locked}
                          onChange={() => toggleProject(project.id)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-extrabold">
                            {project.name}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                            {project.status.replaceAll("_", " ")}
                            {locked ? " · already included" : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {activeProjects.length === 0 ? (
                  <Alert variant="warning">
                    <AlertTitle>No active projects found</AlertTitle>
                    <AlertDescription>
                      You need to be an active member of at least one project to
                      submit a daily plan.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {displayedAuthorProjects.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {displayedAuthorProjects.map((project) => {
                      const draft = drafts[project.id] ?? {
                        plan: "",
                        accomplishments: "",
                      };
                      const entry = reportEntryByProjectId.get(project.id);
                      return (
                        <div
                          key={project.id}
                          className="rounded-md border border-border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate font-extrabold">{project.name}</h3>
                              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                {authorMode === "PLAN"
                                  ? "What do you plan to accomplish?"
                                  : "What did you accomplish?"}
                              </p>
                            </div>
                            {entry ? <EntryStatus report={todayReport!} entry={entry} /> : null}
                          </div>
                          <Textarea
                            className="mt-4 min-h-32"
                            value={
                              authorMode === "PLAN"
                                ? draft.plan
                                : draft.accomplishments
                            }
                            disabled={!currentModeIsEditable}
                            onChange={(event) =>
                              updateDraft(
                                project.id,
                                authorMode === "PLAN" ? "plan" : "accomplishments",
                                event.target.value,
                              )
                            }
                            placeholder={
                              authorMode === "PLAN"
                                ? "Break the work into clear outcomes or bullets."
                                : "Record the work completed, progress made, or handoff details."
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">
                    Select one or more projects above to start your {authorMode === "PLAN" ? "plan" : "wrap-up"}.
                  </div>
                )}

                {authorMode === "WRAP_UP" && todayReport?.status === "COMPLETED" && !wrapUpEditOpen ? (
                  <Alert>
                    <Clock3 size={18} />
                    <AlertTitle>Wrap-up is locked</AlertTitle>
                    <AlertDescription>
                      Wrap-ups can only be edited for two hours after submission.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {currentModeIsEditable ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {authorMode === "PLAN"
                        ? "Existing plan projects stay included when you edit the plan."
                        : "Wrap-up can include urgent work that was not in the morning plan."}
                    </p>
                    <Button disabled={isSubmitting || !selectedProjectIds.length} onClick={() => void submitAuthorForm()}>
                      {isSubmitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : authorMode === "PLAN" ? (
                        <Send size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {isSubmitting
                        ? "Saving..."
                        : todayReport && authorMode === "PLAN"
                          ? "Update plan"
                          : todayReport?.status === "COMPLETED"
                            ? "Update wrap-up"
                            : authorMode === "PLAN"
                              ? "Submit plan"
                              : "Submit wrap-up"}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Eye size={20} className="mt-0.5 text-primary" />
                <div>
                  <h2 className="text-lg font-extrabold">My standup history</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    Review recent plans, wrap-ups, and PM feedback.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadHistory()}>
                <RefreshCcw size={16} />
                Refresh
              </Button>
            </div>
            {historyError ? <Alert variant="destructive"><AlertDescription>{historyError}</AlertDescription></Alert> : null}
            {historyLoading ? (
              <div className="space-y-3"><Skeleton className="h-20 w-full rounded-md" /><Skeleton className="h-20 w-full rounded-md" /></div>
            ) : history.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">No standup history yet.</div>
            ) : (
              <div className="space-y-3">
                {history.map((report) => (
                  <div key={report.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><span className="font-extrabold">{formatDate(report.date)}</span><Badge tone={report.status === "COMPLETED" ? "success" : "warning"}>{report.status === "COMPLETED" ? "Complete" : "Plan submitted"}</Badge></div>
                      <span className="text-xs font-semibold text-muted-foreground">{report.entries.length} project{report.entries.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {report.entries.map((entry) => (
                        <div key={entry.id} className="rounded-md bg-muted/60 p-3 text-sm">
                          <div className="font-extrabold">{entry.project.name}</div>
                          {entry.plan ? <p className="mt-2 whitespace-pre-wrap font-medium"><span className="font-extrabold">Plan:</span> {entry.plan}</p> : null}
                          {entry.accomplishments ? <p className="mt-2 whitespace-pre-wrap font-medium"><span className="font-extrabold">Wrap-up:</span> {entry.accomplishments}</p> : null}
                          {entry.reviewComment ? <p className="mt-2 flex gap-2 border-t border-border pt-2 text-muted-foreground"><MessageSquare size={15} className="mt-0.5 shrink-0" />{entry.reviewComment}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {canReview ? (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <UserRound size={22} className="mt-0.5 text-primary" />
            <div>
              <h2 className="text-xl font-extrabold">Team review queue</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Review submitted wrap-ups for projects you manage. Reviews are
                recorded per project entry.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <label className="text-sm font-bold">Team member</label>
              <Select value={reviewUserId} onValueChange={setReviewUserId}>
                <SelectTrigger><SelectValue placeholder="Select developer or designer" /></SelectTrigger>
                <SelectContent>{reviewUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email} · {formatRole(user)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><label className="text-sm font-bold">From</label><Input type="date" value={reviewStartDate} onChange={(event) => setReviewStartDate(event.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-bold">To</label><Input type="date" value={reviewEndDate} onChange={(event) => setReviewEndDate(event.target.value)} /></div>
            <div className="flex items-end gap-2">
              <Select value={reviewType} onValueChange={(value) => setReviewType(value as DailyEntryType | typeof ALL_VALUE)}>
                <SelectTrigger className="min-w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL_VALUE}>Plan + wrap-up</SelectItem><SelectItem value="PLAN">Plans</SelectItem><SelectItem value="WRAP_UP">Wrap-ups</SelectItem></SelectContent>
              </Select>
              <Button disabled={!reviewUserId || reviewLoading} onClick={() => void loadReviewReports()}>
                {reviewLoading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />} Review
              </Button>
            </div>
          </div>

          {reviewError ? <Alert className="mt-4" variant="destructive"><AlertDescription>{reviewError}</AlertDescription></Alert> : null}
          {!reviewUserId ? (
            <div className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">Select a team member to load their daily reports.</div>
          ) : reviewLoading ? (
            <div className="mt-5 space-y-3"><Skeleton className="h-24 w-full rounded-md" /><Skeleton className="h-24 w-full rounded-md" /></div>
          ) : reviewReports.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">No reports match the selected filters.</div>
          ) : (
            <div className="mt-5 space-y-4">
              {reviewReports.map((report) => (
                <div key={report.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="font-extrabold">{formatDate(report.date)}</span><Badge tone={report.status === "COMPLETED" ? "success" : "warning"}>{report.status === "COMPLETED" ? "Wrap-up ready" : "Plan only"}</Badge></div><span className="text-xs font-semibold text-muted-foreground">{report.entries.length} entries</span></div>
                  <div className="mt-3 space-y-3">
                    {report.entries.map((entry) => (
                      <div key={entry.id} className="rounded-md bg-muted/50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-extrabold">{entry.project.name}</div>{entry.plan ? <p className="mt-2 whitespace-pre-wrap text-sm font-medium"><span className="font-extrabold">Plan:</span> {entry.plan}</p> : null}{entry.accomplishments ? <p className="mt-2 whitespace-pre-wrap text-sm font-medium"><span className="font-extrabold">Wrap-up:</span> {entry.accomplishments}</p> : <p className="mt-2 text-sm font-semibold text-muted-foreground">Wrap-up not submitted yet.</p>}</div>{entry.reviewedAt ? <Badge tone="success">Reviewed</Badge> : null}</div>
                        {entry.accomplishments && !entry.reviewedAt && report.status === "COMPLETED" ? (
                          <div className="mt-4 space-y-2 border-t border-border pt-3"><label className="text-sm font-bold">Review comment (optional)</label><Textarea value={reviewDrafts[entry.id] ?? ""} onChange={(event) => setReviewDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} placeholder="Add a concise note for this project entry." rows={3} /><Button size="sm" disabled={reviewingEntryId === entry.id} onClick={() => void submitReview(report.id, entry.id)}>{reviewingEntryId === entry.id ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />} {reviewingEntryId === entry.id ? "Saving..." : "Record review"}</Button></div>
                        ) : null}
                        {entry.reviewedAt ? <p className="mt-3 flex gap-2 border-t border-border pt-3 text-sm font-medium text-muted-foreground"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />Reviewed {formatDateTime(entry.reviewedAt)}{entry.reviewComment ? ` · ${entry.reviewComment}` : ""}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

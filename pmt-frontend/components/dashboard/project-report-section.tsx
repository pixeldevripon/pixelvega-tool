"use client";

import { BarChart3, CalendarRange, CheckCircle2, Clock3, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { reportsApi, type ProjectReport } from "@/lib/api/reports";
import type { Project } from "@/lib/api/projects";

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: dateInput(start), endDate: dateInput(end) };
}

function formatHours(value: number | null) {
  return value === null ? "Not set" : `${value.toFixed(value % 1 === 0 ? 0 : 2)}h`;
}

function formatMinutes(value: number | null) {
  if (value === null) return "None resolved";
  const hours = Math.floor(value / 60);
  return hours ? `${hours}h ${value % 60}m avg.` : `${value}m avg.`;
}

function percent(value: number | null) {
  return value === null ? "Not available" : `${Math.round(value * 100)}%`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-md border border-border bg-muted/20 p-4"><div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-black">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</div> : null}</div>;
}

export function ProjectReportSection({ project }: { project: Project }) {
  const [draftRange, setDraftRange] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async (range = appliedRange, refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      setReport(await reportsApi.project(project.id, range));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load project report.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [appliedRange, project.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadReport]);

  function applyRange() {
    setAppliedRange(draftRange);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><BarChart3 size={21} className="mt-0.5 text-primary" /><div><h2 className="text-lg font-extrabold">Project report</h2><p className="text-sm font-medium text-muted-foreground">Calculated project activity for a selected date range.</p></div></div>
        <Button variant="outline" size="sm" disabled={isLoading || isRefreshing} onClick={() => void loadReport(appliedRange, true)}>{isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}Refresh</Button>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/20 p-4">
        <div className="space-y-2"><label className="text-sm font-bold">From</label><Input type="date" value={draftRange.startDate} onChange={(event) => setDraftRange((current) => ({ ...current, startDate: event.target.value }))} /></div>
        <div className="space-y-2"><label className="text-sm font-bold">To</label><Input type="date" value={draftRange.endDate} onChange={(event) => setDraftRange((current) => ({ ...current, endDate: event.target.value }))} /></div>
        <Button disabled={isLoading || isRefreshing || !draftRange.startDate || !draftRange.endDate} onClick={applyRange}><CalendarRange size={16} />Apply</Button>
      </div>
      {error ? <Alert className="mt-4" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {isLoading ? <div className="mt-5 grid gap-3 md:grid-cols-3"><Skeleton className="h-24 rounded-md" /><Skeleton className="h-24 rounded-md" /><Skeleton className="h-24 rounded-md" /></div> : report ? <div className="mt-5 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Actual hours" value={formatHours(report.actualHours)} detail={`Estimated ${formatHours(report.estimatedHours)}`} /><Metric label="Remaining hours" value={formatHours(report.remainingHours)} /><Metric label="Working days" value={String(report.workingDaysInRange)} /><Metric label="Hours by member" value={String(report.hoursByMember.length)} /></div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div><h3 className="mb-3 font-extrabold">Hours by team member</h3>{report.hoursByMember.length ? <div className="space-y-3">{report.hoursByMember.map((item) => <div key={item.userId} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"><span className="font-bold">{item.name}</span><strong>{formatHours(item.hours)}</strong></div>)}</div> : <p className="text-sm font-medium text-muted-foreground">No time recorded in this range.</p>}</div>
          <div><h3 className="mb-3 font-extrabold">Daily work compliance</h3><div className="space-y-3 rounded-md border border-border p-4 text-sm"><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Days planned</span><strong>{report.dailyWorkReportCompliance.daysPlanned}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Days wrapped up</span><strong>{report.dailyWorkReportCompliance.daysWrappedUp}</strong></div><div className="flex justify-between"><span className="font-semibold text-muted-foreground">Follow-through</span><strong>{percent(report.dailyWorkReportCompliance.planFollowThroughRate)}</strong></div></div></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Blockers" value={`${report.blockers.openedCount} opened`} detail={`${report.blockers.resolvedCount} resolved · ${report.blockers.currentlyOpenCount} open`} /><Metric label="Avg. blocker resolution" value={formatMinutes(report.blockers.averageResolutionMinutes)} /><Metric label="Additional requirements" value={String(report.additionalRequirements.receivedCount)} detail={`${report.additionalRequirements.approvedCount} approved · ${report.additionalRequirements.rejectedCount} rejected`} /><Metric label="Client feedback" value={`${report.clientFeedback.approvedCount} approved`} detail={`${report.clientFeedback.changesRequestedCount} changes requested`} /></div>

        <div className="grid gap-6 xl:grid-cols-3"><div className="rounded-md border border-border p-4"><div className="mb-3 flex items-center gap-2"><CheckCircle2 size={17} className="text-primary" /><h3 className="font-extrabold">Review outcomes</h3></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Internal review approved</span><strong>{report.internalReview.approvedCount}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Changes required</span><strong>{report.internalReview.changesRequiredCount}</strong></div><div className="mt-3 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">First round client approval: {report.clientFeedbackFirstRoundApproved === null ? "Not recorded" : report.clientFeedbackFirstRoundApproved ? "Approved" : "Changes requested"}</div></div></div><div className="rounded-md border border-border p-4"><div className="mb-3 flex items-center gap-2"><UsersIcon /><h3 className="font-extrabold">Staffing</h3></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Joined</span><strong>{report.staffingChanges.joined}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Left</span><strong>{report.staffingChanges.left}</strong></div></div></div><div className="rounded-md border border-border p-4"><div className="mb-3 flex items-center gap-2"><Clock3 size={17} className="text-primary" /><h3 className="font-extrabold">Deadline impact</h3></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Blocker extensions</span><strong>{report.blockers.deadlineExtensionCount}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Approved extra days</span><strong>{report.additionalRequirements.totalDeadlineExtensionDays}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Approved extra hours</span><strong>{formatHours(report.additionalRequirements.totalApprovedAdditionalHours)}</strong></div></div></div></div>
      </div> : null}
    </section>
  );
}

function UsersIcon() {
  return <span className="inline-block h-4 w-4 rounded-full border-2 border-primary" aria-hidden="true" />;
}

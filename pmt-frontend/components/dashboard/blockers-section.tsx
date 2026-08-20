"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import {
  blockersApi,
  type Blocker,
  type BlockerReason,
  type BlockerSeverity,
  type BlockerStatus,
} from "@/lib/api/blockers";
import type { Project, ProjectMember } from "@/lib/api/projects";
import type { AppUser } from "@/types/auth";

const ALL_VALUE = "ALL";

const STATUS_LABELS: Record<BlockerStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

const SEVERITY_LABELS: Record<BlockerSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const STATUS_TONES: Record<BlockerStatus, "default" | "primary" | "success" | "warning"> = {
  OPEN: "warning",
  IN_PROGRESS: "primary",
  RESOLVED: "success",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function personName(person?: Pick<AppUser, "name" | "email"> | null) {
  return person?.name || person?.email || "Workspace user";
}

function formatMinutes(minutes?: number) {
  if (minutes === undefined) return "Still open";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function severityTone(severity: BlockerSeverity) {
  if (severity === "HIGH") return "danger" as const;
  if (severity === "MEDIUM") return "warning" as const;
  return "default" as const;
}

function displayName(member: ProjectMember) {
  return member.user?.name || member.user?.email || "Team member";
}

type BlockersSectionProps = {
  project: Project;
  activeMembers: ProjectMember[];
  canReport: boolean;
  canManageReasons: boolean;
};

export function BlockersSection({
  project,
  activeMembers,
  canReport,
  canManageReasons,
}: BlockersSectionProps) {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [reasons, setReasons] = useState<BlockerReason[]>([]);
  const [impact, setImpact] = useState<{
    resolvedCount: number;
    totalResolutionMinutes: number;
    totalDeadlineExtensionDays: number;
    blockersWithExtension: number;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<BlockerStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [severityFilter, setSeverityFilter] = useState<BlockerSeverity | typeof ALL_VALUE>(ALL_VALUE);
  const [page, setPage] = useState(1);
  const [totalBlockers, setTotalBlockers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Blocker | null>(null);
  const [isReasonsOpen, setIsReasonsOpen] = useState(false);
  const [removingReason, setRemovingReason] = useState<BlockerReason | null>(null);
  const [isRemovingReason, setIsRemovingReason] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<BlockerSeverity>("MEDIUM");
  const [reasonId, setReasonId] = useState("");
  const [nextStatus, setNextStatus] = useState<BlockerStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [assignedToId, setAssignedToId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [extensionDays, setExtensionDays] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newReasonName, setNewReasonName] = useState("");
  const [editingReason, setEditingReason] = useState<BlockerReason | null>(null);
  const [editingReasonName, setEditingReasonName] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [isSavingReason, setIsSavingReason] = useState(false);

  const loadBlockers = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setLoadError("");

      try {
        const [listResult, impactResult, reasonResult] = await Promise.all([
          blockersApi.listForProject(project.id, {
            page,
            pageSize: 10,
            status: statusFilter,
            severity: severityFilter,
          }),
          blockersApi.deadlineImpact(project.id),
          blockersApi.reasons(),
        ]);
        setBlockers(listResult.items);
        setTotalBlockers(listResult.total);
        setImpact(impactResult);
        setReasons(reasonResult);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load blockers.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, project.id, severityFilter, statusFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadBlockers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBlockers]);

  const activeBlockers = useMemo(
    () => blockers.filter((blocker) => blocker.status !== "RESOLVED"),
    [blockers],
  );
  const assignableMembers = useMemo(
    () =>
      activeMembers
        .filter((member) => member.role !== "PROJECT_MANAGER")
        .filter((member) => member.user)
        .sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [activeMembers],
  );

  function resetForm() {
    setDescription("");
    setSeverity("MEDIUM");
    setReasonId("");
    setNextStatus(ALL_VALUE);
    setAssignedToId("");
    setResolutionNotes("");
    setExtensionDays("");
    setFormError("");
  }

  function openCreate() {
    resetForm();
    setEditing(null);
    setIsCreateOpen(true);
  }

  function openEdit(blocker: Blocker, status?: BlockerStatus) {
    setEditing(blocker);
    setDescription(blocker.description);
    setSeverity(blocker.severity);
    setReasonId(blocker.reasonId);
    setNextStatus(status ?? blocker.status);
    setAssignedToId(blocker.assignedToId ?? "");
    setResolutionNotes("");
    setExtensionDays("");
    setFormError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    const parsedExtension = extensionDays.trim() ? Number(extensionDays) : undefined;

    if (!editing && !trimmedDescription) {
      setFormError("Describe the problem clearly before reporting it.");
      return;
    }
    if (editing && nextStatus === "RESOLVED" && !resolutionNotes.trim()) {
      setFormError("Explain how the blocker was resolved before closing it.");
      return;
    }
    if (
      editing &&
      nextStatus === "RESOLVED" &&
      parsedExtension !== undefined &&
      (!Number.isInteger(parsedExtension) || parsedExtension < 1)
    ) {
      setFormError("Deadline extension must be a whole number of days, starting at 1.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (editing) {
        await blockersApi.update(project.id, editing.id, {
          description: trimmedDescription,
          severity,
          reasonId: reasonId || undefined,
          status: nextStatus === ALL_VALUE ? undefined : nextStatus,
          assignedToId: assignedToId || undefined,
          ...(nextStatus === "RESOLVED" ? { resolutionNotes: resolutionNotes.trim() } : {}),
          ...(nextStatus === "RESOLVED" && parsedExtension !== undefined
            ? { deadlineExtensionDays: parsedExtension }
            : {}),
        });
        toast.success(nextStatus === "RESOLVED" ? "Blocker resolved" : "Blocker updated");
      } else {
        await blockersApi.create(project.id, {
          description: trimmedDescription,
          severity,
          reasonId: reasonId || undefined,
        });
        toast.success("Blocker reported", {
          description: "The project timeline now includes this blocker.",
        });
      }
      setIsCreateOpen(false);
      setEditing(null);
      if (page === 1) await loadBlockers(true);
      else setPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save blocker.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newReasonName.trim();
    if (!name) return;
    setIsSavingReason(true);
    setReasonError("");
    try {
      const created = await blockersApi.createReason(name);
      setReasons((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewReasonName("");
      toast.success("Blocker reason added");
    } catch (error) {
      setReasonError(error instanceof Error ? error.message : "Unable to add blocker reason.");
    } finally {
      setIsSavingReason(false);
    }
  }

  async function handleRenameReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReason || !editingReasonName.trim()) return;
    setIsSavingReason(true);
    setReasonError("");
    try {
      const updated = await blockersApi.updateReason(editingReason.id, editingReasonName.trim());
      setReasons((current) =>
        current.map((reason) => (reason.id === updated.id ? updated : reason)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingReason(null);
      toast.success("Blocker reason renamed");
    } catch (error) {
      setReasonError(error instanceof Error ? error.message : "Unable to rename blocker reason.");
    } finally {
      setIsSavingReason(false);
    }
  }

  async function handleRemoveReason() {
    if (!removingReason) return;
    setIsRemovingReason(true);
    try {
      await blockersApi.removeReason(removingReason.id);
      setReasons((current) => current.filter((reason) => reason.id !== removingReason.id));
      setRemovingReason(null);
      toast.success("Blocker reason removed");
    } catch (error) {
      setReasonError(error instanceof Error ? error.message : "Unable to remove blocker reason.");
    } finally {
      setIsRemovingReason(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-amber-600" />
            <h2 className="text-lg font-extrabold">Blockers</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
            Track project impediments independently from daily standups. Resolved blockers stay locked as history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageReasons ? (
            <Button variant="outline" onClick={() => { setReasonError(""); setIsReasonsOpen(true); }}>
              <Settings2 size={17} />
              Manage reasons
            </Button>
          ) : null}
          {canReport ? (
            <Button onClick={openCreate}>
              <Plus size={17} />
              Report blocker
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="text-xs font-extrabold uppercase text-muted-foreground">Matching blockers</div>
          <div className="mt-1 text-2xl font-extrabold">{totalBlockers}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">
            {activeBlockers.length} active on this page
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="text-xs font-extrabold uppercase text-muted-foreground">Resolved</div>
          <div className="mt-1 text-2xl font-extrabold">{impact?.resolvedCount ?? 0}</div>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="text-xs font-extrabold uppercase text-muted-foreground">Deadline impact</div>
          <div className="mt-1 text-2xl font-extrabold">{impact?.totalDeadlineExtensionDays ?? 0}d</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">{impact?.blockersWithExtension ?? 0} blocker(s) extended the deadline</div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={(value) => { setPage(1); setStatusFilter(value as BlockerStatus | typeof ALL_VALUE); }}>
          <SelectTrigger className="sm:max-w-52"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(value) => { setPage(1); setSeverityFilter(value as BlockerSeverity | typeof ALL_VALUE); }}>
          <SelectTrigger className="sm:max-w-52"><SelectValue placeholder="All severities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All severities</SelectItem>
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={isRefreshing} onClick={() => void loadBlockers(true)}>
          {isRefreshing ? <Loader2 size={17} className="animate-spin" /> : <Clock3 size={17} />}
          Refresh
        </Button>
      </div>

      {loadError ? <Alert className="mt-4" variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert> : null}
      {isLoading ? (
        <div className="mt-4 space-y-3"><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div>
      ) : blockers.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-border p-8 text-center">
          <AlertTriangle className="mx-auto text-muted-foreground" size={28} />
          <div className="mt-3 font-extrabold">No blockers match these filters</div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Report a blocker as soon as work is waiting on an input, fix, approval, or decision.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {blockers.map((blocker) => (
            <article key={blocker.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONES[blocker.status]}>{STATUS_LABELS[blocker.status]}</Badge>
                    <Badge tone={severityTone(blocker.severity)}>{SEVERITY_LABELS[blocker.severity]}</Badge>
                    <Badge>{blocker.reason?.name || "Unspecified"}</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-6">{blocker.description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
                    <span>Reported by {personName(blocker.reportedBy)}</span>
                    <span>{formatDateTime(blocker.createdAt)}</span>
                    <span>{blocker.status === "RESOLVED" ? `Resolved in ${formatMinutes(blocker.resolutionTime)}` : `${blocker.daysOpen ?? 0} day(s) open`}</span>
                  </div>
                  {blocker.assignedTo ? <div className="mt-2 text-xs font-bold text-muted-foreground">Assigned to {personName(blocker.assignedTo)}</div> : null}
                  {blocker.status === "RESOLVED" && blocker.resolutionNotes ? <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm font-semibold leading-5 dark:border-emerald-950 dark:bg-emerald-950/20"><div className="font-extrabold">Resolution</div>{blocker.resolutionNotes}</div> : null}
                </div>
                {blocker.status !== "RESOLVED" ? (
                  <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                    {blocker.status === "OPEN" ? <Button variant="secondary" onClick={() => openEdit(blocker, "IN_PROGRESS")}><Clock3 size={16} />Start work</Button> : null}
                    {blocker.status === "IN_PROGRESS" ? <Button variant="secondary" onClick={() => openEdit(blocker, "RESOLVED")}><CheckCircle2 size={16} />Resolve</Button> : null}
                    <Button variant="outline" onClick={() => openEdit(blocker)}><Pencil size={16} />Edit</Button>
                  </div>
                ) : <Badge tone="success" className="h-fit"><CheckCircle2 size={14} />Locked history</Badge>}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5">
        <PaginationControls
          page={page}
          total={totalBlockers}
          pageSize={10}
          disabled={isLoading || isRefreshing}
          onPageChange={setPage}
        />
      </div>

      <Dialog open={isCreateOpen || Boolean(editing)} onOpenChange={(open) => { if (!open && !isSaving) { setIsCreateOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Update blocker" : "Report a blocker"}</DialogTitle>
            <DialogDescription>{editing ? "Move the blocker forward, change its context, or assign it to an active team member." : "Record the problem and any useful context as text. File attachments are not supported."}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2"><label className="text-sm font-bold">What is blocking the work?</label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the problem, what is waiting, and any supporting links." rows={5} disabled={Boolean(editing?.status === "RESOLVED")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><label className="text-sm font-bold">Severity</label><Select value={severity} onValueChange={(value) => setSeverity(value as BlockerSeverity)} disabled={Boolean(editing?.status === "RESOLVED")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SEVERITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><label className="text-sm font-bold">Reason</label><Select value={reasonId || ALL_VALUE} onValueChange={(value) => setReasonId(value === ALL_VALUE ? "" : value)} disabled={Boolean(editing?.status === "RESOLVED")}><SelectTrigger><SelectValue placeholder="Unspecified" /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>Unspecified</SelectItem>{reasons.map((reason) => <SelectItem key={reason.id} value={reason.id}>{reason.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {editing ? <>
              <div className="space-y-2"><label className="text-sm font-bold">Status</label><Select value={nextStatus} onValueChange={(value) => { setNextStatus(value as BlockerStatus); if (value !== "RESOLVED") { setResolutionNotes(""); setExtensionDays(""); } }} disabled={editing.status === "RESOLVED"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{editing.status === "OPEN" ? <SelectItem value="OPEN">Open</SelectItem> : null}{editing.status !== "RESOLVED" ? <SelectItem value="IN_PROGRESS">In progress</SelectItem> : null}<SelectItem value="RESOLVED">Resolved</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><label className="text-sm font-bold">Assigned to <span className="font-medium text-muted-foreground">(optional)</span></label><Select value={assignedToId || ALL_VALUE} onValueChange={(value) => setAssignedToId(value === ALL_VALUE ? "" : value)} disabled={editing.status === "RESOLVED"}><SelectTrigger><SelectValue placeholder="No assignee" /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>No explicit assignee</SelectItem>{assignableMembers.map((member) => <SelectItem key={member.userId} value={member.userId}>{displayName(member)}</SelectItem>)}</SelectContent></Select></div>
              {nextStatus === "RESOLVED" ? <div className="space-y-4 rounded-md border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-950 dark:bg-emerald-950/20"><div className="space-y-2"><label className="text-sm font-bold">Resolution explanation</label><Textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} placeholder="Explain how the blocker was addressed." rows={3} /></div><div className="space-y-2"><label className="text-sm font-bold">Extend deadline by days <span className="font-medium text-muted-foreground">(optional)</span></label><Input type="number" min={1} step={1} value={extensionDays} onChange={(event) => setExtensionDays(event.target.value)} placeholder="e.g. 2" /></div></div> : null}
            </> : null}
            {formError ? <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert> : null}
            <DialogFooter><Button type="button" variant="outline" disabled={isSaving} onClick={() => { setIsCreateOpen(false); setEditing(null); }}>Cancel</Button><Button type="submit" disabled={isSaving || editing?.status === "RESOLVED"}>{isSaving ? <Loader2 size={17} className="animate-spin" /> : editing ? <Pencil size={17} /> : <Plus size={17} />}{isSaving ? "Saving..." : editing ? "Save changes" : "Report blocker"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isReasonsOpen} onOpenChange={(open) => { if (!open && !isSavingReason) setIsReasonsOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage blocker reasons</DialogTitle><DialogDescription>Reasons are shared across projects. The default Unspecified reason is protected.</DialogDescription></DialogHeader>
          <form className="flex gap-2" onSubmit={handleCreateReason}><Input value={newReasonName} onChange={(event) => setNewReasonName(event.target.value)} placeholder="New reason, e.g. Client input" /><Button type="submit" disabled={isSavingReason || !newReasonName.trim()}><Plus size={16} />Add</Button></form>
          <div className="max-h-64 space-y-2 overflow-y-auto">{reasons.map((reason) => <div key={reason.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span className="text-sm font-bold">{reason.name}</span>{reason.name === "Unspecified" ? <Badge>Default</Badge> : <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => { setEditingReason(reason); setEditingReasonName(reason.name); }}><Pencil size={15} /></Button><Button variant="ghost" size="sm" onClick={() => setRemovingReason(reason)}><Trash2 size={15} className="text-red-600" /></Button></div>}</div>)}</div>
          {reasonError ? <Alert variant="destructive"><AlertDescription>{reasonError}</AlertDescription></Alert> : null}
          {editingReason ? <form className="space-y-3 rounded-md border border-border bg-muted/30 p-3" onSubmit={handleRenameReason}><label className="text-sm font-bold">Rename {editingReason.name}</label><Input value={editingReasonName} onChange={(event) => setEditingReasonName(event.target.value)} /><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setEditingReason(null)}>Cancel</Button><Button type="submit" disabled={isSavingReason || !editingReasonName.trim()}>Save name</Button></div></form> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removingReason)} onOpenChange={(open) => { if (!open && !isRemovingReason) setRemovingReason(null); }}><DialogContent><DialogHeader><DialogTitle>Remove blocker reason?</DialogTitle><DialogDescription>Existing blockers keep this reason in their history. It will only be removed from future selections.</DialogDescription></DialogHeader><div className="rounded-md border border-border bg-muted p-4 font-bold">{removingReason?.name}</div><DialogFooter><Button variant="outline" disabled={isRemovingReason} onClick={() => setRemovingReason(null)}>Cancel</Button><Button className="bg-red-600 text-white hover:bg-red-700" disabled={isRemovingReason} onClick={() => void handleRemoveReason()}>{isRemovingReason ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}Remove reason</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}

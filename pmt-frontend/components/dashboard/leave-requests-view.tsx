"use client";

import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { LeaveSummaryReport } from "@/components/dashboard/leave-summary-report";
import {
  leaveApi,
  type CreateLeaveRequestInput,
  type Holiday,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
  type UpsertHolidayInput,
  type UpsertLeaveTypeInput,
} from "@/lib/api/leave";
import { userStore } from "@/lib/api/user-store";
import { roleLabels } from "@/lib/auth-meta";

const employeeRoles = new Set([
  "SYSTEM_ADMIN",
  "ADMIN",
  "PROJECT_MANAGER",
  "DESIGNER",
  "DEVELOPER",
]);
const reviewerRoles = new Set(["SYSTEM_ADMIN", "ADMIN", "PROJECT_MANAGER"]);
const adminEquivalentRoles = new Set(["SYSTEM_ADMIN", "ADMIN"]);
const leaveStatuses: Array<LeaveStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];
type DecisionAction = "approve" | "reject" | null;

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatRequestedDate(value?: string | null) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function inclusiveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function statusTone(status: LeaveStatus) {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  return "default";
}

function upsertRequest(list: LeaveRequest[], request: LeaveRequest) {
  return list.some((item) => item.id === request.id)
    ? list.map((item) => (item.id === request.id ? { ...item, ...request } : item))
    : [request, ...list];
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof CalendarCheck;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon size={21} />
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceCards({ balances }: { balances: LeaveBalance[] }) {
  if (!balances.length) {
    return (
      <Alert>
        <AlertTitle>No leave balance yet</AlertTitle>
        <AlertDescription>
          Leave balances appear after leave types are configured by an admin.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {balances.map((balance) => {
        const usedPercent =
          balance.allocatedDays > 0
            ? Math.min(100, Math.round((balance.usedDays / balance.allocatedDays) * 100))
            : 0;

        return (
          <Card key={balance.leaveType.id}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{balance.leaveType.name}</CardTitle>
                  <CardDescription>
                    {balance.remainingDays} of {balance.allocatedDays} days remaining
                  </CardDescription>
                </div>
                <Badge tone={balance.remainingDays > 0 ? "success" : "warning"}>
                  {balance.usedDays} used
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EmptyRequests({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 py-8 text-center">
      <FileText size={32} className="text-muted-foreground" />
      <p className="mt-3 text-sm font-extrabold">{label}</p>
      <p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">
        New requests will appear here as soon as they are submitted.
      </p>
    </div>
  );
}

function RequestTable({
  requests,
  emptyLabel,
  showRequester = false,
  currentUserId,
  canApprove = false,
  canInspectBalance = false,
  actionLoadingId,
  onCancel,
  onOpenReview,
}: {
  requests: LeaveRequest[];
  emptyLabel: string;
  showRequester?: boolean;
  currentUserId?: string;
  canApprove?: boolean;
  canInspectBalance?: boolean;
  actionLoadingId: string;
  onCancel?: (request: LeaveRequest) => void;
  onOpenReview?: (request: LeaveRequest) => void;
}) {
  if (!requests.length) return <EmptyRequests label={emptyLabel} />;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] border-collapse text-left">
          <thead className="bg-muted text-sm font-extrabold text-muted-foreground">
            <tr>
              {showRequester ? <th className="px-5 py-4">Requester</th> : null}
              <th className="px-5 py-4">Leave type</th>
              <th className="px-5 py-4">Dates</th>
              <th className="px-5 py-4">Days</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Reason</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((request) => {
              const canCancel =
                request.status === "PENDING" &&
                request.userId === currentUserId &&
                Boolean(onCancel);
              const canReview =
                canInspectBalance && Boolean(onOpenReview) && Boolean(request.userId);

              return (
                <tr key={request.id} className="hover:bg-muted/50">
                  {showRequester ? (
                    <td className="px-5 py-4">
                      <div className="font-extrabold">
                        {request.user?.name ?? "Unknown user"}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {request.user?.email ?? "No email"}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-5 py-4">
                    <div className="font-extrabold">
                      {request.leaveType?.name ?? "Leave"}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Requested {formatRequestedDate(request.createdAt)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </td>
                  <td className="px-5 py-4">
                    <Badge>{request.days} days</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={statusTone(request.status)}>{request.status}</Badge>
                  </td>
                  <td className="max-w-72 px-5 py-4 text-sm font-medium text-muted-foreground">
                    <span className="line-clamp-2">{request.reason || "No reason added"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {canCancel ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === request.id}
                          onClick={() => onCancel?.(request)}
                        >
                          <XCircle size={16} />
                          Cancel
                        </Button>
                      ) : null}
                      {canReview ? (
                        <Button
                          size="sm"
                          variant={canApprove && request.status === "PENDING" ? "default" : "outline"}
                          disabled={actionLoadingId === request.id}
                          onClick={() => onOpenReview?.(request)}
                        >
                          <ShieldCheck size={16} />
                          {canApprove && request.status === "PENDING"
                            ? "Review"
                            : "View balance"}
                        </Button>
                      ) : null}
                      {!canCancel && !canReview ? (
                        <span className="text-sm font-semibold text-muted-foreground">
                          No action
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-5 w-96 max-w-full" />
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function LeaveTypeManagement({
  leaveTypes,
  isSaving,
  deletingTypeId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  leaveTypes: LeaveType[];
  isSaving: boolean;
  deletingTypeId: string;
  onCreate: (input: UpsertLeaveTypeInput) => Promise<boolean>;
  onUpdate: (leaveTypeId: string, input: UpsertLeaveTypeInput) => Promise<boolean>;
  onDelete: (leaveType: LeaveType) => Promise<boolean>;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [deletingType, setDeletingType] = useState<LeaveType | null>(null);
  const [name, setName] = useState("");
  const [defaultDays, setDefaultDays] = useState("0");
  const parsedDefaultDays = Number(defaultDays);
  const hasValidDefaultDays =
    Number.isInteger(parsedDefaultDays) && parsedDefaultDays >= 0;
  const canSubmit = name.trim().length > 0 && hasValidDefaultDays && !isSaving;

  function openCreateDialog() {
    setEditingType(null);
    setName("");
    setDefaultDays("15");
    setIsDialogOpen(true);
  }

  function openEditDialog(leaveType: LeaveType) {
    setEditingType(leaveType);
    setName(leaveType.name);
    setDefaultDays(String(leaveType.defaultDaysPerYear));
    setIsDialogOpen(true);
  }

  async function submitLeaveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const input = {
      name: name.trim(),
      defaultDaysPerYear: parsedDefaultDays,
    };

    const saved = editingType
      ? await onUpdate(editingType.id, input)
      : await onCreate(input);
    if (!saved) return;

    setIsDialogOpen(false);
    setEditingType(null);
    setName("");
    setDefaultDays("0");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">Leave policy</h2>
            <Badge tone="primary">{leaveTypes.length} types</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-muted-foreground">
            Maintain the leave categories employees can request and the default yearly
            allocation used when balances are created.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus size={17} />
          Add leave type
        </Button>
      </div>

      {leaveTypes.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-muted text-sm font-extrabold text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Leave type</th>
                  <th className="px-5 py-4">Default allocation</th>
                  <th className="px-5 py-4">Updated</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaveTypes.map((leaveType) => (
                  <tr key={leaveType.id} className="hover:bg-muted/50">
                    <td className="px-5 py-4">
                      <div className="font-extrabold">{leaveType.name}</div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Available in request forms and balance cards.
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge>{leaveType.defaultDaysPerYear} days/year</Badge>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                      {formatDate(leaveType.updatedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving || Boolean(deletingTypeId)}
                          onClick={() => openEditDialog(leaveType)}
                        >
                          <Pencil size={16} />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving || Boolean(deletingTypeId)}
                          onClick={() => setDeletingType(leaveType)}
                        >
                          <Trash2 size={16} />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 py-8 text-center">
          <CalendarCheck size={32} className="text-muted-foreground" />
          <p className="mt-3 text-sm font-extrabold">No leave types configured</p>
          <p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">
            Add at least one leave type before employees can submit leave requests.
          </p>
          <Button className="mt-5" onClick={openCreateDialog}>
            <Plus size={17} />
            Add leave type
          </Button>
        </div>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingType(null);
            setName("");
            setDefaultDays("0");
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitLeaveType}>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit leave type" : "Add leave type"}
              </DialogTitle>
              <DialogDescription>
                Use a clear policy name and a non-negative yearly day allocation.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="leave-type-name">
                  Name
                </label>
                <Input
                  id="leave-type-name"
                  value={name}
                  required
                  placeholder="Annual Leave"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="default-days">
                  Default days per year
                </label>
                <Input
                  id="default-days"
                  type="number"
                  min={0}
                  step={1}
                  value={defaultDays}
                  required
                  onChange={(event) => setDefaultDays(event.target.value)}
                />
                {!hasValidDefaultDays ? (
                  <p className="text-sm font-semibold text-red-600 dark:text-red-300">
                    Enter a whole number of days, zero or greater.
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <CalendarCheck size={17} />
                {isSaving ? "Saving..." : editingType ? "Save changes" : "Create type"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingType)}
        onOpenChange={(open) => {
          if (!open) setDeletingType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete leave type</DialogTitle>
            <DialogDescription>
              This removes the type from future leave requests. Existing requests may prevent
              deletion if the backend still references this policy.
            </DialogDescription>
          </DialogHeader>
          {deletingType ? (
            <Alert variant="warning">
              <AlertDescription>
                You are deleting <strong>{deletingType.name}</strong>, currently configured
                for {deletingType.defaultDaysPerYear} days per year.
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingType(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!deletingType || deletingTypeId === deletingType?.id}
              onClick={() => {
                if (!deletingType) return;
                void onDelete(deletingType).then((deleted) => {
                  if (deleted) setDeletingType(null);
                });
              }}
            >
              <Trash2 size={17} />
              {deletingTypeId ? "Deleting..." : "Delete type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function HolidayManagement({
  holidays,
  canManage,
  isSaving,
  deletingHolidayId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  holidays: Holiday[];
  canManage: boolean;
  isSaving: boolean;
  deletingHolidayId: string;
  onCreate: (input: UpsertHolidayInput) => Promise<boolean>;
  onUpdate: (holidayId: string, input: UpsertHolidayInput) => Promise<boolean>;
  onDelete: (holiday: Holiday) => Promise<boolean>;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const effectiveEndDate = endDate || startDate;
  const rangeDays = inclusiveDays(startDate, effectiveEndDate);
  const hasValidRange = Boolean(startDate && effectiveEndDate && rangeDays > 0);
  const canSubmit = name.trim().length > 0 && hasValidRange && !isSaving;
  const upcomingHolidays = holidays.filter((holiday) => {
    const end = new Date(holiday.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end >= today;
  });

  function resetForm() {
    setEditingHoliday(null);
    setName("");
    setStartDate("");
    setEndDate("");
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(holiday: Holiday) {
    setEditingHoliday(holiday);
    setName(holiday.name);
    setStartDate(toDateInputValue(holiday.startDate));
    setEndDate(toDateInputValue(holiday.endDate));
    setIsDialogOpen(true);
  }

  async function submitHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const input: UpsertHolidayInput = {
      name: name.trim(),
      startDate,
      endDate: effectiveEndDate,
    };
    const saved = editingHoliday
      ? await onUpdate(editingHoliday.id, input)
      : await onCreate(input);
    if (!saved) return;

    setIsDialogOpen(false);
    resetForm();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight">Company holidays</h2>
            <Badge tone={upcomingHolidays.length ? "primary" : "default"}>
              {upcomingHolidays.length} upcoming
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-muted-foreground">
            Keep team-wide holidays visible beside leave planning so requests can be
            reviewed with calendar context.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreateDialog}>
            <Plus size={17} />
            Add holiday
          </Button>
        ) : null}
      </div>

      {holidays.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="bg-muted text-sm font-extrabold text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Holiday</th>
                  <th className="px-5 py-4">Date range</th>
                  <th className="px-5 py-4">Duration</th>
                  <th className="px-5 py-4">Status</th>
                  {canManage ? <th className="px-5 py-4 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holidays.map((holiday) => {
                  const isUpcoming = upcomingHolidays.some((item) => item.id === holiday.id);
                  return (
                    <tr key={holiday.id} className="hover:bg-muted/50">
                      <td className="px-5 py-4">
                        <div className="font-extrabold">{holiday.name}</div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Updated {formatDate(holiday.updatedAt)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                        {formatDate(holiday.startDate)} - {formatDate(holiday.endDate)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge>{holiday.days} day{holiday.days === 1 ? "" : "s"}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={isUpcoming ? "success" : "default"}>
                          {isUpcoming ? "Upcoming" : "Past"}
                        </Badge>
                      </td>
                      {canManage ? (
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSaving || Boolean(deletingHolidayId)}
                              onClick={() => openEditDialog(holiday)}
                            >
                              <Pencil size={16} />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSaving || Boolean(deletingHolidayId)}
                              onClick={() => setDeletingHoliday(holiday)}
                            >
                              <Trash2 size={16} />
                              Delete
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 py-8 text-center">
          <CalendarDays size={32} className="text-muted-foreground" />
          <p className="mt-3 text-sm font-extrabold">No company holidays yet</p>
          <p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">
            Holidays added by admins will appear here for everyone planning leave.
          </p>
          {canManage ? (
            <Button className="mt-5" onClick={openCreateDialog}>
              <Plus size={17} />
              Add holiday
            </Button>
          ) : null}
        </div>
      )}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <form onSubmit={submitHoliday}>
            <DialogHeader>
              <DialogTitle>
                {editingHoliday ? "Edit company holiday" : "Add company holiday"}
              </DialogTitle>
              <DialogDescription>
                Use YYYY-MM-DD dates. Leave end date equal to start date for a single-day
                holiday.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="holiday-name">
                  Holiday name
                </label>
                <Input
                  id="holiday-name"
                  value={name}
                  required
                  placeholder="Eid-ul-Fitr"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold" htmlFor="holiday-start-date">
                    Start date
                  </label>
                  <Input
                    id="holiday-start-date"
                    type="date"
                    value={startDate}
                    required
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setStartDate(nextStart);
                      if (endDate && endDate < nextStart) setEndDate(nextStart);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold" htmlFor="holiday-end-date">
                    End date
                  </label>
                  <Input
                    id="holiday-end-date"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    placeholder={startDate || "YYYY-MM-DD"}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm font-semibold">
                Duration: {rangeDays || 0} day{rangeDays === 1 ? "" : "s"}
              </div>
              {!hasValidRange ? (
                <Alert variant="warning">
                  <AlertDescription>
                    Choose a valid start date and ensure the end date is not before it.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <CalendarDays size={17} />
                {isSaving ? "Saving..." : editingHoliday ? "Save changes" : "Create holiday"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingHoliday)}
        onOpenChange={(open) => {
          if (!open) setDeletingHoliday(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete company holiday</DialogTitle>
            <DialogDescription>
              This removes the holiday from the company calendar used for leave planning.
            </DialogDescription>
          </DialogHeader>
          {deletingHoliday ? (
            <Alert variant="warning">
              <AlertDescription>
                You are deleting <strong>{deletingHoliday.name}</strong>, scheduled for{" "}
                {formatDate(deletingHoliday.startDate)} - {formatDate(deletingHoliday.endDate)}.
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingHoliday(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!deletingHoliday || deletingHolidayId === deletingHoliday?.id}
              onClick={() => {
                if (!deletingHoliday) return;
                void onDelete(deletingHoliday).then((deleted) => {
                  if (deleted) setDeletingHoliday(null);
                });
              }}
            >
              <Trash2 size={17} />
              {deletingHolidayId ? "Deleting..." : "Delete holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReviewRequestDialog({
  request,
  balances,
  isLoadingBalance,
  balanceError,
  rejectReason,
  actionLoadingId,
  decisionAction,
  canDecide,
  onRejectReasonChange,
  onClose,
  onApprove,
  onReject,
}: {
  request: LeaveRequest | null;
  balances: LeaveBalance[];
  isLoadingBalance: boolean;
  balanceError: string;
  rejectReason: string;
  actionLoadingId: string;
  decisionAction: DecisionAction;
  canDecide: boolean;
  onRejectReasonChange: (reason: string) => void;
  onClose: () => void;
  onApprove: (request: LeaveRequest) => void;
  onReject: (request: LeaveRequest) => void;
}) {
  const requestedBalance = request
    ? balances.find((balance) => balance.leaveType.id === request.leaveTypeId)
    : null;
  const isPending = request?.status === "PENDING";
  const canAct = Boolean(request && canDecide && isPending);
  const isOverBalance = Boolean(
    request && requestedBalance && request.days > requestedBalance.remainingDays,
  );
  const isActingOnRequest = actionLoadingId === request?.id;
  const isApproving = isActingOnRequest && decisionAction === "approve";
  const isRejecting = isActingOnRequest && decisionAction === "reject";

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>Review leave request</DialogTitle>
              <DialogDescription>
                Check the requester&apos;s current balance before approving or rejecting.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-[1fr_280px]">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    {request.user?.name ?? "Unknown requester"}
                  </CardTitle>
                  <CardDescription>
                    {request.user?.email ?? "No email"} ·{" "}
                    {request.user?.role ? roleLabels[request.user.role] : "Team member"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/40 p-3">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                        Leave type
                      </p>
                      <p className="mt-1 font-extrabold">
                        {request.leaveType?.name ?? "Leave"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 p-3">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                        Requested
                      </p>
                      <p className="mt-1 font-extrabold">{request.days} days</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/40 p-3 sm:col-span-2">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                        Dates
                      </p>
                      <p className="mt-1 font-extrabold">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">Reason</p>
                    <p className="mt-1 rounded-md border border-border bg-muted/40 p-3 text-sm font-medium leading-6 text-muted-foreground">
                      {request.reason || "No reason added"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Relevant balance</CardTitle>
                  <CardDescription>Current year allowance</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBalance ? (
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ) : balanceError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{balanceError}</AlertDescription>
                    </Alert>
                  ) : requestedBalance ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs font-bold text-muted-foreground">Allocated</p>
                          <p className="mt-1 text-lg font-extrabold">
                            {requestedBalance.allocatedDays}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs font-bold text-muted-foreground">Used</p>
                          <p className="mt-1 text-lg font-extrabold">
                            {requestedBalance.usedDays}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted p-3">
                          <p className="text-xs font-bold text-muted-foreground">Left</p>
                          <p className="mt-1 text-lg font-extrabold">
                            {requestedBalance.remainingDays}
                          </p>
                        </div>
                      </div>
                      {isOverBalance ? (
                        <Alert variant="warning">
                          <AlertDescription>
                            This request is {request.days - requestedBalance.remainingDays} days
                            over the remaining {request.leaveType?.name ?? "leave"} balance.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert variant="success">
                          <AlertDescription>
                            The request fits within the current remaining balance.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <Alert variant="warning">
                      <AlertDescription>
                        No matching balance was returned for this leave type.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {balances.length && !isLoadingBalance && !balanceError ? (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-extrabold">All balances</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead className="bg-muted text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Allocated</th>
                        <th className="px-4 py-3">Used</th>
                        <th className="px-4 py-3">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {balances.map((balance) => (
                        <tr key={balance.leaveType.id}>
                          <td className="px-4 py-3 text-sm font-bold">
                            {balance.leaveType.name}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-muted-foreground">
                            {balance.allocatedDays}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-muted-foreground">
                            {balance.usedDays}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={balance.remainingDays > 0 ? "success" : "warning"}>
                              {balance.remainingDays}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {canAct ? (
              <div className="space-y-2">
                <label className="text-sm font-bold" htmlFor="decision-reason">
                  Rejection reason
                </label>
                <Textarea
                  id="decision-reason"
                  value={rejectReason}
                  placeholder="Optional note for rejecting this request"
                  onChange={(event) => onRejectReasonChange(event.target.value)}
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              {canAct ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isActingOnRequest}
                    onClick={() => onReject(request)}
                  >
                    <XCircle size={17} />
                    {isRejecting ? "Rejecting..." : "Reject"}
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      isActingOnRequest || isLoadingBalance || Boolean(balanceError)
                    }
                    onClick={() => onApprove(request)}
                  >
                    <CheckCircle2 size={17} />
                    {isApproving ? "Approving..." : "Approve"}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function LeaveRequestsView() {
  const { currentUser, authStatus } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [ownRequests, setOwnRequests] = useState<LeaveRequest[]>([]);
  const [reviewRequests, setReviewRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<LeaveStatus | "ALL">("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingLeaveType, setIsSavingLeaveType] = useState(false);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [decisionAction, setDecisionAction] = useState<DecisionAction>(null);
  const [deletingLeaveTypeId, setDeletingLeaveTypeId] = useState("");
  const [deletingHolidayId, setDeletingHolidayId] = useState("");
  const [error, setError] = useState("");
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reviewingRequest, setReviewingRequest] = useState<LeaveRequest | null>(null);
  const [reviewBalances, setReviewBalances] = useState<LeaveBalance[]>([]);
  const [isLoadingReviewBalance, setIsLoadingReviewBalance] = useState(false);
  const [reviewBalanceError, setReviewBalanceError] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const canUseLeave = Boolean(currentUser && employeeRoles.has(currentUser.role));
  const canReview = Boolean(currentUser && reviewerRoles.has(currentUser.role));
  const canApprove = Boolean(
    currentUser && adminEquivalentRoles.has(currentUser.role),
  );

  const loadLeaveData = useCallback(async () => {
    if (!currentUser || !employeeRoles.has(currentUser.role)) return;

    setError("");
    setIsLoading(true);

    try {
      const [types, holidayList, own, balance, review] = await Promise.all([
        leaveApi.listTypes(),
        leaveApi.listHolidays(),
        leaveApi.listOwnRequests(),
        leaveApi.listOwnBalance(),
        reviewerRoles.has(currentUser.role)
          ? leaveApi.listRequestsForReview()
          : Promise.resolve([]),
      ]);
      setLeaveTypes(types);
      setHolidays(holidayList);
      setOwnRequests(own);
      setBalances(balance);
      setReviewRequests(review);
      setSelectedLeaveTypeId((current) =>
        types.some((type) => type.id === current) ? current : types[0]?.id || "",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load leave data.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authStatus === "idle") {
      void userStore.loadCurrentUser();
    }
  }, [authStatus]);

  useEffect(() => {
    void Promise.resolve().then(loadLeaveData);
  }, [loadLeaveData]);

  const filteredOwnRequests = useMemo(
    () =>
      statusFilter === "ALL"
        ? ownRequests
        : ownRequests.filter((request) => request.status === statusFilter),
    [ownRequests, statusFilter],
  );

  const filteredReviewRequests = useMemo(
    () =>
      reviewStatusFilter === "ALL"
        ? reviewRequests
        : reviewRequests.filter((request) => request.status === reviewStatusFilter),
    [reviewRequests, reviewStatusFilter],
  );

  const pendingOwnCount = ownRequests.filter((request) => request.status === "PENDING").length;
  const approvedOwnDays = ownRequests
    .filter((request) => request.status === "APPROVED")
    .reduce((sum, request) => sum + request.days, 0);
  const remainingDays = balances.reduce((sum, balance) => sum + balance.remainingDays, 0);
  const pendingReviewCount = reviewRequests.filter(
    (request) => request.status === "PENDING",
  ).length;
  const requestedDays = inclusiveDays(startDate, endDate);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) return;

    const formData = new FormData(event.currentTarget);
    const input: CreateLeaveRequestInput = {
      leaveTypeId: selectedLeaveTypeId,
      startDate,
      endDate,
      reason: String(formData.get("reason") ?? "").trim() || undefined,
    };

    if (!input.leaveTypeId) {
      setError("Choose a leave type before submitting.");
      return;
    }
    if (!input.startDate || !input.endDate || requestedDays < 1) {
      setError("Choose a valid leave date range.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const created = await leaveApi.createRequest(input);
      const hydrated = {
        ...created,
        leaveType: leaveTypes.find((type) => type.id === input.leaveTypeId),
        user: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        },
      };
      setOwnRequests((current) => upsertRequest(current, hydrated));
      setReviewRequests((current) => (canReview ? upsertRequest(current, hydrated) : current));
      setIsRequestDialogOpen(false);
      setStartDate("");
      setEndDate("");
      toast.success("Leave request submitted", {
        description: "Your request is now pending review.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to submit leave request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelRequest(request: LeaveRequest) {
    setActionLoadingId(request.id);
    setError("");

    try {
      const updated = await leaveApi.cancelRequest(request.id);
      const hydrated = { ...request, ...updated, leaveType: request.leaveType };
      setOwnRequests((current) => upsertRequest(current, hydrated));
      setReviewRequests((current) => upsertRequest(current, hydrated));
      toast.success("Leave request cancelled", {
        description: "The pending request was moved to cancelled.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to cancel request.");
    } finally {
      setActionLoadingId("");
    }
  }

  async function approveRequest(request: LeaveRequest) {
    setActionLoadingId(request.id);
    setDecisionAction("approve");
    setError("");

    try {
      await leaveApi.approveRequest(request.id);
      toast.success("Leave approved", {
        description: `${request.user?.name ?? "The requester"} has been notified by status.`,
      });
      closeReviewDialog();
      await loadLeaveData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to approve request.");
    } finally {
      setActionLoadingId("");
      setDecisionAction(null);
    }
  }

  async function rejectRequest(request: LeaveRequest) {
    setActionLoadingId(request.id);
    setDecisionAction("reject");
    setError("");

    try {
      await leaveApi.rejectRequest(request.id, rejectReason.trim() || undefined);
      toast.success("Leave rejected", {
        description: "The request has been marked as rejected.",
      });
      closeReviewDialog();
      await loadLeaveData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to reject request.");
    } finally {
      setActionLoadingId("");
      setDecisionAction(null);
    }
  }

  function closeReviewDialog() {
    setReviewingRequest(null);
    setReviewBalances([]);
    setIsLoadingReviewBalance(false);
    setReviewBalanceError("");
    setRejectReason("");
    setDecisionAction(null);
  }

  async function openReviewDialog(request: LeaveRequest) {
    setReviewingRequest(request);
    setReviewBalances([]);
    setReviewBalanceError("");
    setRejectReason("");
    setIsLoadingReviewBalance(true);

    try {
      const requesterBalances = await leaveApi.listBalanceForUser(request.userId);
      setReviewBalances(requesterBalances);
    } catch (error) {
      setReviewBalanceError(
        error instanceof Error ? error.message : "Unable to load requester balance.",
      );
    } finally {
      setIsLoadingReviewBalance(false);
    }
  }

  async function createLeaveType(input: UpsertLeaveTypeInput) {
    setIsSavingLeaveType(true);
    setError("");

    try {
      await leaveApi.createType(input);
      toast.success("Leave type created", {
        description: `${input.name} is now available for leave requests.`,
      });
      await loadLeaveData();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create leave type.");
      return false;
    } finally {
      setIsSavingLeaveType(false);
    }
  }

  async function updateLeaveType(leaveTypeId: string, input: UpsertLeaveTypeInput) {
    setIsSavingLeaveType(true);
    setError("");

    try {
      await leaveApi.updateType(leaveTypeId, input);
      toast.success("Leave type updated", {
        description: `${input.name} policy details were saved.`,
      });
      await loadLeaveData();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update leave type.");
      return false;
    } finally {
      setIsSavingLeaveType(false);
    }
  }

  async function deleteLeaveType(leaveType: LeaveType) {
    setDeletingLeaveTypeId(leaveType.id);
    setError("");

    try {
      await leaveApi.deleteType(leaveType.id);
      toast.success("Leave type deleted", {
        description: `${leaveType.name} was removed from leave policy.`,
      });
      await loadLeaveData();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete leave type.");
      return false;
    } finally {
      setDeletingLeaveTypeId("");
    }
  }

  async function createHoliday(input: UpsertHolidayInput) {
    setIsSavingHoliday(true);
    setError("");

    try {
      await leaveApi.createHoliday(input);
      toast.success("Holiday created", {
        description: `${input.name} was added to the company calendar.`,
      });
      await loadLeaveData();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create holiday.");
      return false;
    } finally {
      setIsSavingHoliday(false);
    }
  }

  async function updateHoliday(holidayId: string, input: UpsertHolidayInput) {
    setIsSavingHoliday(true);
    setError("");

    try {
      await leaveApi.updateHoliday(holidayId, input);
      toast.success("Holiday updated", {
        description: `${input.name} calendar details were saved.`,
      });
      await loadLeaveData();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update holiday.");
      return false;
    } finally {
      setIsSavingHoliday(false);
    }
  }

  async function deleteHoliday(holiday: Holiday) {
    setDeletingHolidayId(holiday.id);
    setError("");

    try {
      await leaveApi.deleteHoliday(holiday.id);
      toast.success("Holiday deleted", {
        description: `${holiday.name} was removed from the company calendar.`,
      });
      await loadLeaveData();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete holiday.");
      return false;
    } finally {
      setDeletingHolidayId("");
    }
  }

  if (!currentUser && (authStatus === "idle" || authStatus === "loading")) {
    return <LoadingState />;
  }

  if (!currentUser || !canUseLeave) {
    return (
      <Alert variant="warning">
        <AlertTitle>Leave is not available for this role</AlertTitle>
        <AlertDescription>
          Leave requests are currently available for admins, project managers, and developers.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight">Leave requests</h1>
              <Badge tone="primary">{roleLabels[currentUser.role]}</Badge>
            </div>
            <p className="mt-2 max-w-3xl text-base font-medium text-muted-foreground">
              Track balances, submit time off, and review pending leave without leaving the
              dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void loadLeaveData()}>
              <RefreshCw size={17} />
              Refresh
            </Button>
            {!adminEquivalentRoles.has(currentUser.role) ? (
              <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!leaveTypes.length}>
                  <Plus size={17} />
                  Request leave
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitRequest}>
                  <DialogHeader>
                    <DialogTitle>Request leave</DialogTitle>
                    <DialogDescription>
                      Submit the date range and reason. Balance is checked when an admin
                      approves the request.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold" htmlFor="leave-type">
                        Leave type
                      </label>
                      <Select
                        value={selectedLeaveTypeId}
                        onValueChange={setSelectedLeaveTypeId}
                      >
                        <SelectTrigger id="leave-type">
                          <SelectValue placeholder="Choose leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-bold" htmlFor="start-date">
                          Start date
                        </label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          required
                          onChange={(event) => setStartDate(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold" htmlFor="end-date">
                          End date
                        </label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          required
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm font-semibold">
                      Requested duration: {requestedDays || 0} day
                      {requestedDays === 1 ? "" : "s"}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold" htmlFor="reason">
                        Reason
                      </label>
                      <Textarea
                        id="reason"
                        name="reason"
                        placeholder="Add context for the reviewer"
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsRequestDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || requestedDays < 1}>
                      <CalendarCheck size={17} />
                      {isSubmitting ? "Submitting..." : "Submit request"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {adminEquivalentRoles.has(currentUser.role) ? <LeaveSummaryReport /> : null}

      {adminEquivalentRoles.has(currentUser.role) ? (
        <LeaveTypeManagement
          leaveTypes={leaveTypes}
          isSaving={isSavingLeaveType}
          deletingTypeId={deletingLeaveTypeId}
          onCreate={createLeaveType}
          onUpdate={updateLeaveType}
          onDelete={deleteLeaveType}
        />
      ) : null}

      <HolidayManagement
        holidays={holidays}
        canManage={adminEquivalentRoles.has(currentUser.role)}
        isSaving={isSavingHoliday}
        deletingHolidayId={deletingHolidayId}
        onCreate={createHoliday}
        onUpdate={updateHoliday}
        onDelete={deleteHoliday}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryMetric label="Remaining days" value={remainingDays} icon={CalendarCheck} />
        <SummaryMetric label="Approved days" value={approvedOwnDays} icon={CheckCircle2} />
        <SummaryMetric label="Pending requests" value={pendingOwnCount} icon={Clock3} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">My balance</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Current year allocation and usage by leave type.
            </p>
          </div>
        </div>
        <BalanceCards balances={balances} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">My requests</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Pending requests can be cancelled until a reviewer acts on them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as LeaveStatus | "ALL")}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {leaveStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "ALL" ? "All statuses" : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <RequestTable
          requests={filteredOwnRequests}
          emptyLabel="No leave requests found"
          currentUserId={currentUser.id}
          actionLoadingId={actionLoadingId}
          onCancel={(request) => void cancelRequest(request)}
        />
      </section>

      {canReview ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-extrabold tracking-tight">Team review</h2>
                <Badge tone={pendingReviewCount ? "warning" : "success"}>
                  {pendingReviewCount} pending
                </Badge>
              </div>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {canApprove
                  ? "Approve or reject pending leave requests."
                  : "Project managers can monitor pending and approved team leave."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-muted-foreground" />
              <Select
                value={reviewStatusFilter}
                onValueChange={(value) =>
                  setReviewStatusFilter(value as LeaveStatus | "ALL")
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Filter review" />
                </SelectTrigger>
                <SelectContent>
                  {leaveStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "ALL" ? "All statuses" : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <RequestTable
            requests={filteredReviewRequests}
            emptyLabel="No team leave requests match this filter"
            showRequester
            currentUserId={currentUser.id}
            canApprove={canApprove}
            canInspectBalance
            actionLoadingId={actionLoadingId}
            onCancel={(request) => void cancelRequest(request)}
            onOpenReview={(request) => void openReviewDialog(request)}
          />
        </section>
      ) : null}

      <ReviewRequestDialog
        request={reviewingRequest}
        balances={reviewBalances}
        isLoadingBalance={isLoadingReviewBalance}
        balanceError={reviewBalanceError}
        rejectReason={rejectReason}
        actionLoadingId={actionLoadingId}
        decisionAction={decisionAction}
        canDecide={canApprove}
        onRejectReasonChange={setRejectReason}
        onClose={closeReviewDialog}
        onApprove={(request) => void approveRequest(request)}
        onReject={(request) => void rejectRequest(request)}
      />
    </div>
  );
}

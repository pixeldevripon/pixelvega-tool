"use client";

import {
  CalendarDays,
  Download,
  FileBarChart,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  leaveApi,
  type LeaveSummaryQuery,
  type LeaveSummaryResponse,
  type LeaveSummaryRole,
} from "@/lib/api/leave";
import { userStore } from "@/lib/api/user-store";

const ALL_VALUE = "ALL";
const reportRoles: LeaveSummaryRole[] = [
  "PROJECT_MANAGER",
  "DEVELOPER",
  "DESIGNER",
];

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatRole(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function LeaveSummaryReport() {
  const { users } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const today = useMemo(() => new Date(), []);
  const initialQuery = useMemo<LeaveSummaryQuery>(
    () => ({
      startDate: `${today.getFullYear()}-01-01`,
      endDate: dateInputValue(today),
      includeDetails: false,
    }),
    [today],
  );
  const [startDate, setStartDate] = useState(initialQuery.startDate ?? "");
  const [endDate, setEndDate] = useState(initialQuery.endDate ?? "");
  const [role, setRole] = useState(ALL_VALUE);
  const [userId, setUserId] = useState(ALL_VALUE);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [appliedQuery, setAppliedQuery] = useState<LeaveSummaryQuery>(initialQuery);
  const [summary, setSummary] = useState<LeaveSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void userStore.loadUsers();
  }, []);

  const reportUsers = useMemo(
    () =>
      (Array.isArray(users) ? users : [])
        .filter((user) => reportRoles.includes(user.role as LeaveSummaryRole))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const loadSummary = useCallback(async (query: LeaveSummaryQuery) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await leaveApi.summary(query);
      setSummary(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the leave summary.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadSummary(initialQuery), 0);
    return () => window.clearTimeout(timeoutId);
  }, [initialQuery, loadSummary]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      setError("The report start date cannot be after the end date.");
      return;
    }
    const nextQuery: LeaveSummaryQuery = {
      startDate,
      endDate,
      role: role === ALL_VALUE ? undefined : [role as LeaveSummaryRole],
      userId: userId === ALL_VALUE ? undefined : userId,
      includeDetails,
    };
    setAppliedQuery(nextQuery);
    void loadSummary(nextQuery);
  }

  async function exportSummary() {
    setIsExporting(true);
    setError("");
    try {
      const result = await leaveApi.exportSummary(appliedQuery);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || "leave-summary.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export the leave summary.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  const usersWithLeave = summary?.users.length ?? 0;

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <FileBarChart size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Leave summary report</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
              Review approved leave days by person and leave type, then export the applied report for Excel or Sheets.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={isLoading || isExporting || !summary}
          onClick={() => void exportSummary()}
        >
          {isExporting ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <Download size={17} />
          )}
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]" onSubmit={applyFilters}>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="leave-summary-start">
            Start date
          </label>
          <Input
            id="leave-summary-start"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold" htmlFor="leave-summary-end">
            End date
          </label>
          <Input
            id="leave-summary-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold">Role</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="All leave-taking roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All leave-taking roles</SelectItem>
              {reportRoles.map((item) => (
                <SelectItem key={item} value={item}>
                  {formatRole(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold">Person</label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="All people" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All people</SelectItem>
              {reportUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isLoading}>
            <RefreshCw size={17} />
            Apply
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold lg:col-span-5">
          <input
            type="checkbox"
            checked={includeDetails}
            onChange={(event) => setIncludeDetails(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Include individual leave periods and reasons
        </label>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Report unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="text-sm font-bold text-muted-foreground">Approved leave days</div>
              <div className="mt-2 text-3xl font-extrabold">{summary.grandTotalDays}</div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="text-sm font-bold text-muted-foreground">People with approved leave</div>
              <div className="mt-2 text-3xl font-extrabold">{usersWithLeave}</div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="text-sm font-bold text-muted-foreground">Report period</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-extrabold">
                <CalendarDays size={17} className="text-primary" />
                {formatDate(summary.startDate)} – {formatDate(summary.endDate)}
              </div>
            </div>
          </div>

          {includeDetails ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Person</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Leave type</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Days</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.users.flatMap((user) =>
                    (user.requests ?? []).map((request) => (
                      <tr key={`${user.userId}-${request.startDate}-${request.leaveType}`}>
                        <td className="px-4 py-3 font-extrabold">{user.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatRole(user.role)}</td>
                        <td className="px-4 py-3">{request.leaveType}</td>
                        <td className="px-4 py-3">
                          {formatDate(request.startDate)} – {formatDate(request.endDate)}
                        </td>
                        <td className="px-4 py-3 font-extrabold">{request.days}</td>
                        <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
                          {request.reason || "No reason provided"}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
              {!summary.users.some((user) => user.requests?.length) ? (
                <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
                  No approved leave periods match the selected filters.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted text-xs font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Person</th>
                    <th className="px-4 py-3">Role</th>
                    {summary.leaveTypes.map((leaveType) => (
                      <th key={leaveType.id} className="px-4 py-3">
                        {leaveType.name}
                      </th>
                    ))}
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.users.map((user) => (
                    <tr key={user.userId}>
                      <td className="px-4 py-3 font-extrabold">{user.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatRole(user.role)}</td>
                      {summary.leaveTypes.map((leaveType) => (
                        <td key={leaveType.id} className="px-4 py-3">
                          {user.byLeaveType[leaveType.name] ?? 0}
                        </td>
                      ))}
                      <td className="px-4 py-3 font-extrabold">{user.totalDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!summary.users.length ? (
                <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
                  No approved leave matches the selected filters.
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

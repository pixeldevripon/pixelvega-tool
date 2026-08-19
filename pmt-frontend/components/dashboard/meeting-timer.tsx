"use client";

import { Clock3, Loader2, Pause, Play, RefreshCcw, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  meetingTimeApi,
  type ActiveProjectTimer,
  type ActiveTimerResponse,
  type MeetingTimeEntry,
} from "@/lib/api/meeting-time";
import type { AppUser } from "@/types/auth";

type TimerAction = "start" | "pause" | "resume" | "stop" | null;

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function elapsedMinutes(startedAt: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isMeetingEntry(
  entry: ActiveTimerResponse["entry"],
): entry is MeetingTimeEntry {
  return Boolean(entry && "sessionId" in entry && !("projectId" in entry));
}

function isProjectEntry(
  entry: ActiveTimerResponse["entry"],
): entry is ActiveProjectTimer {
  return Boolean(entry && "projectId" in entry);
}

export function MeetingTimer({ currentUser }: { currentUser: AppUser }) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimerResponse | null>(null);
  const [entries, setEntries] = useState<MeetingTimeEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<TimerAction>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const activeMeeting =
    activeTimer?.kind === "MEETING" && isMeetingEntry(activeTimer.entry)
      ? activeTimer.entry
      : null;
  const activeProject =
    activeTimer?.kind === "PROJECT" && isProjectEntry(activeTimer.entry)
      ? activeTimer.entry
      : null;
  const pausedMeeting = useMemo(
    () => entries.find((entry) => entry.status === "PAUSED") ?? null,
    [entries],
  );

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");
    try {
      const [activeResult, entriesResult] = await Promise.all([
        meetingTimeApi.active(),
        meetingTimeApi.list({ page: 1, pageSize: 20 }),
      ]);
      setActiveTimer(activeResult);
      setEntries(entriesResult.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load meeting time.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
      void load(true);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const activeElapsed = activeMeeting
    ? elapsedMinutes(activeMeeting.startedAt, now)
    : 0;

  async function handleAction(nextAction: Exclude<TimerAction, null>) {
    setAction(nextAction);
    setError("");
    try {
      const input = notes.trim() ? { notes: notes.trim() } : {};
      if (nextAction === "start") await meetingTimeApi.start(input);
      if (nextAction === "pause" && activeMeeting) {
        await meetingTimeApi.pause(activeMeeting.id, input);
      }
      if (nextAction === "resume" && pausedMeeting) {
        await meetingTimeApi.resume(pausedMeeting.id, input);
      }
      if (nextAction === "stop") {
        const entry = activeMeeting ?? pausedMeeting;
        if (!entry) return;
        await meetingTimeApi.stop(entry.id, input);
      }
      setNotes("");
      await load(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update the meeting timer.",
      );
      await load(true);
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Clock3 size={22} className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-lg font-extrabold">Meeting timer</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Track meetings and other non-project work. Only one timer can run at a time.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || isRefreshing || Boolean(action)}
          onClick={() => void load(true)}
        >
          {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="rounded-md border border-border p-4">
          {activeProject ? (
            <Alert variant="warning">
              <AlertTitle>Project timer running</AlertTitle>
              <AlertDescription>
                A timer is already running on {activeProject.project?.name || "a project"}.
                Pause or stop it before starting meeting time.
              </AlertDescription>
            </Alert>
          ) : activeMeeting ? (
            <Alert variant="success">
              <AlertTitle>Meeting timer running</AlertTitle>
              <AlertDescription>
                Current segment elapsed: {formatMinutes(activeElapsed)}
              </AlertDescription>
            </Alert>
          ) : pausedMeeting ? (
            <Alert>
              <AlertTitle>Meeting timer paused</AlertTitle>
              <AlertDescription>
                Resume this session or stop it to finalize the meeting time.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>No meeting timer running</AlertTitle>
              <AlertDescription>Start a timer when a meeting begins.</AlertDescription>
            </Alert>
          )}

          <div className="mt-4 space-y-2">
            <label className="text-sm font-bold" htmlFor="meeting-timer-notes">
              Notes
            </label>
            <Textarea
              id="meeting-timer-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note for this meeting segment."
              rows={3}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!activeMeeting && !activeProject && !pausedMeeting ? (
              <Button
                disabled={Boolean(action) || isLoading}
                onClick={() => void handleAction("start")}
              >
                {action === "start" ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                Start meeting
              </Button>
            ) : null}
            {activeMeeting ? (
              <Button variant="outline" disabled={Boolean(action)} onClick={() => void handleAction("pause")}>
                {action === "pause" ? <Loader2 size={17} className="animate-spin" /> : <Pause size={17} />}
                Pause
              </Button>
            ) : null}
            {pausedMeeting ? (
              <Button variant="outline" disabled={Boolean(action)} onClick={() => void handleAction("resume")}>
                {action === "resume" ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                Resume
              </Button>
            ) : null}
            {activeMeeting || pausedMeeting ? (
              <Button variant="outline" disabled={Boolean(action)} onClick={() => void handleAction("stop")}>
                {action === "stop" ? <Loader2 size={17} className="animate-spin" /> : <Square size={17} />}
                Stop
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold">Recent meeting time</h3>
              <p className="text-sm font-medium text-muted-foreground">Your latest saved segments.</p>
            </div>
            <Badge>{formatMinutes(entries.reduce((total, entry) => total + (entry.durationMinutes ?? 0), 0))}</Badge>
          </div>
          {entries.length ? (
            <div className="max-h-56 space-y-2 overflow-auto">
              {entries.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold">{formatDateTime(entry.startedAt)}</div>
                    <div className="mt-1 truncate text-xs font-medium text-muted-foreground">
                      {entry.notes || "No notes"}
                    </div>
                  </div>
                  <Badge tone={entry.status === "RUNNING" ? "success" : entry.status === "PAUSED" ? "warning" : "default"}>
                    {entry.status === "RUNNING" ? formatMinutes(elapsedMinutes(entry.startedAt, now)) : formatMinutes(entry.durationMinutes ?? 0)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-5 text-center text-sm font-medium text-muted-foreground">
              No meeting time recorded yet.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-muted-foreground">
        Meeting time is not attached to a project and does not change project actual hours.
      </p>
      <span className="sr-only">Tracking time for {currentUser.name || currentUser.email}</span>
    </section>
  );
}

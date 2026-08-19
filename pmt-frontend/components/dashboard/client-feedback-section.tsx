"use client";

import { CheckCircle2, History, Loader2, MessageSquare, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import {
  clientFeedbackApi,
  type ClientFeedback,
  type ClientFeedbackDecision,
} from "@/lib/api/client-feedback";
import type { Project } from "@/lib/api/projects";

const PAGE_SIZE = 10;

type ClientFeedbackSectionProps = {
  project: Project;
  canSubmit: boolean;
  isClient: boolean;
  onSubmitted: () => Promise<void>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function decisionLabel(decision: ClientFeedbackDecision) {
  return decision === "APPROVED" ? "Approved" : "Changes requested";
}

function decisionTone(decision: ClientFeedbackDecision) {
  return decision === "APPROVED" ? "success" : "warning";
}

function actorLabel(feedback: ClientFeedback) {
  if (!feedback.recordedBy) return "Submitted by client";
  return `Recorded by ${feedback.recordedBy.name || feedback.recordedBy.email}`;
}

export function ClientFeedbackSection({
  project,
  canSubmit,
  isClient,
  onSubmitted,
}: ClientFeedbackSectionProps) {
  const [feedback, setFeedback] = useState<ClientFeedback[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [decision, setDecision] = useState<ClientFeedbackDecision | null>(null);
  const [comments, setComments] = useState("");

  const loadFeedback = useCallback(
    async (nextPage: number, refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setLoadError("");

      try {
        const result = await clientFeedbackApi.list(project.id, nextPage, PAGE_SIZE);
        setFeedback(result.items);
        setPage(result.page);
        setTotal(result.total);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Unable to load client feedback.",
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
      void loadFeedback(1);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadFeedback]);

  const projectClosed = project.status === "COMPLETED" || project.status === "CANCELLED";
  const firstRoundNeedsWaitingStatus = total === 0 && project.status !== "WAITING_FOR_FEEDBACK";
  const submissionDisabled =
    !canSubmit ||
    isSubmitting ||
    isLoading ||
    projectClosed ||
    firstRoundNeedsWaitingStatus;

  async function submitFeedback() {
    if (!decision) return;
    if (decision === "CHANGES_REQUESTED" && !comments.trim()) {
      setSubmitError("Add comments describing the requested changes before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await clientFeedbackApi.create(project.id, {
        decision,
        comments: comments.trim() || undefined,
      });
      setDecision(null);
      setComments("");
      await loadFeedback(1, true);
      await onSubmitted();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to record client feedback.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <History size={21} className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-lg font-extrabold">Client feedback</h2>
            <p className="text-sm font-medium text-muted-foreground">
              Every response is preserved as a separate feedback round.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || isRefreshing}
          onClick={() => void loadFeedback(page, true)}
        >
          {isRefreshing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RotateCcw size={16} />
          )}
          Refresh
        </Button>
      </div>

      {canSubmit ? (
        <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <MessageSquare size={19} className="mt-0.5 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold">
                {isClient ? "Share your decision" : "Record the client's decision"}
              </h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {isClient
                  ? "Approve the deliverables or tell the team what needs to change."
                  : "Use this when the client has approved or requested changes outside the system."
                }
              </p>

              {firstRoundNeedsWaitingStatus ? (
                <Alert className="mt-4" variant="warning">
                  <AlertTitle>Feedback is not requested yet</AlertTitle>
                  <AlertDescription>
                    The first feedback round becomes available when the project is
                    in Waiting For Feedback.
                  </AlertDescription>
                </Alert>
              ) : projectClosed ? (
                <Alert className="mt-4" variant="warning">
                  <AlertTitle>Project closed</AlertTitle>
                  <AlertDescription>
                    No additional client feedback can be recorded after completion or cancellation.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={decision === "APPROVED" ? "default" : "outline"}
                      disabled={submissionDisabled}
                      onClick={() => {
                        setDecision("APPROVED");
                        setSubmitError("");
                      }}
                    >
                      <CheckCircle2 size={17} />
                      Approved
                    </Button>
                    <Button
                      type="button"
                      variant={decision === "CHANGES_REQUESTED" ? "default" : "outline"}
                      disabled={submissionDisabled}
                      onClick={() => {
                        setDecision("CHANGES_REQUESTED");
                        setSubmitError("");
                      }}
                    >
                      <RotateCcw size={17} />
                      Changes requested
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-bold" htmlFor={`feedback-comments-${project.id}`}>
                      Comments {decision === "CHANGES_REQUESTED" ? "(required)" : "(optional)"}
                    </label>
                    <Textarea
                      id={`feedback-comments-${project.id}`}
                      value={comments}
                      disabled={submissionDisabled}
                      onChange={(event) => setComments(event.target.value)}
                      placeholder="Add context for the team..."
                      rows={3}
                    />
                  </div>
                  {submitError ? (
                    <Alert className="mt-4" variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="mt-4 flex justify-end">
                    <Button
                      disabled={submissionDisabled || !decision}
                      onClick={() => void submitFeedback()}
                    >
                      {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : null}
                      {isSubmitting ? "Submitting..." : "Submit decision"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-extrabold">Feedback history</h3>
        {total > 0 ? (
          <span className="text-xs font-semibold text-muted-foreground">
            {total} round{total === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-md bg-muted" />
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-7 text-center text-sm font-medium text-muted-foreground">
          No client feedback has been recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <article key={item.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold">Round {item.feedbackRound}</span>
                  <Badge tone={decisionTone(item.decision)}>
                    {decisionLabel(item.decision)}
                  </Badge>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                {actorLabel(item)}
              </p>
              {item.comments ? (
                <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm font-medium">
                  {item.comments}
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
          onPageChange={(nextPage) => void loadFeedback(nextPage)}
        />
      </div>
    </section>
  );
}

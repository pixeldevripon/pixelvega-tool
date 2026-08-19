"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import {
  internalReviewsApi,
  type InternalReview,
  type InternalReviewDecision,
} from "@/lib/api/internal-reviews";
import type { Project } from "@/lib/api/projects";

const PAGE_SIZE = 10;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function reviewerName(review: InternalReview) {
  return review.reviewedBy?.name || review.reviewedBy?.email || "Workspace user";
}

type InternalReviewsSectionProps = {
  project: Project;
  canSubmit: boolean;
  onReviewed: () => Promise<void>;
};

export function InternalReviewsSection({
  project,
  canSubmit,
  onReviewed,
}: InternalReviewsSectionProps) {
  const [reviews, setReviews] = useState<InternalReview[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [decision, setDecision] = useState<InternalReviewDecision | null>(null);
  const [comments, setComments] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReviews = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setLoadError("");

      try {
        const result = await internalReviewsApi.list(project.id, page, PAGE_SIZE);
        setReviews(result.items);
        setTotal(result.total);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load internal reviews.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, project.id],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadReviews(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadReviews]);

  function openDecision(nextDecision: InternalReviewDecision) {
    setDecision(nextDecision);
    setComments("");
    setActionError("");
  }

  function closeDecision() {
    if (isSubmitting) return;
    setDecision(null);
    setComments("");
    setActionError("");
  }

  async function submitDecision() {
    if (!decision) return;
    const trimmedComments = comments.trim();

    if (decision === "CHANGES_REQUIRED" && !trimmedComments) {
      setActionError("Add clear revision comments before requesting changes.");
      return;
    }

    setIsSubmitting(true);
    setActionError("");
    try {
      await internalReviewsApi.create(project.id, {
        decision,
        comments: trimmedComments || undefined,
      });
      closeDecision();
      setPage(1);
      await onReviewed();
      if (page === 1) await loadReviews(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to submit internal review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <ClipboardCheck size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Internal review</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
              Review rounds are preserved as project history. Approving moves the project to Ready for Client; requesting changes sends it back to Ready for Work.
            </p>
          </div>
        </div>
        {project.status === "INTERNAL_REVIEW" && canSubmit ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openDecision("CHANGES_REQUIRED")}>
              <RotateCcw size={17} />
              Request changes
            </Button>
            <Button onClick={() => openDecision("APPROVED")}>
              <CheckCircle2 size={17} />
              Approve review
            </Button>
          </div>
        ) : null}
      </div>

      {project.status !== "INTERNAL_REVIEW" ? (
        <Alert className="mt-5">
          <AlertDescription>
            Review decisions can be submitted only while the project is in Internal Review. The history remains available here.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert className="mt-5" variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-5 border-t border-border pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-primary" aria-hidden="true" />
            <h3 className="font-extrabold">Review history</h3>
          </div>
          {total ? <Badge>{total} round{total === 1 ? "" : "s"}</Badge> : null}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm font-semibold text-muted-foreground">
            No internal review rounds have been recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-md border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={review.decision === "APPROVED" ? "success" : "warning"}>
                        {review.decision === "APPROVED" ? "Approved" : "Changes required"}
                      </Badge>
                      <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                        Round {review.reviewRound}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">
                      Reviewed by {reviewerName(review)} · {formatDateTime(review.createdAt)}
                    </p>
                  </div>
                </div>
                {review.comments ? (
                  <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm font-semibold leading-6">
                    {review.comments}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-muted-foreground">No comments added.</p>
                )}
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
            onPageChange={setPage}
          />
        </div>
      </div>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) closeDecision(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "APPROVED" ? "Approve internal review?" : "Request changes?"}
            </DialogTitle>
            <DialogDescription>
              {decision === "APPROVED"
                ? "This records an approval and moves the project to Ready for Client."
                : "This records a revision request and moves the project back to Ready for Work."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted p-4">
            <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Decision</div>
            <div className="mt-2">
              <Badge tone={decision === "APPROVED" ? "success" : "warning"}>
                {decision === "APPROVED" ? "Approved" : "Changes required"}
              </Badge>
            </div>
          </div>

          {decision === "CHANGES_REQUIRED" ? (
            <div className="space-y-2">
              <label htmlFor="internal-review-comments" className="text-sm font-bold">Revision comments</label>
              <Textarea
                id="internal-review-comments"
                value={comments}
                onChange={(event) => { setComments(event.target.value); setActionError(""); }}
                placeholder="Describe what needs to be fixed before the next review."
                rows={5}
                autoFocus
              />
              <p className="text-xs font-semibold text-muted-foreground">Required when requesting changes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="internal-review-optional-comments" className="text-sm font-bold">Comments <span className="font-medium text-muted-foreground">(optional)</span></label>
              <Textarea
                id="internal-review-optional-comments"
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                placeholder="Add a note about what was reviewed."
                rows={4}
              />
            </div>
          )}

          {actionError ? <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert> : null}

          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={closeDecision}>Cancel</Button>
            <Button disabled={isSubmitting} onClick={() => void submitDecision()}>
              {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : decision === "APPROVED" ? <CheckCircle2 size={17} /> : <RotateCcw size={17} />}
              {isSubmitting ? "Submitting..." : decision === "APPROVED" ? "Approve review" : "Request changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

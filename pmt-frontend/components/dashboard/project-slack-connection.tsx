"use client";

import { Check, Clipboard, Hash, Link2, Loader2, MessageSquareText, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { projectsApi, type Project } from "@/lib/api/projects";

type ConnectionMode = "CREATE" | "LINK";

export function ProjectSlackConnection({
  project,
  canManage,
  onConnected,
}: {
  project: Project;
  canManage: boolean;
  onConnected: (project: Project) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ConnectionMode>("CREATE");
  const [slackChannelId, setSlackChannelId] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const isConnected = Boolean(project.slackChannelId);

  function openDialog() {
    setMode("CREATE");
    setSlackChannelId("");
    setError("");
    setCopied(false);
    setIsOpen(true);
  }

  async function connect() {
    const trimmedChannelId = slackChannelId.trim();
    if (mode === "LINK" && !trimmedChannelId) {
      setError("Enter the Slack channel ID you want to link.");
      return;
    }

    setIsConnecting(true);
    setError("");
    try {
      const updatedProject = await projectsApi.connectSlackChannel(project.id, {
        ...(mode === "LINK" ? { slackChannelId: trimmedChannelId } : {}),
      });
      onConnected(updatedProject);
      setIsOpen(false);
      toast.success("Slack channel connected", {
        description: "Current project members and workspace admins were invited.",
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect the Slack channel. Please try again.",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function copyChannelId() {
    if (!project.slackChannelId) return;
    try {
      await navigator.clipboard.writeText(project.slackChannelId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Unable to copy the channel ID");
    }
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[#4A154B]/10 p-2.5 text-[#4A154B] dark:bg-fuchsia-950/30 dark:text-fuchsia-300">
              <MessageSquareText size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold">Project Slack channel</h2>
                <Badge tone={isConnected ? "success" : "warning"}>
                  {isConnected ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
                {isConnected
                  ? "Project updates can be posted to the connected Slack channel."
                  : "Create a private project channel or link one that already exists in Slack."}
              </p>
              {isConnected ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span className="rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono">
                    {project.slackChannelId}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void copyChannelId()}>
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? "Copied" : "Copy ID"}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          {canManage ? (
            <Button variant={isConnected ? "outline" : "default"} disabled={isConnected} onClick={openDialog}>
              {isConnected ? <Check size={17} /> : <MessageSquareText size={17} />}
              {isConnected ? "Channel connected" : "Connect Slack"}
            </Button>
          ) : null}
        </div>
        {isConnected ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm font-semibold leading-5 dark:border-emerald-950 dark:bg-emerald-950/20">
            Active project members and all workspace admins were invited when the channel was connected.
          </div>
        ) : canManage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm font-semibold leading-5 text-amber-900 dark:border-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
            Only an actively assigned Project Manager, Admin, or System Admin can connect this channel.
          </div>
        ) : null}
      </section>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isConnecting) setIsOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Slack to {project.name}</DialogTitle>
            <DialogDescription>
              The connection is one-time. After it succeeds, the current project roster and all workspace admins are invited to the channel.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`cursor-pointer rounded-md border p-4 text-left transition ${mode === "CREATE" ? "border-primary bg-accent" : "border-border hover:border-primary hover:bg-primary/10"}`}
              onClick={() => { setMode("CREATE"); setError(""); }}
            >
              <Plus size={18} className="text-primary" />
              <div className="mt-2 font-extrabold">Create a new channel</div>
              <div className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">Recommended. The backend creates a private channel using the project name and types.</div>
            </button>
            <button
              type="button"
              className={`cursor-pointer rounded-md border p-4 text-left transition ${mode === "LINK" ? "border-primary bg-accent" : "border-border hover:border-primary hover:bg-primary/10"}`}
              onClick={() => { setMode("LINK"); setError(""); }}
            >
              <Link2 size={18} className="text-primary" />
              <div className="mt-2 font-extrabold">Link an existing channel</div>
              <div className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">Use this when the Slack channel was already created and the bot has been added to it.</div>
            </button>
          </div>

          {mode === "LINK" ? (
            <div className="space-y-2">
              <label className="text-sm font-bold" htmlFor="slack-channel-id">Slack channel ID</label>
              <Input
                id="slack-channel-id"
                value={slackChannelId}
                onChange={(event) => setSlackChannelId(event.target.value)}
                placeholder="C0BKUALB5F1"
                autoComplete="off"
              />
              <p className="text-xs font-semibold leading-5 text-muted-foreground">
                Enter the channel ID, not the channel name or a Slack URL. Slack will reject archived or inaccessible channels.
              </p>
            </div>
          ) : (
            <Alert>
              <Hash size={18} />
              <AlertTitle>A private channel will be created</AlertTitle>
              <AlertDescription>
                The project channel name is generated from the project details. You do not need to enter a channel name here.
              </AlertDescription>
            </Alert>
          )}

          {error ? (
            <Alert variant="destructive">
              <RefreshCw size={18} />
              <AlertTitle>Connection failed</AlertTitle>
              <AlertDescription>{error} You can correct the details and retry.</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" disabled={isConnecting} onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button disabled={isConnecting} onClick={() => void connect()}>
              {isConnecting ? <Loader2 size={17} className="animate-spin" /> : <MessageSquareText size={17} />}
              {isConnecting ? "Connecting..." : mode === "LINK" ? "Link channel" : "Create and connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

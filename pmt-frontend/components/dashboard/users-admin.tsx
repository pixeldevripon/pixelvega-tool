"use client";

import Link from "next/link";
import {
  Ban,
  Eye,
  MessageSquareText,
  Pencil,
  Save,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { profilesApi } from "@/lib/api/profiles";
import { userStore } from "@/lib/api/user-store";
import { usersApi } from "@/lib/api/users";
import { assignableUserRoles, roleLabels, userStatuses } from "@/lib/auth-meta";
import { getProfilePhone } from "@/lib/profile-utils";
import type { AppUser, UserProfile, UserRole, UserStatus } from "@/types/auth";

function statusTone(status: UserStatus) {
  if (status === "ACTIVE") return "success";
  if (status === "INVITED") return "warning";
  return "danger";
}

export function UsersAdmin() {
  const {
    currentUser,
    users,
    loadingUsers,
    error: storeError,
  } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AppUser>>({});
  const [error, setError] = useState("");
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [suspendingUser, setSuspendingUser] = useState<AppUser | null>(null);
  const [saveLoadingId, setSaveLoadingId] = useState("");
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [profilesKey, setProfilesKey] = useState("");
  const canManageSlackMapping =
    currentUser?.role === "SYSTEM_ADMIN" || currentUser?.role === "ADMIN";

  useEffect(() => {
    void userStore.loadUsers();
  }, []);

  useEffect(() => {
    if (!users.length) return;

    const nextProfilesKey = users.map((user) => user.id).join("|");
    let active = true;
    void Promise.allSettled(
      users.map((user) => profilesApi.findByUserId(user.id)),
    ).then((results) => {
      if (!active) return;

      const nextProfiles: Record<string, UserProfile> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          nextProfiles[result.value.id] = result.value;
        }
      });
      setProfiles(nextProfiles);
      setProfilesKey(nextProfilesKey);
    });

    return () => {
      active = false;
    };
  }, [users]);

  function startEdit(user: AppUser) {
    setEditingId(user.id);
    setDraft({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      slackUserId: user.slackUserId ?? "",
    });
  }

  async function performSaveEdit(userId: string) {
    setError("");
    setSaveLoadingId(userId);

    try {
      const updatedUser = await usersApi.update(userId, draft);
      userStore.upsertUser(updatedUser);
      setEditingId(null);
      setDraft({});
      toast.success("User updated", {
        description: `${updatedUser.email} was saved.`,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setSaveLoadingId("");
    }
  }

  function saveEdit(user: AppUser) {
    if (draft.status === "SUSPENDED" && user.status !== "SUSPENDED") {
      setSuspendingUser(user);
      return;
    }

    void performSaveEdit(user.id);
  }

  async function confirmSuspendUser() {
    if (!suspendingUser) return;
    await performSaveEdit(suspendingUser.id);
    setSuspendingUser(null);
  }

  function getDeleteBlockReason(user: AppUser) {
    if (!currentUser) return "Current user is still loading.";
    if (user.role === "SYSTEM_ADMIN") {
      return "The system admin account cannot be deleted.";
    }
    if (user.role === "ADMIN" && currentUser.role !== "SYSTEM_ADMIN") {
      return "Only the system admin can delete an admin.";
    }
    return "";
  }

  async function deleteUser() {
    if (!deletingUser) return;

    setError("");
    setDeleteLoadingId(deletingUser.id);

    try {
      await usersApi.remove(deletingUser.id);
      userStore.removeUser(deletingUser.id);
      toast.success("User deleted", {
        description: `${deletingUser.email} was removed from active users.`,
      });
      setDeletingUser(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to delete user.",
      );
    } finally {
      setDeleteLoadingId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              All users
            </h1>
            <p className="mt-2 text-base font-medium text-muted-foreground">
              Review accounts, pending invitations, team access, and Slack identity mappings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="primary">{users.length || 0} users</Badge>
            <Link
              href="/dashboard/users/create"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              <UserPlus size={17} />
              Create user
            </Link>
          </div>
        </div>
      </section>

      {error || storeError ? (
        <Alert variant="destructive">
          <AlertDescription>{error || storeError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="bg-muted text-sm font-extrabold text-muted-foreground">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Slack identity</th>
                <th className="px-5 py-4">Phone</th>
                <th className="px-5 py-4">Activity</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingUsers ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8"
                  >
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-11/12" />
                      <Skeleton className="h-5 w-10/12" />
                    </div>
                  </td>
                </tr>
              ) : null}
              {users.map((user) => {
                const isEditing = editingId === user.id;
                const loadingProfile = !profilesKey
                  .split("|")
                  .includes(user.id);
                const deleteBlockReason = getDeleteBlockReason(user);
                const deletingThisUser = deleteLoadingId === user.id;
                const savingThisUser = saveLoadingId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-muted/50">
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={draft.name ?? ""}
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Full name"
                          />
                          <Input
                            type="email"
                            value={draft.email ?? ""}
                            disabled
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-extrabold">{user.name}</div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {user.email}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <Select
                          value={draft.role}
                          onValueChange={(nextRole) =>
                            setDraft((currentDraft) => ({
                              ...currentDraft,
                              role: nextRole as UserRole,
                            }))
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {draft.role === "SYSTEM_ADMIN" ? (
                              <SelectItem value="SYSTEM_ADMIN" disabled>
                                {roleLabels.SYSTEM_ADMIN}
                              </SelectItem>
                            ) : null}
                            {assignableUserRoles.map((item) => (
                              <SelectItem key={item} value={item}>
                                {roleLabels[item]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge tone="primary">{roleLabels[user.role]}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <Select
                          value={draft.status}
                          onValueChange={(nextStatus) =>
                            setDraft((currentDraft) => ({
                              ...currentDraft,
                              status: nextStatus as UserStatus,
                            }))
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {userStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing && canManageSlackMapping ? (
                        <div className="space-y-2">
                          <Input
                            value={draft.slackUserId ?? ""}
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                slackUserId: event.target.value,
                              }))
                            }
                            placeholder="U012ABCDEF"
                            aria-label={`Slack user ID for ${user.name || user.email}`}
                          />
                          <p className="text-xs font-semibold leading-5 text-muted-foreground">
                            Use this only when email lookup cannot find the Slack account.
                          </p>
                        </div>
                      ) : user.slackUserId ? (
                        <div className="flex items-center gap-2">
                          <Badge tone="success">
                            <MessageSquareText size={14} />
                            Mapped
                          </Badge>
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {user.slackUserId}
                          </span>
                        </div>
                      ) : (
                        <Badge tone="warning">Needs mapping</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {loadingProfile ? (
                        <Skeleton className="h-4 w-24" />
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                          {getProfilePhone(profiles[user.id] ?? null) ?? "Not added"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                      {user.invitedAt
                        ? `Invited ${user.invitedAt}`
                        : `Active ${user.lastActiveAt ?? "recently"}`}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isEditing ? (
                        <Button
                          disabled={Boolean(saveLoadingId)}
                          size="sm"
                          onClick={() => saveEdit(user)}
                        >
                          <Save size={16} />
                          {savingThisUser ? "Saving..." : "Save"}
                        </Button>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/users/${user.id}`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-colors hover:bg-muted"
                          >
                            <Eye size={16} />
                            View
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(user)}
                          >
                            <Pencil size={16} />
                            Edit
                          </Button>
                          <Button
                            aria-label={`Delete ${user.name || user.email}`}
                            disabled={Boolean(deleteBlockReason) || Boolean(deleteLoadingId)}
                            size="sm"
                            title={deleteBlockReason || "Delete user"}
                            variant="outline"
                            onClick={() => setDeletingUser(user)}
                          >
                            <Trash2 size={16} />
                            {deletingThisUser ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open && !deleteLoadingId) setDeletingUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This removes the account from active user lists. Historical
              records stay available for audit and project history.
            </DialogDescription>
          </DialogHeader>

          {deletingUser ? (
            <Alert variant="destructive">
              <AlertDescription>
                Delete{" "}
                <span className="font-extrabold">
                  {deletingUser.name || deletingUser.email}
                </span>
                ? This action cannot be undone from the dashboard.
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              disabled={Boolean(deleteLoadingId)}
              variant="outline"
              onClick={() => setDeletingUser(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              disabled={Boolean(deleteLoadingId)}
              onClick={() => void deleteUser()}
            >
              <Trash2 size={17} />
              {deleteLoadingId ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(suspendingUser)}
        onOpenChange={(open) => {
          if (!open && !saveLoadingId) setSuspendingUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend user</DialogTitle>
            <DialogDescription>
              Suspended users cannot sign in, and their active sessions are
              revoked by the backend.
            </DialogDescription>
          </DialogHeader>

          {suspendingUser ? (
            <Alert variant="warning">
              <Ban size={18} className="absolute left-4 top-4" />
              <AlertTitle className="pl-7">Access will be blocked</AlertTitle>
              <AlertDescription className="pl-7">
                Suspend{" "}
                <span className="font-extrabold">
                  {suspendingUser.name || suspendingUser.email}
                </span>
                ? They will be signed out and unable to use the dashboard until
                an admin changes their status again.
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              disabled={Boolean(saveLoadingId)}
              variant="outline"
              onClick={() => setSuspendingUser(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600"
              disabled={Boolean(saveLoadingId)}
              onClick={() => void confirmSuspendUser()}
            >
              <Ban size={17} />
              {saveLoadingId ? "Suspending..." : "Suspend user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import type { AppUser } from "@/types/auth";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";

type UserSnapshot = {
  currentUser: AppUser | null;
  users: AppUser[];
  loadingCurrentUser: boolean;
  loadingUsers: boolean;
  authStatus: AuthStatus;
  error: string | null;
};

const listeners = new Set<() => void>();
let currentUserRequest: Promise<AppUser | null> | null = null;
let currentUserRequestId = 0;

const ACCOUNT_UNAVAILABLE_MESSAGE =
  "Your account is no longer active. Please contact an administrator.";

let snapshot: UserSnapshot = {
  currentUser: null,
  users: [],
  loadingCurrentUser: false,
  loadingUsers: true,
  authStatus: "idle",
  error: null,
};

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(updates: Partial<UserSnapshot>) {
  snapshot = { ...snapshot, ...updates };
  emit();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function isMissingCurrentUserError(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

function isUnauthenticatedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

async function clearServerSession() {
  try {
    await authApi.logout();
  } catch {
    // The local session is already unusable; clearing frontend state is enough.
  }
}

export const userStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot() {
    return snapshot;
  },

  getServerSnapshot() {
    return snapshot;
  },

  async loadCurrentUser(options: { force?: boolean } = {}) {
    if (currentUserRequest && !options.force) return currentUserRequest;

    const requestId = currentUserRequestId + 1;
    currentUserRequestId = requestId;
    setSnapshot({ loadingCurrentUser: true, authStatus: "loading", error: null });

    currentUserRequest = usersApi
      .me()
      .then((currentUser) => {
        if (requestId === currentUserRequestId) {
          setSnapshot({
            currentUser,
            loadingCurrentUser: false,
            authStatus: "authenticated",
          });
        }
        return currentUser;
      })
      .catch(async (error: unknown) => {
        const isAuthError = isUnauthenticatedError(error);
        const isMissingCurrentUser = isMissingCurrentUserError(error);

        if (isAuthError || isMissingCurrentUser) {
          await clearServerSession();
          if (requestId === currentUserRequestId) {
            setSnapshot({
              currentUser: null,
              users: [],
              loadingCurrentUser: false,
              authStatus: "unauthenticated",
              error: isMissingCurrentUser ? ACCOUNT_UNAVAILABLE_MESSAGE : null,
            });
          }
          return null;
        }

        if (requestId === currentUserRequestId) {
          setSnapshot({
            currentUser: snapshot.currentUser,
            loadingCurrentUser: false,
            authStatus: "error",
            error: getErrorMessage(error),
          });
        }
        return snapshot.currentUser;
      })
      .finally(() => {
        if (requestId === currentUserRequestId) {
          currentUserRequest = null;
        }
      });

    return currentUserRequest;
  },

  async loadUsers() {
    setSnapshot({ loadingUsers: true, error: null });
    try {
      const users = await usersApi.list();
      setSnapshot({ users, loadingUsers: false });
      return users;
    } catch (error) {
      setSnapshot({
        users: [],
        loadingUsers: false,
        error: getErrorMessage(error),
      });
      return [];
    }
  },

  setCurrentUser(currentUser: AppUser | null) {
    setSnapshot({
      currentUser,
      users: currentUser ? snapshot.users : [],
      authStatus: currentUser ? "authenticated" : "unauthenticated",
      error: null,
    });
  },

  setUsers(users: AppUser[]) {
    setSnapshot({ users });
  },

  upsertUser(user: AppUser) {
    const users = snapshot.users.some((item) => item.id === user.id)
      ? snapshot.users.map((item) => (item.id === user.id ? user : item))
      : [user, ...snapshot.users];

    setSnapshot({
      currentUser:
        snapshot.currentUser?.id === user.id ? user : snapshot.currentUser,
      users,
    });
  },

  removeUser(userId: string) {
    setSnapshot({
      currentUser:
        snapshot.currentUser?.id === userId ? null : snapshot.currentUser,
      users: snapshot.users.filter((user) => user.id !== userId),
    });
  },
};

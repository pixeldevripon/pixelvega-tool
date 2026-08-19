"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { dashboardNav, type DashboardNavItem } from "@/components/dashboard/nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi } from "@/lib/api/auth";
import { roleLabels } from "@/lib/auth-meta";
import { userStore } from "@/lib/api/user-store";
import { cn } from "@/lib/utils";

const SESSION_REVALIDATION_AFTER_HIDDEN_MS = 5 * 60 * 1000;

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lastValidatedPathRef = useRef("");
  const hiddenAtRef = useRef<number | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const {
    currentUser: user,
    loadingCurrentUser,
    authStatus,
    error,
  } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );

  useEffect(() => {
    if (authStatus === "idle") {
      lastValidatedPathRef.current = pathname;
      void userStore.loadCurrentUser();
      return;
    }

    if (
      authStatus === "authenticated" &&
      pathname !== lastValidatedPathRef.current
    ) {
      lastValidatedPathRef.current = pathname;
      void userStore.loadCurrentUser({ force: true });
    }
  }, [authStatus, pathname]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;

      if (
        hiddenAt === null ||
        Date.now() - hiddenAt < SESSION_REVALIDATION_AFTER_HIDDEN_MS ||
        userStore.getSnapshot().authStatus !== "authenticated"
      ) {
        return;
      }

      void userStore.loadCurrentUser({ force: true });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const navItems: DashboardNavItem[] = user ? (dashboardNav[user.role] ?? []) : [];

  async function logout() {
    setIsAccountMenuOpen(false);
    try {
      await authApi.logout();
    } finally {
      userStore.setCurrentUser(null);
      router.push("/login");
    }
  }

  function openNavGroup(href: string) {
    router.push(href);
  }

  const displayName = user?.name?.trim() || user?.email || "Account";
  const accountInitials = user ? initials(displayName, user.email) : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-card px-5 py-6 lg:block">
        <div className="rounded-lg border border-border bg-muted/60 px-4 py-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            PixelVega
          </p>
          <div className="mt-1 text-lg font-extrabold tracking-tight">
            Project Management
          </div>
        </div>
        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              item.children?.some((child) => child.href === pathname);
            const expanded = active;

            if (item.children) {
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    aria-label={item.label}
                    onClick={() => openNavGroup(item.href)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-md px-4 py-3 text-left text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                      active && "bg-muted text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={19} />
                      {item.label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded ? (
                    <div className="mt-1 space-y-1 pl-8">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = pathname === child.href;
                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                              childActive && "bg-accent text-accent-foreground",
                            )}
                          >
                            <ChildIcon size={16} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            const itemActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  itemActive && "bg-accent text-accent-foreground",
                )}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="lg:hidden">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                PixelVega
              </p>
              <h2 className="text-lg font-extrabold">Project Management Tool</h2>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                PixelVega
              </p>
              <h2 className="text-xl font-extrabold">Project Management Tool</h2>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {user ? (
                <div ref={accountMenuRef} className="relative">
                  <Button
                    variant="ghost"
                    aria-label="Open account menu"
                    aria-expanded={isAccountMenuOpen}
                    aria-haspopup="menu"
                    className="h-auto gap-2 px-1.5 py-1.5 sm:px-2"
                    onClick={() => setIsAccountMenuOpen((open) => !open)}
                  >
                    <Avatar className="h-9 w-9 border border-border">
                      {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs font-extrabold">
                        {accountInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-36 text-left sm:block">
                      <span className="block truncate text-sm font-extrabold">
                        {displayName}
                      </span>
                      <span className="block truncate text-xs font-semibold text-muted-foreground">
                        {roleLabels[user.role]}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "hidden text-muted-foreground transition-transform sm:block",
                        isAccountMenuOpen && "rotate-180",
                      )}
                    />
                  </Button>

                  {isAccountMenuOpen ? (
                    <div
                      role="menu"
                      aria-label="Account options"
                      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card p-2 shadow-lg"
                    >
                      <div className="border-b border-border px-3 py-3">
                        <p className="truncate text-sm font-extrabold">
                          {displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                          {user.email}
                        </p>
                        <span className="mt-2 inline-flex rounded-md bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                          {roleLabels[user.role]}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <Link
                          href="/dashboard/profile"
                          role="menuitem"
                          onClick={() => setIsAccountMenuOpen(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <UserRound size={17} />
                          View profile
                        </Link>
                        <Link
                          href="/change-password"
                          role="menuitem"
                          onClick={() => setIsAccountMenuOpen(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <KeyRound size={17} />
                          Change password
                        </Link>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void logout()}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <LogOut size={17} />
                          Log out
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-5 py-6 lg:px-8">
          {!user && (loadingCurrentUser || authStatus === "idle") ? (
            <div className="max-w-3xl space-y-4">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : authStatus === "error" && !user ? (
            <Alert className="max-w-xl" variant="destructive">
              <AlertDescription>
                {error ?? "Unable to load your workspace."}
              </AlertDescription>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void userStore.loadCurrentUser()}
              >
                Retry
              </Button>
            </Alert>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

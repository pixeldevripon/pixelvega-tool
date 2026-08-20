"use client";

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { queryDefaults } from "@/components/providers/query-defaults";

function makeQueryClient() {
  return new QueryClient({ defaultOptions: queryDefaults });
}

/**
 * One client per browser tab, and a fresh one per server render.
 *
 * The two halves are for different hazards, and both are real:
 *
 * - **On the server**, a module-level client would be shared by every request
 *   the process handles, so one user's cached project list could be handed to
 *   the next user. A new client per render is the only safe answer.
 * - **In the browser**, a new client per render would throw the cache away.
 *   Holding it in a module variable rather than `useState` matters because
 *   React discards state from a render that suspends: with a `<Suspense>`
 *   boundary below this provider and none above it, a `useState` client is
 *   recreated on the first suspend and the cache is lost exactly when it is
 *   most useful.
 */
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
